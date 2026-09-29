"""
Binance public REST — preços batch, OHLCV, limites reais por par.

Limites reais extraídos via /api/v3/exchangeInfo (executado em bootstrap).
SYMBOL_LIMITS é populado na primeira inicialização do engine.
FEE_MAKER = 0.10%  (standard Tier 0 sem BNB)
FEE_TAKER = 0.10%  (standard Tier 0 sem BNB)
"""
import asyncio
import logging
import math
import time
from typing import Optional

import httpx

log = logging.getLogger("market")

BINANCE_BASE = "https://api.binance.com"
FEE_MAKER    = 0.001   # 0.10%
FEE_TAKER    = 0.001   # 0.10%

# Limites reais carregados do exchangeInfo (populados em bootstrap)
SYMBOL_LIMITS: dict[str, dict] = {}

# Todos os símbolos suportados pelo simulador
ALL_SYMBOLS: list[str] = [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "DOGEUSDT",
    "SHIBUSDT", "ADAUSDT", "XRPUSDT", "AVAXUSDT", "POLUSDT",
    "DOTUSDT", "LINKUSDT", "LTCUSDT", "UNIUSDT", "ATOMUSDT",
    "NEARUSDT", "APTUSDT", "ARBUSDT", "OPUSDT", "PEPEUSDT",
    "BCHUSDT", "AAVEUSDT", "INJUSDT", "SUIUSDT",
]

# Cache de preços (populado a cada 5s)
_price_cache: dict[str, float] = {}
_price_ts: float = 0
_PRICE_TTL = 5.0

# Cache de klines por símbolo
_kline_cache: dict[str, tuple[float, list]] = {}
_KLINE_TTL = 30.0

# Limites padrão (fallback se exchangeInfo falhar)
_DEFAULT_LIMITS = {
    "BTCUSDT":  {"min_qty": 0.00001,  "step_size": 0.00001,  "min_notional": 5.0,  "tick_size": 0.01},
    "ETHUSDT":  {"min_qty": 0.0001,   "step_size": 0.0001,   "min_notional": 5.0,  "tick_size": 0.01},
    "BNBUSDT":  {"min_qty": 0.001,    "step_size": 0.001,    "min_notional": 5.0,  "tick_size": 0.01},
    "SOLUSDT":  {"min_qty": 0.01,     "step_size": 0.01,     "min_notional": 5.0,  "tick_size": 0.01},
    "DOGEUSDT": {"min_qty": 1.0,      "step_size": 1.0,      "min_notional": 1.0,  "tick_size": 0.00001},
    "SHIBUSDT": {"min_qty": 100000.0, "step_size": 100000.0, "min_notional": 1.0,  "tick_size": 0.000000001},
    "ADAUSDT":  {"min_qty": 1.0,      "step_size": 1.0,      "min_notional": 5.0,  "tick_size": 0.0001},
    "XRPUSDT":  {"min_qty": 1.0,      "step_size": 1.0,      "min_notional": 5.0,  "tick_size": 0.0001},
    "AVAXUSDT": {"min_qty": 0.01,     "step_size": 0.01,     "min_notional": 5.0,  "tick_size": 0.01},
    "POLUSDT":  {"min_qty": 1.0,      "step_size": 1.0,      "min_notional": 5.0,  "tick_size": 0.0001},
    "BCHUSDT":  {"min_qty": 0.001,    "step_size": 0.001,    "min_notional": 5.0,  "tick_size": 0.01},
    "AAVEUSDT": {"min_qty": 0.001,    "step_size": 0.001,    "min_notional": 5.0,  "tick_size": 0.01},
    "INJUSDT":  {"min_qty": 0.01,     "step_size": 0.01,     "min_notional": 5.0,  "tick_size": 0.001},
    "SUIUSDT":  {"min_qty": 0.1,      "step_size": 0.1,      "min_notional": 5.0,  "tick_size": 0.0001},
    "DOTUSDT":  {"min_qty": 0.1,      "step_size": 0.1,      "min_notional": 5.0,  "tick_size": 0.001},
    "LINKUSDT": {"min_qty": 0.1,      "step_size": 0.1,      "min_notional": 5.0,  "tick_size": 0.001},
    "LTCUSDT":  {"min_qty": 0.001,    "step_size": 0.001,    "min_notional": 5.0,  "tick_size": 0.01},
    "UNIUSDT":  {"min_qty": 0.1,      "step_size": 0.1,      "min_notional": 5.0,  "tick_size": 0.001},
    "ATOMUSDT": {"min_qty": 0.01,     "step_size": 0.01,     "min_notional": 5.0,  "tick_size": 0.001},
    "NEARUSDT": {"min_qty": 0.1,      "step_size": 0.1,      "min_notional": 5.0,  "tick_size": 0.001},
    "APTUSDT":  {"min_qty": 0.01,     "step_size": 0.01,     "min_notional": 5.0,  "tick_size": 0.001},
    "ARBUSDT":  {"min_qty": 1.0,      "step_size": 1.0,      "min_notional": 5.0,  "tick_size": 0.0001},
    "OPUSDT":   {"min_qty": 0.1,      "step_size": 0.1,      "min_notional": 5.0,  "tick_size": 0.0001},
    "PEPEUSDT": {"min_qty": 1000000.0,"step_size": 1000000.0,"min_notional": 1.0,  "tick_size": 0.0000000010},
}


def _round_step(qty: float, step: float) -> float:
    """Arredonda qty para múltiplo de step_size (para baixo)."""
    if step <= 0:
        return qty
    precision = max(0, round(-math.log10(step)))
    factor    = 10 ** precision
    return math.floor(qty * factor) / factor


def validate_order(symbol: str, qty: float, price: float) -> tuple[float, Optional[str]]:
    """
    Valida e ajusta qty para min_qty, step_size, min_notional.
    Retorna (qty_ajustada, erro_ou_None).
    """
    lim = SYMBOL_LIMITS.get(symbol, _DEFAULT_LIMITS.get(symbol, {}))
    if not lim:
        return qty, None   # símbolo desconhecido, permissivo

    step     = lim.get("step_size", 0)
    min_qty  = lim.get("min_qty", 0)
    min_not  = lim.get("min_notional", 0)

    # Ajusta ao step_size
    qty = _round_step(qty, step) if step > 0 else qty

    if qty < min_qty:
        return 0.0, f"qty {qty:.10g} < min_qty {min_qty:.10g} para {symbol}"

    notional = qty * price
    if notional < min_not:
        return 0.0, f"notional ${notional:.4f} < min_notional ${min_not} para {symbol}"

    return qty, None


async def fetch_exchange_info(client: httpx.AsyncClient):
    """Carrega limites reais de todos os pares do exchangeInfo."""
    global SYMBOL_LIMITS
    try:
        resp = await client.get(f"{BINANCE_BASE}/api/v3/exchangeInfo",
                                params={"symbols": str(ALL_SYMBOLS).replace("'", '"')},
                                timeout=15)
        resp.raise_for_status()
        data = resp.json()
        for sym_info in data.get("symbols", []):
            sym = sym_info["symbol"]
            if sym not in ALL_SYMBOLS:
                continue
            limits = {}
            for f in sym_info.get("filters", []):
                ft = f.get("filterType", "")
                if ft == "LOT_SIZE":
                    limits["min_qty"]   = float(f["minQty"])
                    limits["max_qty"]   = float(f["maxQty"])
                    limits["step_size"] = float(f["stepSize"])
                elif ft in ("MIN_NOTIONAL", "NOTIONAL"):
                    limits["min_notional"] = float(f.get("minNotional", f.get("notional", 1)))
                elif ft == "PRICE_FILTER":
                    limits["tick_size"] = float(f["tickSize"])
            if limits:
                SYMBOL_LIMITS[sym] = limits
                log.debug(f"Limites {sym}: {limits}")
        log.info(f"exchangeInfo carregado: {len(SYMBOL_LIMITS)} pares")
    except Exception as e:
        log.warning(f"exchangeInfo falhou ({e}), usando defaults")
        SYMBOL_LIMITS.update(_DEFAULT_LIMITS)


async def get_all_prices(client: httpx.AsyncClient) -> dict[str, float]:
    """Preços de todos os pares via /api/v3/ticker/price (batch). Cache 5s."""
    global _price_cache, _price_ts
    now = time.monotonic()
    if now - _price_ts < _PRICE_TTL and _price_cache:
        return _price_cache

    try:
        resp = await client.get(
            f"{BINANCE_BASE}/api/v3/ticker/price",
            timeout=8.0
        )
        resp.raise_for_status()
        raw = resp.json()
        prices = {}
        for item in raw:
            if item["symbol"] in ALL_SYMBOLS:
                prices[item["symbol"]] = float(item["price"])
        _price_cache = prices
        _price_ts    = now
        return prices
    except Exception as e:
        log.warning(f"get_all_prices falhou ({e}), retornando cache")
        return _price_cache


async def get_price(symbol: str, client: Optional[httpx.AsyncClient] = None) -> float:
    """Preço de um símbolo via cache batch. Cria client temporário se omitido."""
    should_close = client is None
    if client is None:
        client = httpx.AsyncClient(timeout=10)
    try:
        prices = await get_all_prices(client)
        return prices.get(symbol, 0.0)
    finally:
        if should_close:
            await client.aclose()


async def get_ohlcv(symbol: str, interval: str = "1m", limit: int = 50,
                    client: Optional[httpx.AsyncClient] = None) -> list[dict]:
    """Alias estável para testes / callers antigos."""
    return await get_klines(symbol, interval, limit, client)


async def get_klines(symbol: str, interval: str = "1m", limit: int = 50,
                     client: Optional[httpx.AsyncClient] = None) -> list[dict]:
    """OHLCV com cache de 30s por símbolo."""
    key = f"{symbol}:{interval}:{limit}"
    now = time.monotonic()
    if key in _kline_cache:
        ts, cached = _kline_cache[key]
        if now - ts < _KLINE_TTL:
            return cached

    should_close = client is None
    if client is None:
        client = httpx.AsyncClient()
    try:
        resp = await client.get(
            f"{BINANCE_BASE}/api/v3/klines",
            params={"symbol": symbol, "interval": interval, "limit": limit},
            timeout=8.0
        )
        resp.raise_for_status()
        raw = resp.json()
        klines = [
            {
                "ts":     k[0],
                "open":   float(k[1]),
                "high":   float(k[2]),
                "low":    float(k[3]),
                "close":  float(k[4]),
                "volume": float(k[5]),
            }
            for k in raw
        ]
        _kline_cache[key] = (now, klines)
        return klines
    except Exception as e:
        log.warning(f"get_klines {symbol} falhou: {e}")
        _, cached = _kline_cache.get(key, (0, []))
        return cached
    finally:
        if should_close and client:
            await client.aclose()

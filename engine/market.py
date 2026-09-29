"""
Fetches last-price and recent OHLCV from Binance public REST.
Results cached in-process for 5 seconds to avoid rate-limiting.
"""
import httpx
import time
from typing import Optional

_cache: dict[str, tuple[float, float]] = {}  # symbol -> (price, ts)
_ohlcv_cache: dict[str, tuple[list, float]] = {}

BINANCE_TICKER = "https://api.binance.com/api/v3/ticker/price"
BINANCE_KLINES = "https://api.binance.com/api/v3/klines"
CACHE_TTL = 5.0  # seconds


async def get_price(symbol: str) -> Optional[float]:
    now = time.monotonic()
    if symbol in _cache and now - _cache[symbol][1] < CACHE_TTL:
        return _cache[symbol][0]
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(BINANCE_TICKER, params={"symbol": symbol})
        r.raise_for_status()
        price = float(r.json()["price"])
    _cache[symbol] = (price, now)
    return price


async def get_ohlcv(symbol: str, interval: str = "1m", limit: int = 50) -> list[dict]:
    """Returns list of {ts, open, high, low, close, volume}."""
    key = f"{symbol}:{interval}:{limit}"
    now = time.monotonic()
    if key in _ohlcv_cache and now - _ohlcv_cache[key][1] < CACHE_TTL:
        return _ohlcv_cache[key][0]
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(BINANCE_KLINES, params={
            "symbol": symbol, "interval": interval, "limit": limit
        })
        r.raise_for_status()
        raw = r.json()
    data = [
        {
            "ts": row[0],
            "open": float(row[1]),
            "high": float(row[2]),
            "low": float(row[3]),
            "close": float(row[4]),
            "volume": float(row[5]),
        }
        for row in raw
    ]
    _ohlcv_cache[key] = (data, now)
    return data

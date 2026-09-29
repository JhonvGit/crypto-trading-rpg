"""
Engine principal: loop de mercado + agentes + evolução + knowledge sharing.
"""
import asyncio
import json
import logging
import math
import random
import time

import httpx

from db.database import get_db
from engine.market import (
    get_all_prices, get_klines, fetch_exchange_info,
    ALL_SYMBOLS, validate_order, FEE_TAKER
)
from engine.simulator import execute_trade, portfolio_value, save_snapshot

log = logging.getLogger("engine")

AGENT_LAST_DECISION: dict[str, dict] = {}
SHARED_KNOWLEDGE:    list[dict]      = []
_KNOWLEDGE_MAX = 100
_running = False
_http_client = None


def _rsi(closes, period=14):
    if len(closes) < period + 1: return 50.0
    gains, losses = [], []
    for i in range(1, period + 1):
        d = closes[-period - 1 + i] - closes[-period - 2 + i]
        (gains if d > 0 else losses).append(abs(d))
    avg_g = sum(gains) / period if gains else 0
    avg_l = sum(losses) / period if losses else 1e-9
    return 100 - (100 / (1 + avg_g / avg_l))


def _ema(closes, period):
    if not closes: return 0.0
    k, ema = 2 / (period + 1), closes[0]
    for c in closes[1:]: ema = c * k + ema * (1 - k)
    return ema


def _macd(closes):
    if len(closes) < 26: return 0.0, 0.0
    macd   = _ema(closes, 12) - _ema(closes, 26)
    signal = _ema(closes[-9:], 9) if len(closes) >= 9 else macd
    return macd, signal


def _zscore(closes, period=20):
    if len(closes) < period: return 0.0
    w = closes[-period:]
    mean = sum(w) / period
    std  = math.sqrt(sum((x - mean) ** 2 for x in w) / period)
    return (closes[-1] - mean) / (std or 1e-9)


def _momentum(closes, period=10):
    if len(closes) < period: return 0.0
    return (closes[-1] - closes[-period]) / closes[-period] * 100


async def _save_knowledge(author_id, symbol, side, signal_type, indicators, pnl, pnl_pct, generation):
    global SHARED_KNOWLEDGE
    try:
        async with get_db() as db:
            conf = min(0.95, 0.5 + abs(pnl_pct) / 100)
            await db.execute("""
                INSERT INTO knowledge_pool
                  (author_id, symbol, side, signal_type, indicators, outcome_pnl, outcome_pct, confidence, generation)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, (author_id, symbol, side, signal_type,
                  json.dumps(indicators), pnl, pnl_pct, conf, generation))
            await db.commit()
    except Exception as e:
        log.warning(f"save_knowledge: {e}")
    SHARED_KNOWLEDGE = ([{
        "author": author_id[:12], "symbol": symbol, "side": side,
        "signal_type": signal_type, "indicators": indicators,
        "pnl": round(pnl, 4), "pnl_pct": round(pnl_pct, 2), "ts": int(time.time()),
    }] + SHARED_KNOWLEDGE)[:_KNOWLEDGE_MAX]


async def _get_top_knowledge(symbol, limit=5):
    try:
        async with get_db() as db:
            rows = await (await db.execute("""
                SELECT side, signal_type, indicators, outcome_pnl, outcome_pct, confidence
                FROM knowledge_pool WHERE symbol=?
                ORDER BY ts DESC, confidence DESC LIMIT ?
            """, (symbol, limit))).fetchall()
            return [dict(r) for r in rows]
    except Exception:
        return []


async def _decide_for_symbol(agent, symbol, prices, knowledge):
    price = prices.get(symbol, 0)
    if price <= 0: return None
    klines = await get_klines(symbol, "1m", 60, _http_client)
    if len(klines) < 20: return None
    closes    = [k["close"] for k in klines]
    rsi_v     = _rsi(closes)
    macd_v, macd_s = _macd(closes)
    zs        = _zscore(closes)
    mom       = _momentum(closes)
    strategy  = agent.get("class", "adaptive")
    balance   = agent.get("balance_usd", 0)
    indicators = {"rsi": round(rsi_v,2), "macd": round(macd_v-macd_s,5),
                  "momentum": round(mom,3), "zscore": round(zs,3), "price": price}
    kb_buys  = sum(1 for k in knowledge if k.get("side") == "BUY")
    kb_sells = sum(1 for k in knowledge if k.get("side") == "SELL")
    kb_bias  = kb_buys - kb_sells
    side, signal_type, reason_pt = None, "none", ""

    if strategy == "scalping":
        if rsi_v < 32 and mom > 0:   side, signal_type, reason_pt = "BUY",  "rsi_oversold",   f"RSI={rsi_v:.0f} sobrevendido + mom +{mom:.1f}%"
        elif rsi_v > 68 and mom < 0: side, signal_type, reason_pt = "SELL", "rsi_overbought",  f"RSI={rsi_v:.0f} sobrecomprado, realizando"
    elif strategy == "mean_reversion":
        if zs < -1.8:   side, signal_type, reason_pt = "BUY",  "zscore_low",  f"Z={zs:.2f}σ abaixo da média, reversão"
        elif zs > 1.8:  side, signal_type, reason_pt = "SELL", "zscore_high", f"Z=+{zs:.2f}σ acima, realizando"
    elif strategy in ("trend", "trend_follower"):
        if macd_v > macd_s and mom > 0.3:   side, signal_type, reason_pt = "BUY",  "macd_cross", f"MACD cruzou (+{macd_v-macd_s:.4f})"
        elif macd_v < macd_s and mom < -0.3: side, signal_type, reason_pt = "SELL", "macd_cross", "MACD abaixo do sinal"
    elif strategy == "breakout":
        highs = [k["high"] for k in klines[-20:]]
        res = max(highs[:-1]) if len(highs) > 1 else price
        if price > res * 1.002:   side, signal_type, reason_pt = "BUY",  "breakout",   f"Rompimento ${res:.2f}→${price:.2f}"
        elif rsi_v > 75:          side, signal_type, reason_pt = "SELL", "overbought", f"RSI={rsi_v:.0f} extremo"
    elif strategy == "dca":
        if rsi_v < 45 and random.random() < 0.25:
            side, signal_type, reason_pt = "BUY", "dca_regular", f"DCA regular RSI={rsi_v:.0f}"
    elif strategy == "grid":
        w = [k["close"] for k in klines[-10:]]
        mid = (max(w) + min(w)) / 2 if w else price
        if price < mid * 0.995:   side, signal_type, reason_pt = "BUY",  "grid_low",  f"Grid baixa ${price:.2f}<mid${mid:.2f}"
        elif price > mid * 1.005: side, signal_type, reason_pt = "SELL", "grid_high", f"Grid alta ${price:.2f}>mid${mid:.2f}"
    elif strategy == "volatility":
        vols = [abs(k["close"]-k["open"])/k["open"]*100 for k in klines[-10:]]
        v = sum(vols)/len(vols) if vols else 0
        if v > 0.5 and rsi_v < 50: side, signal_type, reason_pt = "BUY", "volatility_entry", f"Vol {v:.2f}% RSI={rsi_v:.0f}"
    elif strategy in ("swing", "swing_trader"):
        if rsi_v < 40 and zs < -1.0:   side, signal_type, reason_pt = "BUY",  "swing_low",  f"Swing low RSI={rsi_v:.0f} Z={zs:.2f}σ"
        elif rsi_v > 60 and zs > 1.0:  side, signal_type, reason_pt = "SELL", "swing_high", f"Swing high RSI={rsi_v:.0f} Z={zs:.2f}σ"
    else:  # adaptive / sentiment
        if kb_bias >= 3:   side, signal_type, reason_pt = "BUY",  "community", f"📡 {kb_buys} colegas compraram {symbol}"
        elif kb_bias <= -3: side, signal_type, reason_pt = "SELL", "community", f"📡 {kb_sells} colegas venderam {symbol}"
        elif rsi_v < 38:   side, signal_type, reason_pt = "BUY",  "adaptive_rsi", f"RSI={rsi_v:.0f} oversold"
        elif rsi_v > 62:   side, signal_type, reason_pt = "SELL", "adaptive_rsi", f"RSI={rsi_v:.0f} overbought"

    if side is None and abs(kb_bias) >= 4:
        side = "BUY" if kb_bias > 0 else "SELL"
        signal_type = "community_override"
        reason_pt   = f"🔗 Rede: {abs(kb_bias)} agentes {'compraram' if side=='BUY' else 'venderam'}"

    if side is None: return None
    qty = min(balance * 0.35, balance * 0.9) / (price * (1 + FEE_TAKER))
    return {"side": side, "qty": qty, "reason": reason_pt,
            "signal_type": signal_type, "indicators": indicators,
            "kb_buys": kb_buys, "kb_sells": kb_sells}


async def _agent_cycle(agent, prices):
    agent_id   = agent["id"]
    generation = agent.get("generation", 1)
    try:
        symbols = json.loads(agent.get("symbols") or '["BTCUSDT"]')
    except Exception:
        symbols = ["BTCUSDT"]
    # Cross-learning: absorver símbolos com alta confiança do knowledge pool
    for entry in SHARED_KNOWLEDGE[:20]:
        sym = entry.get("symbol")
        if sym and sym not in symbols and len(symbols) < 4 and entry.get("pnl_pct", 0) > 3.0:
            symbols.append(sym)
    decisions = []
    for symbol in symbols:
        try:
            knowledge = await _get_top_knowledge(symbol)
            decision  = await _decide_for_symbol(agent, symbol, prices, knowledge)
            if not decision: continue
            price  = prices.get(symbol, 0)
            result = await execute_trade(agent_id, symbol, decision["side"], decision["qty"], price)
            if result["ok"]:
                decisions.append({**decision, "symbol": symbol})
                if decision["side"] == "SELL" and result["pnl"] > 0:
                    await _save_knowledge(agent_id, symbol, "SELL", decision["signal_type"],
                                          decision["indicators"], result["pnl"], result.get("pnl_pct", 0), generation)
                elif decision["side"] == "BUY":
                    await _save_knowledge(agent_id, symbol, "BUY", decision["signal_type"],
                                          decision["indicators"], 0, 0, generation)
        except Exception as e:
            log.warning(f"{agent_id[:12]} {symbol}: {e}")
    if decisions:
        last = decisions[-1]
        AGENT_LAST_DECISION[agent_id] = {
            "symbol": last["symbol"], "side": last["side"],
            "reason": last["reason"], "signal_type": last["signal_type"],
            "indicators": last["indicators"],
            "shared_buy": last["kb_buys"], "shared_sell": last["kb_sells"],
            "ts": int(time.time()), "multi": len(decisions),
        }
    try:
        async with get_db() as db:
            await db.execute("UPDATE agents SET symbols=? WHERE id=?",
                             (json.dumps(symbols), agent_id))
            await db.commit()
    except Exception:
        pass


async def _main_loop():
    global _http_client
    _http_client = httpx.AsyncClient(timeout=10)
    await fetch_exchange_info(_http_client)
    cycle = 0
    while _running:
        try:
            prices = await get_all_prices(_http_client)
            if not prices:
                await asyncio.sleep(5)
                continue
            async with get_db() as db:
                rows   = await (await db.execute("SELECT * FROM agents WHERE status='active'")).fetchall()
                agents = [dict(r) for r in rows]
            await asyncio.gather(*[_agent_cycle(a, prices) for a in agents], return_exceptions=True)
            for agent in agents:
                val = await portfolio_value(agent["id"], prices)
                await save_snapshot(agent["id"], val)
            if cycle % 12 == 0:
                try:
                    from engine.evolution import check_bankruptcies_and_evolve
                    from engine.agents import ALL_AGENTS
                    await check_bankruptcies_and_evolve(ALL_AGENTS, prices)
                except Exception as e:
                    log.warning(f"Evolution: {e}")
            cycle += 1
        except Exception as e:
            log.exception(f"main_loop: {e}")
        await asyncio.sleep(5)
    if _http_client:
        await _http_client.aclose()


def engine_loop():
    global _running
    _running = True
    asyncio.ensure_future(_main_loop())


def stop_engine():
    global _running
    _running = False

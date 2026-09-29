"""
Engine principal: loop de mercado + agentes + evolução + knowledge sharing.

Quem decide: regras técnicas em engine/strategy.py (sem LLM).
JEV (Hub Investimentos :8085) só entra na falência, se o endpoint responder.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict

import httpx

from db.database import get_db
from engine.market import ALL_SYMBOLS, fetch_exchange_info, get_all_prices, get_klines  # noqa: F401 — re-export
from engine.simulator import execute_trade, portfolio_value, save_snapshot
from engine.strategy import decide_from_klines, resolve_strategy

log = logging.getLogger("engine")

AGENT_LAST_DECISION: dict[str, dict] = {}
SHARED_KNOWLEDGE: list[dict] = []
_KNOWLEDGE_MAX = 100
_running = False
_http_client: httpx.AsyncClient | None = None


def _parse_json(raw, default):
    if isinstance(raw, (dict, list)):
        return raw
    if not raw:
        return default
    try:
        return json.loads(raw)
    except Exception:
        return default


async def _save_knowledge(author_id, symbol, side, signal_type, indicators, pnl, pnl_pct, generation):
    global SHARED_KNOWLEDGE
    try:
        async with get_db() as db:
            conf = min(0.95, 0.5 + abs(pnl_pct) / 100)
            await db.execute(
                """
                INSERT INTO knowledge_pool
                  (author_id, symbol, side, signal_type, indicators, outcome_pnl, outcome_pct, confidence, generation)
                VALUES (?,?,?,?,?,?,?,?,?)
                """,
                (author_id, symbol, side, signal_type,
                 json.dumps(indicators), pnl, pnl_pct, conf, generation),
            )
            await db.commit()
    except Exception as e:
        log.warning(f"save_knowledge: {e}")
    SHARED_KNOWLEDGE = ([{
        "author": author_id[:12],
        "author_id": author_id,
        "symbol": symbol,
        "side": side,
        "signal_type": signal_type,
        "indicators": indicators,
        "pnl": round(pnl, 4),
        "pnl_pct": round(pnl_pct, 2),
        "ts": int(time.time()),
    }] + SHARED_KNOWLEDGE)[:_KNOWLEDGE_MAX]


async def _get_top_knowledge(symbol, limit=8):
    try:
        async with get_db() as db:
            rows = await (await db.execute(
                """
                SELECT author_id, side, signal_type, indicators, outcome_pnl, outcome_pct, confidence
                FROM knowledge_pool
                WHERE symbol=? AND outcome_pnl > 0
                ORDER BY ts DESC, confidence DESC LIMIT ?
                """,
                (symbol, limit),
            )).fetchall()
            return [dict(r) for r in rows]
    except Exception:
        return []


async def _position_qty(agent_id: str, symbol: str) -> float:
    async with get_db() as db:
        row = await (await db.execute(
            "SELECT qty FROM positions WHERE agent_id=? AND symbol=?",
            (agent_id, symbol),
        )).fetchone()
        return float(row["qty"]) if row else 0.0


def _cross_learn_symbols(current: list[str], agent_id: str) -> list[str]:
    """Absorve símbolo se ≥3 autores distintos lucraram >3% nele."""
    if len(current) >= 4:
        return current
    hits: dict[str, set] = defaultdict(set)
    for entry in SHARED_KNOWLEDGE[:40]:
        if float(entry.get("pnl_pct") or 0) <= 3.0:
            continue
        if entry.get("side") != "SELL":
            continue
        sym = entry.get("symbol")
        author = entry.get("author_id") or entry.get("author")
        if not sym or sym not in ALL_SYMBOLS or sym in current or author == agent_id:
            continue
        hits[sym].add(author)
    out = list(current)
    for sym, authors in hits.items():
        if len(authors) >= 3 and len(out) < 4:
            out.append(sym)
            log.info(f"{agent_id[:12]} absorveu {sym} via cross-learning")
    return out


async def _agent_cycle(agent, prices):
    agent_id = agent["id"]
    generation = agent.get("generation", 1)
    strategy = resolve_strategy(agent)
    genes_raw = _parse_json(agent.get("genes"), {})
    genes = genes_raw if isinstance(genes_raw, dict) else {}
    try:
        symbols = _parse_json(agent.get("symbols"), ["BTCUSDT"])
        if not isinstance(symbols, list) or not symbols:
            symbols = ["BTCUSDT"]
        symbols = [s for s in symbols if s in ALL_SYMBOLS] or ["BTCUSDT"]
    except Exception:
        symbols = ["BTCUSDT"]

    symbols = _cross_learn_symbols(symbols, agent_id)
    decisions = []
    balance = float(agent.get("balance_usd") or 0)

    for symbol in list(symbols):
        try:
            price = prices.get(symbol, 0)
            if price <= 0:
                continue
            knowledge = await _get_top_knowledge(symbol)
            klines = await get_klines(symbol, "1m", 60, _http_client)
            pos_qty = await _position_qty(agent_id, symbol)
            decision = decide_from_klines(
                strategy, klines, price, genes, knowledge, pos_qty, balance,
            )
            if not decision:
                continue
            result = await execute_trade(agent_id, symbol, decision["side"], decision["qty"], price)
            if result["ok"]:
                decisions.append({**decision, "symbol": symbol})
                if decision["side"] == "SELL" and result["pnl"] != 0:
                    await _save_knowledge(
                        agent_id, symbol, "SELL", decision["signal_type"],
                        decision["indicators"], result["pnl"], result.get("pnl_pct", 0), generation,
                    )
                if decision["side"] == "BUY":
                    # recarrega balance local aproximado
                    fee = result.get("fee", 0)
                    notional = result.get("notional", 0)
                    balance = max(0.0, balance - notional - fee)
        except Exception as e:
            log.warning(f"{agent_id[:12]} {symbol}: {e}")

    if decisions:
        last = decisions[-1]
        AGENT_LAST_DECISION[agent_id] = {
            "symbol": last["symbol"],
            "side": last["side"],
            "reason": last["reason"],
            "signal_type": last["signal_type"],
            "indicators": last["indicators"],
            "shared_buy": last["kb_buys"],
            "shared_sell": last["kb_sells"],
            "strategy": last.get("strategy", strategy),
            "ts": int(time.time()),
            "multi": len(decisions),
        }
    try:
        async with get_db() as db:
            await db.execute("UPDATE agents SET symbols=? WHERE id=?", (json.dumps(symbols), agent_id))
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
                rows = await (await db.execute("SELECT * FROM agents WHERE status='active'")).fetchall()
                agents = [dict(r) for r in rows]
            await asyncio.gather(*[_agent_cycle(a, prices) for a in agents], return_exceptions=True)
            for agent in agents:
                val = await portfolio_value(agent["id"], prices)
                if val is not None:
                    await save_snapshot(agent["id"], val)
            if cycle % 12 == 0:
                try:
                    from engine.evolution import check_bankruptcies_and_evolve
                    await check_bankruptcies_and_evolve(prices)
                except Exception as e:
                    log.warning(f"Evolution: {e}")
            cycle += 1
        except Exception as e:
            log.exception(f"main_loop: {e}")
        await asyncio.sleep(5)
    if _http_client:
        await _http_client.aclose()
        _http_client = None


def engine_loop():
    global _running
    _running = True
    asyncio.ensure_future(_main_loop())


def stop_engine():
    global _running
    _running = False

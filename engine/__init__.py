"""Engine: ties market data + agents + simulator into a periodic loop."""
import asyncio
import logging

log = logging.getLogger("engine")

# Expose these at engine level for server.py imports
from engine.market import get_price, get_ohlcv
from engine.agents import ALL_AGENTS
from engine.simulator import execute_trade, portfolio_value, save_snapshot

ALL_SYMBOLS = list({sym for a in ALL_AGENTS for sym in a.symbols})


async def run_tick():
    """One simulation tick: fetch data, ask every agent, execute decisions, snapshot."""
    # 1. Fetch OHLCV for every symbol
    ohlcv: dict = {}
    for sym in ALL_SYMBOLS:
        try:
            ohlcv[sym] = await get_ohlcv(sym, interval="1m", limit=50)
        except Exception as e:
            log.warning(f"OHLCV fetch failed for {sym}: {e}")

    # 2. Current prices from last candle close
    prices = {sym: ohlcv[sym][-1]["close"] for sym in ohlcv if ohlcv.get(sym)}

    # 3. Each agent decides and trades
    for agent in ALL_AGENTS:
        try:
            actions = await agent.decide({sym: ohlcv.get(sym, []) for sym in agent.symbols})
            for action in actions:
                sym = action["symbol"]
                price = prices.get(sym)
                if not price:
                    continue
                port = await portfolio_value(agent.id, prices)
                units = (port * action["qty_pct"]) / price
                await execute_trade(agent.id, sym, action["side"], units, price)
        except Exception as e:
            log.exception(f"Agent {agent.id} tick error: {e}")

    # 4. Snapshot every agent's total value
    for agent in ALL_AGENTS:
        try:
            val = await portfolio_value(agent.id, prices)
            await save_snapshot(agent.id, val)
        except Exception:
            pass


async def engine_loop(interval_seconds: int = 30):
    """Runs ticks forever at the given interval."""
    while True:
        try:
            await run_tick()
        except Exception as e:
            log.exception(f"Engine loop error: {e}")
        await asyncio.sleep(interval_seconds)

"""Engine: ties market data + agents + simulator into a periodic loop with evolution."""
import asyncio
import logging

log = logging.getLogger("engine")

# Expose these at engine level for server.py imports
from engine.market import get_price, get_ohlcv
from engine.agents import ALL_AGENTS
from engine.simulator import execute_trade, portfolio_value, save_snapshot
from engine.evolution import check_bankruptcies_and_evolve, learn_from_trade

ALL_SYMBOLS = list({sym for a in ALL_AGENTS for sym in a.symbols})


async def run_tick():
    """One simulation tick: fetch data, ask every agent, execute decisions, snapshot, evolve."""
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
                
                # Executar trade
                result = await execute_trade(agent.id, sym, action["side"], units, price)
                
                # Se trade teve sucesso, aprender com ele
                if result["ok"] and abs(result["pnl"]) > 0.01:
                    # Buscar última posição para pegar entry price
                    from db.database import get_db
                    async with get_db() as db:
                        last_trades = await (await db.execute(
                            "SELECT price FROM trades WHERE agent_id=? AND symbol=? ORDER BY ts DESC LIMIT 2",
                            (agent.id, sym)
                        )).fetchall()
                        last_trade = list(last_trades)
                        
                        if len(last_trade) >= 2:
                            entry_price = float(last_trade[1]["price"])
                            exit_price = float(last_trade[0]["price"])
                            await learn_from_trade(
                                agent.id, sym, action["side"],
                                entry_price, exit_price, result["pnl"],
                                ohlcv.get(sym, [])
                            )
        except Exception as e:
            log.exception(f"Agent {agent.id} tick error: {e}")

    # 4. Snapshot every agent's total value
    for agent in ALL_AGENTS:
        try:
            val = await portfolio_value(agent.id, prices)
            await save_snapshot(agent.id, val)
        except Exception:
            pass

    # 5. EVOLUÇÃO: Verificar falidos e criar novos agentes
    try:
        new_agents = await check_bankruptcies_and_evolve(ALL_AGENTS, prices)
        if new_agents:
            log.info(f"🧬 EVOLUTION: {len(new_agents)} new agents created")
            # Aqui novos agentes são salvos no DB, mas precisam ser instanciados
            # dinamicamente. Por agora, serão carregados no próximo restart ou
            # via reload dinâmico do servidor
    except Exception as e:
        log.exception(f"Evolution check error: {e}")


async def engine_loop(interval_seconds: int = 30):
    """Runs ticks forever at the given interval."""
    while True:
        try:
            await run_tick()
        except Exception as e:
            log.exception(f"Engine loop error: {e}")
        await asyncio.sleep(interval_seconds)

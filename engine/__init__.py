"""Engine: market data + agents + simulator + knowledge sharing + evolução."""
import asyncio
import logging
import json

log = logging.getLogger("engine")

from engine.market import get_price, get_ohlcv
from engine.agents import ALL_AGENTS
from engine.simulator import execute_trade, portfolio_value, save_snapshot
from engine.evolution import check_bankruptcies_and_evolve, learn_from_trade

ALL_SYMBOLS = list({sym for a in ALL_AGENTS for sym in a.symbols})

# Memória global compartilhada entre agentes (knowledge pool)
# Cada entrada: {symbol, indicator, action, avg_pnl, confidence, source_agent, count}
SHARED_KNOWLEDGE: list[dict] = []

# Última decisão de cada agente para exibir no frontend
AGENT_LAST_DECISION: dict[str, dict] = {}


async def broadcast_knowledge(agent_id: str, symbol: str, side: str,
                               pnl: float, indicators: dict):
    """Após trade com PNL positivo, compartilha padrão com todos os agentes."""
    from db.database import get_db
    if pnl <= 0:
        return
    async with get_db() as db:
        for ind_name, ind_value in indicators.items():
            # Salva como padrão compartilhado na tabela learned_patterns
            # usando 'ALL' como agent_id para indicar conhecimento global
            await db.execute("""
                INSERT INTO learned_patterns
                (agent_id, pattern_type, symbol, indicator, threshold_low, threshold_high,
                 action, success_count, fail_count, avg_pnl, confidence)
                VALUES('SHARED', 'shared', ?, ?, ?, ?, ?, 1, 0, ?, 0.6)
                ON CONFLICT DO NOTHING
            """, (symbol, ind_name, float(ind_value) - 1, float(ind_value) + 1,
                  side, pnl))
        await db.commit()

    # Atualiza memória in-process
    SHARED_KNOWLEDGE.append({
        "symbol": symbol, "side": side, "pnl": pnl,
        "source": agent_id, "indicators": indicators
    })
    if len(SHARED_KNOWLEDGE) > 200:
        SHARED_KNOWLEDGE.pop(0)
    log.info(f"📢 KNOWLEDGE SHARE: {agent_id} {side} {symbol} pnl={pnl:.4f}")


async def get_shared_signals(symbol: str) -> dict:
    """Retorna sinais da comunidade para um símbolo: quantos agentes compraram/venderam com lucro."""
    buys = sum(1 for k in SHARED_KNOWLEDGE[-50:] if k["symbol"] == symbol and k["side"] == "BUY" and k["pnl"] > 0)
    sells = sum(1 for k in SHARED_KNOWLEDGE[-50:] if k["symbol"] == symbol and k["side"] == "SELL" and k["pnl"] > 0)
    return {"buy_signals": buys, "sell_signals": sells}


async def run_tick():
    """Um tick: fetch dados → cada agente decide (com acesso a conhecimento compartilhado)
    → executa trades → aprende → snapshot → evolução."""

    # 1. Buscar OHLCV para todos os símbolos
    ohlcv: dict = {}
    for sym in ALL_SYMBOLS:
        try:
            ohlcv[sym] = await get_ohlcv(sym, interval="1m", limit=60)
        except Exception as e:
            log.warning(f"OHLCV fetch failed for {sym}: {e}")

    prices = {sym: ohlcv[sym][-1]["close"] for sym in ohlcv if ohlcv.get(sym)}

    # 2. Cada agente decide — agora pode operar em QUALQUER símbolo ativo
    for agent in ALL_AGENTS:
        try:
            # Agente recebe todos os ohlcv disponíveis (pode decidir em qualquer par)
            # mas por padrão filtra para os seus símbolos + sinais compartilhados
            agent_ohlcv = {sym: ohlcv.get(sym, []) for sym in agent.symbols}

            # Adicionar símbolos com forte sinal compartilhado (cross-learning)
            for sym in ALL_SYMBOLS:
                if sym not in agent.symbols:
                    signals = await get_shared_signals(sym)
                    # Se 3+ agentes lucraram comprando, inclui o símbolo para análise
                    if signals["buy_signals"] >= 3 or signals["sell_signals"] >= 3:
                        agent_ohlcv[sym] = ohlcv.get(sym, [])

            actions = await agent.decide(agent_ohlcv)

            for action in actions:
                sym = action["symbol"]
                price = prices.get(sym)
                if not price:
                    continue
                port = await portfolio_value(agent.id, prices)
                units = (port * action["qty_pct"]) / price

                # Calcular indicadores para registrar decisão
                candles = ohlcv.get(sym, [])
                closes = [c["close"] for c in candles] if candles else []
                from engine.evolution import calculate_rsi, calculate_macd_signal
                import math
                rsi_val = calculate_rsi(closes) if len(closes) > 15 else 50.0
                macd_val = calculate_macd_signal(closes) if len(closes) > 26 else 0.0
                momentum = round((closes[-1] / closes[-5] - 1) * 100, 3) if len(closes) >= 6 else 0.0
                # Z-score
                if len(closes) >= 20:
                    mean = sum(closes[-20:]) / 20
                    std = math.sqrt(sum((x - mean) ** 2 for x in closes[-20:]) / 20)
                    zscore = round((closes[-1] - mean) / std, 3) if std > 0 else 0.0
                else:
                    zscore = 0.0

                # Comunidade: quantos agentes fizeram o mesmo trade com lucro
                shared = await get_shared_signals(sym)

                # Salvar última decisão do agente (para exibir no frontend)
                reason = action.get("reason", _build_reason(
                    action["side"], rsi_val, macd_val, momentum, zscore, shared
                ))
                AGENT_LAST_DECISION[agent.id] = {
                    "symbol": sym,
                    "side": action["side"],
                    "qty_pct": action["qty_pct"],
                    "price": price,
                    "rsi": round(rsi_val, 1),
                    "macd": round(macd_val, 6),
                    "momentum": momentum,
                    "zscore": zscore,
                    "shared_buy": shared["buy_signals"],
                    "shared_sell": shared["sell_signals"],
                    "reason": reason,
                }

                result = await execute_trade(agent.id, sym, action["side"], units, price)

                if result["ok"]:
                    # Compartilhar conhecimento se lucrativo
                    if result["pnl"] > 0.005:
                        await broadcast_knowledge(
                            agent.id, sym, action["side"], result["pnl"],
                            {"rsi": rsi_val, "macd": macd_val, "momentum": momentum}
                        )
                    # Aprender com o trade
                    if abs(result["pnl"]) > 0.001:
                        from db.database import get_db
                        async with get_db() as db:
                            last_trades = await (await db.execute(
                                "SELECT price FROM trades WHERE agent_id=? AND symbol=? ORDER BY ts DESC LIMIT 2",
                                (agent.id, sym)
                            )).fetchall()
                            last_trade = list(last_trades)
                            if len(last_trade) >= 2:
                                await learn_from_trade(
                                    agent.id, sym, action["side"],
                                    float(last_trade[1]["price"]),
                                    float(last_trade[0]["price"]),
                                    result["pnl"],
                                    ohlcv.get(sym, [])
                                )

        except Exception as e:
            log.exception(f"Agent {agent.id} tick error: {e}")

    # 3. Snapshot de todos
    for agent in ALL_AGENTS:
        try:
            val = await portfolio_value(agent.id, prices)
            await save_snapshot(agent.id, val)
        except Exception:
            pass

    # 4. Evolução
    try:
        new_agents = await check_bankruptcies_and_evolve(ALL_AGENTS, prices)
        if new_agents:
            log.info(f"🧬 EVOLUTION: {len(new_agents)} new agents")
    except Exception as e:
        log.exception(f"Evolution error: {e}")


def _build_reason(side: str, rsi: float, macd: float, momentum: float,
                  zscore: float, shared: dict) -> str:
    """Gera frase explicando por que o agente decidiu comprar/vender."""
    parts = []
    if side == "BUY":
        if rsi < 35:
            parts.append(f"RSI={rsi:.0f} oversold")
        if momentum > 0.5:
            parts.append(f"momentum +{momentum:.1f}%")
        if zscore < -1:
            parts.append(f"Z={zscore:.1f}σ baixo")
        if shared["buy_signals"] >= 2:
            parts.append(f"{shared['buy_signals']} agentes compraram")
        if macd > 0:
            parts.append("MACD positivo")
    else:
        if rsi > 65:
            parts.append(f"RSI={rsi:.0f} overbought")
        if momentum < -0.5:
            parts.append(f"momentum {momentum:.1f}%")
        if zscore > 1:
            parts.append(f"Z=+{zscore:.1f}σ alto")
        if shared["sell_signals"] >= 2:
            parts.append(f"{shared['sell_signals']} agentes venderam")
        if macd < 0:
            parts.append("MACD negativo")
    return ", ".join(parts) if parts else f"{side} sinal técnico"


async def engine_loop(interval_seconds: int = 30):
    while True:
        try:
            await run_tick()
        except Exception as e:
            log.exception(f"Engine loop error: {e}")
        await asyncio.sleep(interval_seconds)

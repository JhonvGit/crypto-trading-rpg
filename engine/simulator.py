"""
Portfolio simulator com fee de transação (maker/taker model).
BUY fee: 0.1% do valor comprado (descontado do balance).
SELL fee: 0.1% do valor recebido (descontado do retorno).
Fee registrado em cada trade para transparência total.
"""
import logging
from db.database import get_db

log = logging.getLogger("simulator")

# Binance-like taker fee padrão
TRADE_FEE_PCT = 0.001   # 0.10% por lado


async def execute_trade(agent_id: str, symbol: str, side: str,
                        qty: float, price: float) -> dict:
    """
    side: "BUY" or "SELL"
    Returns {"ok": bool, "pnl": float, "fee": float, "reason": str}
    """
    async with get_db() as db:
        row = await (await db.execute(
            "SELECT balance_usd FROM agents WHERE id=?", (agent_id,)
        )).fetchone()
        if not row:
            return {"ok": False, "pnl": 0, "fee": 0, "reason": "agent not found"}

        balance = row["balance_usd"]
        pnl = 0.0
        fee = 0.0

        if side == "BUY":
            gross_cost = qty * price
            fee = gross_cost * TRADE_FEE_PCT        # fee em USD
            total_cost = gross_cost + fee           # custo total incluindo fee

            if total_cost > balance:
                # Recalcular qty considerando o fee
                qty = (balance / (price * (1 + TRADE_FEE_PCT))) * 0.999
                gross_cost = qty * price
                fee = gross_cost * TRADE_FEE_PCT
                total_cost = gross_cost + fee

            if qty <= 0 or total_cost > balance:
                return {"ok": False, "pnl": 0, "fee": 0, "reason": "insufficient balance"}

            # Débito: custo + fee
            await db.execute(
                "UPDATE agents SET balance_usd = balance_usd - ? WHERE id=?",
                (total_cost, agent_id)
            )
            # Atualiza posição (preço médio inclui fee no custo efetivo)
            effective_price = total_cost / qty      # preço efetivo com fee
            await db.execute("""
                INSERT INTO positions(agent_id, symbol, qty, avg_price)
                VALUES(?,?,?,?)
                ON CONFLICT(agent_id, symbol) DO UPDATE SET
                  avg_price = (avg_price*qty + excluded.avg_price*excluded.qty)
                              / (qty + excluded.qty),
                  qty = qty + excluded.qty
            """, (agent_id, symbol, qty, effective_price))

        elif side == "SELL":
            pos = await (await db.execute(
                "SELECT qty, avg_price FROM positions WHERE agent_id=? AND symbol=?",
                (agent_id, symbol)
            )).fetchone()
            if not pos or pos["qty"] <= 0:
                return {"ok": False, "pnl": 0, "fee": 0, "reason": "no position"}
            if qty > pos["qty"]:
                qty = pos["qty"]

            gross_return = qty * price
            fee = gross_return * TRADE_FEE_PCT      # fee descontado do retorno
            net_return = gross_return - fee

            # P&L = net_return - custo original (avg_price já inclui fee de compra)
            pnl = net_return - (pos["avg_price"] * qty)

            await db.execute(
                "UPDATE agents SET balance_usd = balance_usd + ? WHERE id=?",
                (net_return, agent_id)
            )
            new_qty = pos["qty"] - qty
            if new_qty < 1e-8:
                await db.execute(
                    "DELETE FROM positions WHERE agent_id=? AND symbol=?",
                    (agent_id, symbol)
                )
            else:
                await db.execute(
                    "UPDATE positions SET qty=? WHERE agent_id=? AND symbol=?",
                    (new_qty, agent_id, symbol)
                )
        else:
            return {"ok": False, "pnl": 0, "fee": 0, "reason": "unknown side"}

        await db.execute(
            "INSERT INTO trades(agent_id, symbol, side, qty, price, pnl, fee) VALUES(?,?,?,?,?,?,?)",
            (agent_id, symbol, side, qty, price, pnl, fee)
        )
        await db.commit()
        log.info(
            f"TRADE {agent_id} {side} {qty:.6f} {symbol} @ {price:.4f} "
            f"pnl={pnl:.4f} fee={fee:.4f}"
        )
        return {"ok": True, "pnl": pnl, "fee": fee, "reason": "ok"}


async def portfolio_value(agent_id: str, prices: dict[str, float]) -> float:
    """Cash + mark-to-market de posições abertas."""
    async with get_db() as db:
        row = await (await db.execute(
            "SELECT balance_usd FROM agents WHERE id=?", (agent_id,)
        )).fetchone()
        if not row:
            return 0.0
        total = row["balance_usd"]
        rows = await (await db.execute(
            "SELECT symbol, qty FROM positions WHERE agent_id=?", (agent_id,)
        )).fetchall()
        for r in rows:
            total += r["qty"] * prices.get(r["symbol"], 0)
    return total


async def save_snapshot(agent_id: str, total_usd: float):
    async with get_db() as db:
        await db.execute(
            "INSERT INTO snapshots(agent_id, total_usd) VALUES(?,?)",
            (agent_id, total_usd)
        )
        await db.commit()

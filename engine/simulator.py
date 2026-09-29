"""
Portfolio simulator. Executes BUY/SELL at a given price without a real exchange.
"""
import logging
from db.database import get_db

log = logging.getLogger("simulator")


async def execute_trade(agent_id: str, symbol: str, side: str,
                        qty: float, price: float) -> dict:
    """
    side: "BUY" or "SELL"
    Returns {"ok": bool, "pnl": float, "reason": str}
    """
    async with get_db() as db:
        row = await (await db.execute(
            "SELECT balance_usd FROM agents WHERE id=?", (agent_id,)
        )).fetchone()
        if not row:
            return {"ok": False, "pnl": 0, "reason": "agent not found"}

        balance = row["balance_usd"]
        cost = qty * price
        pnl = 0.0

        if side == "BUY":
            if cost > balance:
                qty = balance / price * 0.99  # buy max affordable minus 1% slippage
                cost = qty * price
            if qty <= 0:
                return {"ok": False, "pnl": 0, "reason": "insufficient balance"}
            await db.execute(
                "UPDATE agents SET balance_usd = balance_usd - ? WHERE id=?",
                (cost, agent_id)
            )
            await db.execute("""
                INSERT INTO positions(agent_id, symbol, qty, avg_price)
                VALUES(?,?,?,?)
                ON CONFLICT(agent_id, symbol) DO UPDATE SET
                  avg_price = (avg_price*qty + excluded.avg_price*excluded.qty)
                              / (qty + excluded.qty),
                  qty = qty + excluded.qty
            """, (agent_id, symbol, qty, price))

        elif side == "SELL":
            pos = await (await db.execute(
                "SELECT qty, avg_price FROM positions WHERE agent_id=? AND symbol=?",
                (agent_id, symbol)
            )).fetchone()
            if not pos or pos["qty"] <= 0:
                return {"ok": False, "pnl": 0, "reason": "no position"}
            if qty > pos["qty"]:
                qty = pos["qty"]
            pnl = (price - pos["avg_price"]) * qty
            await db.execute(
                "UPDATE agents SET balance_usd = balance_usd + ? WHERE id=?",
                (qty * price, agent_id)
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
            return {"ok": False, "pnl": 0, "reason": "unknown side"}

        await db.execute(
            "INSERT INTO trades(agent_id, symbol, side, qty, price, pnl) VALUES(?,?,?,?,?,?)",
            (agent_id, symbol, side, qty, price, pnl)
        )
        await db.commit()
        log.info(f"TRADE {agent_id} {side} {qty:.6f} {symbol} @ {price:.4f} pnl={pnl:.4f}")
        return {"ok": True, "pnl": pnl, "reason": "ok"}


async def portfolio_value(agent_id: str, prices: dict[str, float]) -> float:
    """Cash + mark-to-market of open positions."""
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

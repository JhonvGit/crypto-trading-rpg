"""
Simulator com limites reais da Binance:
- validate_order: step_size, min_qty, min_notional
- Fees: taker 0.10% nas duas pontas (market order, Binance Tier 0)
- Atualiza stats do agente (total_fees_paid, total_pnl_gross, total_trades, win_trades)
- Persiste notional e fee_rate no trade para auditoria
"""
import logging
import math
from db.database import get_db
from engine.market import SYMBOL_LIMITS, FEE_TAKER, validate_order

log = logging.getLogger("simulator")


async def execute_trade(agent_id: str, symbol: str, side: str,
                        qty: float, price: float) -> dict:
    """
    Executa trade com validação completa de limites Binance.
    Returns: {ok, pnl, pnl_pct, fee, notional, reason}
    """
    limits   = SYMBOL_LIMITS.get(symbol, {})
    fee_rate = FEE_TAKER  # taker para market orders (simplificação)

    async with get_db() as db:
        row = await (await db.execute(
            "SELECT balance_usd, generation FROM agents WHERE id=? AND status='active'",
            (agent_id,)
        )).fetchone()
        if not row:
            return {"ok": False, "pnl": 0, "fee": 0, "notional": 0, "reason": "agent not found"}

        balance    = row["balance_usd"]
        generation = row["generation"] or 1
        pnl        = 0.0
        pnl_pct    = 0.0
        fee_usd    = 0.0

        if side == "BUY":
            # Quanto posso comprar com o balance disponível (considerando fee)
            max_affordable = balance / (price * (1 + fee_rate))
            qty = min(qty, max_affordable * 0.9995)  # margem de segurança

            # Validar e ajustar para step_size/min_qty/min_notional
            qty, err = validate_order(symbol, qty, price)
            if err or qty <= 0:
                return {"ok": False, "pnl": 0, "fee": 0, "notional": 0,
                        "reason": err or "qty inválida após validação"}

            gross_cost = qty * price
            fee_usd    = gross_cost * fee_rate
            total_cost = gross_cost + fee_usd          # débito total do balance

            if total_cost > balance:
                return {"ok": False, "pnl": 0, "fee": 0, "notional": gross_cost,
                        "reason": f"balance insuficiente: ${balance:.4f} < ${total_cost:.4f}"}

            # Preço efetivo (inclui fee de compra para cálculo de P&L correto)
            effective_price = total_cost / qty

            await db.execute(
                "UPDATE agents SET balance_usd = balance_usd - ?, total_fees_paid = total_fees_paid + ? WHERE id=?",
                (total_cost, fee_usd, agent_id)
            )
            await db.execute("""
                INSERT INTO positions(agent_id, symbol, qty, avg_price)
                VALUES(?,?,?,?)
                ON CONFLICT(agent_id, symbol) DO UPDATE SET
                  avg_price = (avg_price * qty + excluded.avg_price * excluded.qty)
                              / (qty + excluded.qty),
                  qty = qty + excluded.qty
            """, (agent_id, symbol, qty, effective_price))

            notional = gross_cost

        elif side == "SELL":
            pos = await (await db.execute(
                "SELECT qty, avg_price FROM positions WHERE agent_id=? AND symbol=?",
                (agent_id, symbol)
            )).fetchone()
            if not pos or pos["qty"] <= 1e-10:
                return {"ok": False, "pnl": 0, "fee": 0, "notional": 0, "reason": "no position"}

            # Limitar à qty disponível e ajustar step_size
            qty = min(qty, pos["qty"])
            qty, err = validate_order(symbol, qty, price)
            if err or qty <= 0:
                # Tentar vender tudo disponível
                qty = pos["qty"]
                qty, err = validate_order(symbol, qty, price)
                if err or qty <= 0:
                    return {"ok": False, "pnl": 0, "fee": 0, "notional": 0,
                            "reason": err or "qty de venda inválida"}

            gross_return = qty * price
            fee_usd      = gross_return * fee_rate
            net_return   = gross_return - fee_usd
            notional     = gross_return

            # P&L líquido: retorno líquido menos custo efetivo de compra
            cost_basis = pos["avg_price"] * qty
            pnl        = net_return - cost_basis
            pnl_pct    = (pnl / cost_basis * 100) if cost_basis > 0 else 0.0

            await db.execute(
                """UPDATE agents SET balance_usd = balance_usd + ?,
                   total_fees_paid = total_fees_paid + ?,
                   total_pnl_gross = total_pnl_gross + ?,
                   total_trades    = total_trades + 1,
                   win_trades      = win_trades + ?
                   WHERE id=?""",
                (net_return, fee_usd, pnl, 1 if pnl > 0 else 0, agent_id)
            )

            new_qty = pos["qty"] - qty
            if new_qty < limits.get("min_qty", 1e-8) * 0.5:
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
            return {"ok": False, "pnl": 0, "fee": 0, "notional": 0, "reason": "side inválido"}

        # Registrar trade completo
        await db.execute("""
            INSERT INTO trades(agent_id, symbol, side, qty, price, notional, fee_rate, fee_usd, pnl, pnl_pct, generation)
            VALUES(?,?,?,?,?,?,?,?,?,?,?)
        """, (agent_id, symbol, side, qty, price, notional, fee_rate, fee_usd, pnl, pnl_pct, generation))

        await db.commit()

    log.info(f"TRADE {agent_id[:12]} {side} {qty:.6f} {symbol} @{price:.4f} "
             f"notional=${notional:.2f} fee=${fee_usd:.4f} pnl=${pnl:.4f} ({pnl_pct:+.2f}%)")
    return {"ok": True, "pnl": pnl, "pnl_pct": pnl_pct, "fee": fee_usd, "notional": notional, "reason": "ok"}


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
            p = prices.get(r["symbol"], 0)
            total += r["qty"] * p
    return total


async def save_snapshot(agent_id: str, total_usd: float):
    async with get_db() as db:
        await db.execute(
            "INSERT INTO snapshots(agent_id, total_usd) VALUES(?,?)",
            (agent_id, total_usd)
        )
        await db.commit()

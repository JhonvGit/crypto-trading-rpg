import re

with open("engine/strategy.py", "r", encoding="utf-8") as f:
    text = f.read()

# Add jev_llm to DEFAULT_GENES
text = text.replace(
    '"rsi":            {"qty_pct_buy": 0.20, "qty_pct_sell": 1.00, "rsi_period": 14, "rsi_buy": 30, "rsi_sell": 70},',
    '"rsi":            {"qty_pct_buy": 0.20, "qty_pct_sell": 1.00, "rsi_period": 14, "rsi_buy": 30, "rsi_sell": 70},\n    "jev_llm":        {"qty_pct_buy": 0.25, "qty_pct_sell": 1.00},'
)

# Insert the async decide_from_jev function
decide_code = """
async def decide_from_jev(agent_id: str, symbol: str, klines: list[dict], price: float, genes: dict, knowledge: list[dict], pos_qty: float, balance: float, http_client) -> dict | None:
    import json
    import re
    from engine.indicators import rsi_wilder, macd_histogram, z_score
    closes = [k["close"] for k in klines]
    if len(closes) < 30:
        return None
        
    rsi_val = rsi_wilder(closes, 14)
    z_val = z_score(closes, 30)

    # Simplified state description to save LLM tokens & time
    state = f"Symbol: {symbol} at ${price:.2f}. RSI(14): {rsi_val:.1f}. Z-Score(30): {z_val:.2f}. Balance: ${balance:.2f}. Pos Qty: {pos_qty:.4f}. Genes: {json.dumps(genes)}"
    prompt = (
        "You are an AI day trader. Read the market state and return ONLY JSON.\\n"
        f"State: {state}\\n"
        "Must return exactly:\\n"
        '{"decision": "BUY", "qty_pct": 25, "reason": "short explanation"} -> or "SELL" or "HOLD"\\n'
    )
    JEV_URL = "http://127.0.0.1:8085/v1/systemone"
    
    try:
        resp = await http_client.post(
            JEV_URL,
            json={"messages": [{"role": "user", "content": prompt}]},
            headers={"Content-Type": "application/json"},
            timeout=3.0  # short timeout to prevent blocking engine loop
        )
        if resp.status_code == 200:
            content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
            match = re.search(r"\\{.*\\}", content, re.DOTALL)
            if match:
                res = json.loads(match.group())
                side = str(res.get("decision", "HOLD")).upper()
                if side in ["BUY", "SELL"]:
                    qty_base = pos_qty if side == "SELL" else (balance / price)
                    qty_pct = float(res.get("qty_pct", 100)) / 100.0
                    return {
                        "side": side,
                        "qty": round(qty_base * qty_pct, 6),
                        "reason": str(res.get("reason", "LLM Strategy decision")),
                        "indicators": {"rsi": rsi_val, "zscore": z_val},
                        "signal_type": "llm",
                    }
    except Exception:
        pass
    return None
"""

# Append at the top (after imports) or at the end
text += "\n" + decide_code + "\n"

with open("engine/strategy.py", "w", encoding="utf-8") as f:
    f.write(text)

print("Patch strategy done")

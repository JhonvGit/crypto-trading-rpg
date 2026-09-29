import math
from .base import BaseAgent


class BollingerAgent(BaseAgent):
    id = "bollinger_agent"
    name = "Lyra Bollinger"
    klass = "Arqueira Volatilidade"
    emoji = "🏹"
    symbols = ["DOGEUSDT", "ADAUSDT"]

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            closes = [c["close"] for c in ohlcv.get(sym, [])]
            if len(closes) < 20:
                continue
            window = closes[-20:]
            mean = sum(window) / 20
            std = math.sqrt(sum((x - mean) ** 2 for x in window) / 20)
            upper = mean + 2 * std
            lower = mean - 2 * std
            price = closes[-1]
            if price < lower:
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.30})
            elif price > upper:
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 1.00})
        return actions

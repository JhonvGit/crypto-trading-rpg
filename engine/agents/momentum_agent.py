from .base import BaseAgent


class MomentumAgent(BaseAgent):
    id = "momentum_agent"
    name = "Thor Momentum"
    klass = "Paladino Tendência"
    emoji = "🛡️"
    symbols = ["XRPUSDT", "AVAXUSDT"]

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            closes = [c["close"] for c in ohlcv.get(sym, [])]
            if len(closes) < 10:
                continue
            momentum = closes[-1] / closes[-10] - 1  # 10-period return
            if momentum > 0.01:
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.20})
            elif momentum < -0.01:
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 1.00})
        return actions

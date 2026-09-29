from .base import BaseAgent


class RSIAgent(BaseAgent):
    id = "rsi_agent"
    name = "Merlin RSI"
    klass = "Mago da Reversão"
    emoji = "🧙"
    symbols = ["BTCUSDT", "ETHUSDT"]

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            candles = ohlcv.get(sym, [])
            closes = [c["close"] for c in candles]
            rsi = self._rsi(closes)
            if rsi < 30:
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.20})
            elif rsi > 70:
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 1.00})
        return actions

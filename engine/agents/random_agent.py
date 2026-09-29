import random
from .base import BaseAgent


class RandomAgent(BaseAgent):
    id = "random_agent"
    name = "Loki Caos"
    klass = "Coringa Aleatório"
    emoji = "🃏"
    symbols = ["LINKUSDT", "DOTUSDT"]

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            roll = random.random()
            if roll < 0.35:
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.15})
            elif roll < 0.55:
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 0.50})
        return actions

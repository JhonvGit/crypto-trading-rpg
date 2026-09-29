from abc import ABC, abstractmethod


class BaseAgent(ABC):
    id: str
    name: str
    klass: str
    emoji: str
    symbols: list[str]
    strategy: str = "adaptive"
    generation: int = 1

    @abstractmethod
    async def decide(self, ohlcv: dict[str, list[dict]]) -> list[dict]:
        """Return list of {"symbol": ..., "side": "BUY"|"SELL", "qty_pct": 0-1}"""
        ...

    def _rsi(self, closes: list[float], period: int = 14) -> float:
        if len(closes) < period + 1:
            return 50.0
        deltas = [closes[i + 1] - closes[i] for i in range(len(closes) - 1)]
        gains = [max(d, 0) for d in deltas[-period:]]
        losses = [abs(min(d, 0)) for d in deltas[-period:]]
        avg_g = sum(gains) / period
        avg_l = sum(losses) / period
        if avg_l == 0:
            return 100.0
        rs = avg_g / avg_l
        return 100 - (100 / (1 + rs))

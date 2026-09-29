from .base import BaseAgent


def _ema(prices: list[float], period: int) -> float:
    k = 2 / (period + 1)
    e = prices[0]
    for p in prices[1:]:
        e = p * k + e * (1 - k)
    return e


class MACDAgent(BaseAgent):
    id = "macd_agent"
    name = "Ragnar MACD"
    klass = "Guerreiro Tendência"
    emoji = "⚔️"
    symbols = ["BNBUSDT", "SOLUSDT"]

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            closes = [c["close"] for c in ohlcv.get(sym, [])]
            if len(closes) < 26:
                continue
            macd_line = _ema(closes, 12) - _ema(closes, 26)
            signal_line = _ema(closes[-9:], 9)
            if macd_line > signal_line:
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.25})
            else:
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 1.00})
        return actions

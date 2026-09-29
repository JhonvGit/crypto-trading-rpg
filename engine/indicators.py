"""Indicadores técnicos inline — sem TA-Lib / pandas."""
from __future__ import annotations

import math


def rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i + 1] - closes[i] for i in range(len(closes) - 1)]
    gains = [max(d, 0.0) for d in deltas[-period:]]
    losses = [abs(min(d, 0.0)) for d in deltas[-period:]]
    avg_g = sum(gains) / period
    avg_l = sum(losses) / period
    if avg_l == 0:
        return 100.0
    rs = avg_g / avg_l
    return 100.0 - (100.0 / (1.0 + rs))


def ema(closes: list[float], period: int) -> float:
    if not closes:
        return 0.0
    k = 2 / (period + 1)
    value = closes[0]
    for c in closes[1:]:
        value = c * k + value * (1 - k)
    return value


def ema_series(closes: list[float], period: int) -> list[float]:
    if not closes:
        return []
    k = 2 / (period + 1)
    out = [closes[0]]
    for c in closes[1:]:
        out.append(c * k + out[-1] * (1 - k))
    return out


def macd(closes: list[float]) -> tuple[float, float]:
    """MACD line e signal (EMA9 da linha MACD)."""
    if len(closes) < 26:
        return 0.0, 0.0
    ema12 = ema_series(closes, 12)
    ema26 = ema_series(closes, 26)
    macd_line = [a - b for a, b in zip(ema12, ema26)]
    signal_series = ema_series(macd_line, 9)
    return macd_line[-1], signal_series[-1]


def zscore(closes: list[float], period: int = 20) -> float:
    if len(closes) < period:
        return 0.0
    window = closes[-period:]
    mean = sum(window) / period
    std = math.sqrt(sum((x - mean) ** 2 for x in window) / period)
    return (closes[-1] - mean) / (std or 1e-9)


def momentum(closes: list[float], period: int = 10) -> float:
    if len(closes) < period or closes[-period] == 0:
        return 0.0
    return (closes[-1] / closes[-period] - 1.0) * 100.0


def sma(closes: list[float], period: int) -> float:
    if len(closes) < period:
        return closes[-1] if closes else 0.0
    return sum(closes[-period:]) / period

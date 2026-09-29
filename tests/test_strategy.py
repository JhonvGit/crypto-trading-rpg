import pytest

from engine.strategy import (
    decide_from_klines,
    knowledge_bias,
    resolve_strategy,
)


def candles(n=60, start=100.0, delta=0.0, vol=1000.0):
    out = []
    price = start
    for i in range(n):
        price = start + delta * i
        out.append({
            "ts": i * 60_000,
            "open": price,
            "high": price + 0.4,
            "low": price - 0.4,
            "close": price,
            "volume": vol,
        })
    return out


def test_resolve_strategy_from_portuguese_class():
    assert resolve_strategy({"class": "Scalper Agressivo"}) == "scalping"
    assert resolve_strategy({"class": "Reversão à Média"}) == "mean_reversion"
    assert resolve_strategy({"strategy": "macd", "class": "foo"}) == "macd"


def test_knowledge_ignores_zero_pnl_buys():
    kb = [
        {"side": "BUY", "outcome_pnl": 0, "confidence": 0.9, "author_id": "a"},
        {"side": "BUY", "outcome_pnl": 0, "confidence": 0.9, "author_id": "b"},
        {"side": "SELL", "outcome_pnl": 1.2, "confidence": 0.8, "author_id": "c"},
    ]
    buys, sells, bias = knowledge_bias(kb)
    assert buys == 0
    assert sells == 1
    assert bias == -1


def test_mean_reversion_buys_on_low_zscore():
    klines = candles(40, start=100.0, delta=-1.0)
    d = decide_from_klines("mean_reversion", klines, klines[-1]["close"], balance=50)
    assert d is not None
    assert d["side"] == "BUY"
    assert d["strategy"] == "mean_reversion"


def test_sell_without_position_is_none():
    klines = candles(40, start=50.0, delta=1.0)
    d = decide_from_klines("mean_reversion", klines, klines[-1]["close"],
                           position_qty=0, balance=50)
    assert d is None


def test_rsi_buys_oversold():
    klines = candles(40, start=200.0, delta=-4.0)
    d = decide_from_klines("rsi", klines, klines[-1]["close"], balance=50)
    assert d is not None
    assert d["side"] == "BUY"


def test_scalping_uses_momentum():
    klines = candles(30, start=100.0, delta=0.5)
    d = decide_from_klines("scalping", klines, klines[-1]["close"], balance=50)
    assert d is not None
    assert d["side"] == "BUY"
    assert d["signal_type"] == "momentum_up"

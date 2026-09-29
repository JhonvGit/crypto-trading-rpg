import pytest
from engine.market import ALL_SYMBOLS, get_ohlcv, get_price, validate_order


@pytest.mark.asyncio
async def test_get_price_btcusdt():
    price = await get_price("BTCUSDT")
    assert isinstance(price, float) and price > 1000, f"Unexpected price: {price}"


@pytest.mark.asyncio
async def test_get_ohlcv_returns_candles():
    candles = await get_ohlcv("BTCUSDT", limit=50)
    assert len(candles) == 50
    assert all(k in candles[0] for k in ("open", "high", "low", "close", "volume"))


@pytest.mark.asyncio
async def test_cache_works():
    p1 = await get_price("ETHUSDT")
    p2 = await get_price("ETHUSDT")
    assert p1 == p2


def test_validate_order_rejects_tiny_notional():
    qty, err = validate_order("BTCUSDT", 0.0000001, 50000.0)
    assert qty == 0.0
    assert err


def test_all_symbols_unique():
    assert len(ALL_SYMBOLS) == len(set(ALL_SYMBOLS))
    assert "MATICUSDT" not in ALL_SYMBOLS
    assert "FTMUSDT" not in ALL_SYMBOLS

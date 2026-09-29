import pytest
import asyncio
from engine.market import get_price, get_ohlcv


@pytest.mark.asyncio
async def test_get_price_btcusdt():
    price = await get_price("BTCUSDT")
    assert isinstance(price, float) and price > 1000, f"Unexpected price: {price}"


@pytest.mark.asyncio
async def test_get_ohlcv_returns_50_candles():
    candles = await get_ohlcv("BTCUSDT", limit=50)
    assert len(candles) == 50
    assert all(k in candles[0] for k in ("open", "high", "low", "close", "volume"))


@pytest.mark.asyncio
async def test_cache_works():
    """Second call should return cached result instantly."""
    p1 = await get_price("ETHUSDT")
    p2 = await get_price("ETHUSDT")
    assert p1 == p2

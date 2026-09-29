import pytest
import aiosqlite
import db.database as ddb
from db.database import init_db
from engine.simulator import execute_trade, portfolio_value


@pytest.fixture(autouse=True)
async def setup_db(tmp_path):
    ddb.DB_PATH = tmp_path / "test.db"
    await init_db()
    async with aiosqlite.connect(ddb.DB_PATH) as db:
        await db.execute("""
            INSERT INTO agents(id, name, class, emoji, strategy, balance_usd, status)
            VALUES('a1', 'Test Hero', 'Mago', '🧙', 'rsi', 100.0, 'active')
        """)
        await db.commit()
    yield


@pytest.mark.asyncio
async def test_buy_reduces_balance():
    r = await execute_trade("a1", "BTCUSDT", "BUY", 0.001, 50000.0)
    assert r["ok"], r["reason"]
    v = await portfolio_value("a1", {"BTCUSDT": 50000.0})
    assert v < 100.0  # fee de compra
    assert r["fee"] > 0


@pytest.mark.asyncio
async def test_portfolio_value_near_cash_after_buy_at_same_price():
    await execute_trade("a1", "BTCUSDT", "BUY", 0.001, 50000.0)
    v = await portfolio_value("a1", {"BTCUSDT": 50000.0})
    assert abs(v - 100.0) < 1.0  # fee ~0.05


@pytest.mark.asyncio
async def test_sell_without_position_fails():
    r = await execute_trade("a1", "BTCUSDT", "SELL", 0.001, 50000.0)
    assert not r["ok"]
    assert r["reason"] == "no position"


@pytest.mark.asyncio
async def test_buy_then_sell_roundtrip():
    buy = await execute_trade("a1", "BTCUSDT", "BUY", 0.001, 50000.0)
    assert buy["ok"], buy["reason"]
    r = await execute_trade("a1", "BTCUSDT", "SELL", 0.001, 55000.0)
    assert r["ok"], r["reason"]
    assert r["pnl"] > 0


@pytest.mark.asyncio
async def test_unknown_agent_fails():
    r = await execute_trade("ghost", "BTCUSDT", "BUY", 0.001, 50000.0)
    assert not r["ok"]
    assert r["reason"] == "agent not found"

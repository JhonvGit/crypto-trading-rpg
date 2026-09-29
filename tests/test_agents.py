import pytest


def fake_ohlcv(n=50, start=100.0, delta=-0.5):
    """Generate n candles with a linear trend."""
    return [
        {
            "ts": i * 60000,
            "open": start + delta * i,
            "high": start + delta * i + 0.5,
            "low":  start + delta * i - 0.5,
            "close": start + delta * i,
            "volume": 1000.0,
        }
        for i in range(n)
    ]


@pytest.mark.asyncio
async def test_all_agents_return_list():
    from engine.agents import ALL_AGENTS
    for agent in ALL_AGENTS:
        ohlcv = {sym: fake_ohlcv() for sym in agent.symbols}
        result = await agent.decide(ohlcv)
        assert isinstance(result, list), f"{agent.id} did not return a list"
        for action in result:
            assert action["side"] in ("BUY", "SELL"), f"Invalid side: {action}"
            assert 0 < action["qty_pct"] <= 1, f"Invalid qty_pct: {action}"


@pytest.mark.asyncio
async def test_rsi_agent_buys_on_oversold():
    """A strong downtrend should trigger RSI < 30 -> BUY."""
    from engine.agents.rsi_agent import RSIAgent
    agent = RSIAgent()
    # Strong downtrend: RSI will be very low
    ohlcv = {sym: fake_ohlcv(50, 200.0, -3.0) for sym in agent.symbols}
    actions = await agent.decide(ohlcv)
    buys = [a for a in actions if a["side"] == "BUY"]
    assert len(buys) > 0, "RSI agent should BUY on oversold"


@pytest.mark.asyncio
async def test_random_agent_returns_valid_actions():
    from engine.agents.random_agent import RandomAgent
    agent = RandomAgent()
    ohlcv = {sym: fake_ohlcv() for sym in agent.symbols}
    # Run many times to get coverage of random paths
    results = []
    for _ in range(20):
        results.extend(await agent.decide(ohlcv))
    for action in results:
        assert action["side"] in ("BUY", "SELL")
        assert 0 < action["qty_pct"] <= 1

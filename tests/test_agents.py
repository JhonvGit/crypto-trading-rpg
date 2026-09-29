import pytest

from engine.agents import ALL_AGENTS
from engine.market import ALL_SYMBOLS
from engine.strategy import DEFAULT_GENES, resolve_strategy


def fake_ohlcv(n=50, start=100.0, delta=-0.5):
    return [
        {
            "ts": i * 60000,
            "open": start + delta * i,
            "high": start + delta * i + 0.5,
            "low": start + delta * i - 0.5,
            "close": start + delta * i,
            "volume": 1000.0,
        }
        for i in range(n)
    ]


@pytest.mark.asyncio
async def test_all_agents_return_list():
    for agent in ALL_AGENTS:
        ohlcv = {sym: fake_ohlcv() for sym in agent.symbols}
        result = await agent.decide(ohlcv)
        assert isinstance(result, list), f"{agent.id} did not return a list"
        for action in result:
            assert action["side"] in ("BUY", "SELL"), f"Invalid side: {action}"
            assert 0 < action["qty_pct"] <= 1, f"Invalid qty_pct: {action}"


def test_all_agents_have_live_symbols_and_strategy():
    assert len(ALL_AGENTS) >= 14
    seen = set()
    for agent in ALL_AGENTS:
        assert agent.id not in seen
        seen.add(agent.id)
        strat = getattr(agent, "strategy", None) or resolve_strategy({"class": agent.klass})
        assert strat in DEFAULT_GENES, f"{agent.id} strategy={strat}"
        for sym in agent.symbols:
            assert sym in ALL_SYMBOLS, f"{agent.id} usa {sym} fora de ALL_SYMBOLS"


@pytest.mark.asyncio
async def test_rsi_agent_buys_on_oversold():
    from engine.agents.rsi_agent import RSIAgent
    agent = RSIAgent()
    ohlcv = {sym: fake_ohlcv(50, 200.0, -3.0) for sym in agent.symbols}
    actions = await agent.decide(ohlcv)
    buys = [a for a in actions if a["side"] == "BUY"]
    assert len(buys) > 0, "RSI agent should BUY on oversold"


@pytest.mark.asyncio
async def test_random_agent_returns_valid_actions():
    from engine.agents.random_agent import RandomAgent
    agent = RandomAgent()
    ohlcv = {sym: fake_ohlcv() for sym in agent.symbols}
    results = []
    for _ in range(20):
        results.extend(await agent.decide(ohlcv))
    for action in results:
        assert action["side"] in ("BUY", "SELL")
        assert 0 < action["qty_pct"] <= 1

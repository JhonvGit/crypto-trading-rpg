import re

with open("engine/agents/initial_agents.py", "r", encoding="utf-8") as f:
    text = f.read()

new_agent_code = """
class JevLLMAgent(BaseAgent):
    id = "jev_100"
    name = "Jev System One"
    klass = "Operador LLM"
    emoji = "🧠"
    strategy = "jev_llm"
    symbols = ["BTCUSDT", "ETHUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        return []

# Lista de todos os agentes iniciais
INITIAL_AGENTS = [
    ScalpingAgent(),
    ConservativeAgent(),
    VolumeAgent(),
    TrendFollowerAgent(),
    MeanReversionAgent(),
    BreakoutAgent(),
    GridTradingAgent(),
    VolatilityAgent(),
    PatternAgent(),
    AdaptiveAgent(),
    MACDSpecialistAgent(),
    BollingerBandAgent(),
    DCAAgent(),
    ClassicRSIAgent(),
    JevLLMAgent(),
]
"""

text = re.sub(r"# Lista de todos os agentes iniciais\nINITIAL_AGENTS = \[.*\]", new_agent_code, text, flags=re.DOTALL)

with open("engine/agents/initial_agents.py", "w", encoding="utf-8") as f:
    f.write(text)

print("Patch agents done")

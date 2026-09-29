from .rsi_agent import RSIAgent
from .macd_agent import MACDAgent
from .bollinger_agent import BollingerAgent
from .momentum_agent import MomentumAgent
from .random_agent import RandomAgent

ALL_AGENTS = [RSIAgent(), MACDAgent(), BollingerAgent(), MomentumAgent(), RandomAgent()]

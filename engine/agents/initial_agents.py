"""
10 agentes iniciais diversos para o sistema evolutivo.
Cada um tem estratégia, símbolos e personalidade únicos.
"""
from .base import BaseAgent
import random
import math


class ScalpingAgent(BaseAgent):
    id = "scalper_001"
    name = "Flash Scalper"
    klass = "Scalper Agressivo"
    emoji = "⚡"
    strategy = "scalping"
    symbols = ["BTCUSDT", "ETHUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            candles = ohlcv.get(sym, [])
            if len(candles) < 10:
                continue
            closes = [c["close"] for c in candles]
            # Scalping: momentum de curto prazo
            momentum = (closes[-1] / closes[-5] - 1) * 100
            if momentum > 0.3:
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.15})
            elif momentum < -0.3:
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 0.80})
        return actions


class ConservativeAgent(BaseAgent):
    id = "conservative_002"
    name = "Safe Harbor"
    klass = "Conservador"
    emoji = "🛡️"
    strategy = "conservative"
    symbols = ["BNBUSDT", "SOLUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            candles = ohlcv.get(sym, [])
            closes = [c["close"] for c in candles]
            rsi = self._rsi(closes, 21)  # RSI mais longo
            if rsi < 25:  # Muito oversold
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.10})
            elif rsi > 80:  # Muito overbought
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 1.00})
        return actions


class VolumeAgent(BaseAgent):
    id = "volume_003"
    name = "Volume Hunter"
    klass = "Caçador de Volume"
    emoji = "📊"
    strategy = "volume"
    symbols = ["DOGEUSDT", "SHIBUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            candles = ohlcv.get(sym, [])
            if len(candles) < 20:
                continue
            volumes = [c["volume"] for c in candles]
            avg_vol = sum(volumes[-20:]) / 20
            recent_vol = volumes[-1]
            
            # Spike de volume
            if recent_vol > avg_vol * 2.0:
                closes = [c["close"] for c in candles]
                if closes[-1] > closes[-2]:
                    actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.25})
                else:
                    actions.append({"symbol": sym, "side": "SELL", "qty_pct": 0.60})
        return actions


class TrendFollowerAgent(BaseAgent):
    id = "trendfollower_004"
    name = "Trend Rider"
    klass = "Seguidor de Tendência"
    emoji = "🌊"
    strategy = "trend"
    symbols = ["ADAUSDT", "DOTUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            candles = ohlcv.get(sym, [])
            if len(candles) < 50:
                continue
            closes = [c["close"] for c in candles]
            sma20 = sum(closes[-20:]) / 20
            sma50 = sum(closes[-50:]) / 50
            
            if sma20 > sma50 and closes[-1] > sma20:
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.22})
            elif sma20 < sma50 and closes[-1] < sma20:
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 1.00})
        return actions


class MeanReversionAgent(BaseAgent):
    id = "meanrev_005"
    name = "Reverso"
    klass = "Reversão à Média"
    emoji = "🔄"
    strategy = "mean_reversion"
    symbols = ["XRPUSDT", "LINKUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            candles = ohlcv.get(sym, [])
            if len(candles) < 30:
                continue
            closes = [c["close"] for c in candles]
            mean = sum(closes[-30:]) / 30
            std = math.sqrt(sum((x - mean)**2 for x in closes[-30:]) / 30)
            z_score = (closes[-1] - mean) / std if std > 0 else 0
            
            if z_score < -1.5:
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.20})
            elif z_score > 1.5:
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 0.90})
        return actions


class BreakoutAgent(BaseAgent):
    id = "breakout_006"
    name = "Breakout King"
    klass = "Rompedor"
    emoji = "💥"
    strategy = "breakout"
    symbols = ["AVAXUSDT", "POLUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            candles = ohlcv.get(sym, [])
            if len(candles) < 20:
                continue
            highs = [c["high"] for c in candles[-20:]]
            lows = [c["low"] for c in candles[-20:]]
            closes = [c["close"] for c in candles]
            
            resistance = max(highs[:-1])
            support = min(lows[:-1])
            
            if closes[-1] > resistance:
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.30})
            elif closes[-1] < support:
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 1.00})
        return actions


class GridTradingAgent(BaseAgent):
    id = "grid_007"
    name = "Grid Master"
    klass = "Trader de Grade"
    emoji = "🎯"
    strategy = "grid"
    symbols = ["LTCUSDT", "BCHUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            candles = ohlcv.get(sym, [])
            if len(candles) < 50:
                continue
            closes = [c["close"] for c in candles]
            high50 = max(closes[-50:])
            low50 = min(closes[-50:])
            grid_size = (high50 - low50) / 10
            
            # Comprar nos níveis baixos da grade
            if closes[-1] < low50 + grid_size * 3:
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.12})
            # Vender nos níveis altos
            elif closes[-1] > high50 - grid_size * 3:
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 0.50})
        return actions


class VolatilityAgent(BaseAgent):
    id = "volatility_008"
    name = "Volatility Surfer"
    klass = "Surfista da Volatilidade"
    emoji = "🌪️"
    strategy = "volatility"
    symbols = ["ATOMUSDT", "NEARUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            candles = ohlcv.get(sym, [])
            if len(candles) < 20:
                continue
            closes = [c["close"] for c in candles]
            highs = [c["high"] for c in candles[-20:]]
            lows = [c["low"] for c in candles[-20:]]
            
            # ATR simplificado
            ranges = [highs[i] - lows[i] for i in range(len(highs))]
            atr = sum(ranges) / len(ranges)
            avg_price = sum(closes[-20:]) / 20
            volatility_pct = (atr / avg_price) * 100
            
            # Alta volatilidade = oportunidade
            if volatility_pct > 3.0:
                rsi = self._rsi(closes)
                if rsi < 40:
                    actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.18})
                elif rsi > 60:
                    actions.append({"symbol": sym, "side": "SELL", "qty_pct": 0.70})
        return actions


class PatternAgent(BaseAgent):
    id = "pattern_009"
    name = "Pattern Pro"
    klass = "Reconhecedor de Padrões"
    emoji = "🔮"
    strategy = "pattern"
    symbols = ["UNIUSDT", "AAVEUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            candles = ohlcv.get(sym, [])
            if len(candles) < 10:
                continue
            closes = [c["close"] for c in candles[-10:]]
            
            # Padrão de 3 velas consecutivas
            if closes[-1] > closes[-2] > closes[-3]:
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.20})
            elif closes[-1] < closes[-2] < closes[-3]:
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 0.85})
        return actions


class AdaptiveAgent(BaseAgent):
    id = "adaptive_010"
    name = "Adaptive Ensemble"
    klass = "Adaptativo"
    emoji = "🧠"
    strategy = "adaptive"
    symbols = ["SUIUSDT", "INJUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        actions = []
        for sym in self.symbols:
            candles = ohlcv.get(sym, [])
            if len(candles) < 30:
                continue
            closes = [c["close"] for c in candles]
            
            # Combina múltiplos indicadores com pesos
            rsi = self._rsi(closes)
            momentum = (closes[-1] / closes[-10] - 1) * 100
            
            mean = sum(closes[-20:]) / 20
            std = math.sqrt(sum((x - mean)**2 for x in closes[-20:]) / 20)
            z_score = (closes[-1] - mean) / std if std > 0 else 0
            
            # Score composto
            score = 0
            if rsi < 35:
                score += 2
            if momentum > 1.0:
                score += 1
            if z_score < -1.0:
                score += 1
            
            if score >= 3:
                actions.append({"symbol": sym, "side": "BUY", "qty_pct": 0.25})
            elif score <= -2:
                actions.append({"symbol": sym, "side": "SELL", "qty_pct": 0.80})
        
        return actions


class MACDSpecialistAgent(BaseAgent):
    id = "macd_011"
    name = "MACD Cross"
    klass = "Especialista MACD"
    emoji = "📶"
    strategy = "macd"
    symbols = ["ETHUSDT", "SOLUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        return []


class BollingerBandAgent(BaseAgent):
    id = "bollinger_012"
    name = "Band Walker"
    klass = "Bandas de Bollinger"
    emoji = "📏"
    strategy = "bollinger"
    symbols = ["BNBUSDT", "ADAUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        return []


class DCAAgent(BaseAgent):
    id = "dca_013"
    name = "Dollar Cost"
    klass = "DCA Disciplinado"
    emoji = "🧱"
    strategy = "dca"
    symbols = ["BTCUSDT", "ETHUSDT"]
    generation = 1

    async def decide(self, ohlcv: dict) -> list[dict]:
        return []


class ClassicRSIAgent(BaseAgent):
    id = "rsi_014"
    name = "RSI Pulse"
    klass = "RSI Clássico"
    emoji = "💓"
    strategy = "rsi"
    symbols = ["DOGEUSDT", "PEPEUSDT"]
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
]

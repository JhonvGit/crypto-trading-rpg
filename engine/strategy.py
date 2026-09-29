"""
Dispatcher de estratégias rule-based.

Não há LLM no ciclo de trade. Cada agente opera com indicadores
técnicos + genes (thresholds / tamanho de ordem). Knowledge pool
só enviesa a decisão quando há SELLs lucrativos de outros agentes.
"""
from __future__ import annotations

from typing import Any, Optional

from engine.indicators import macd, momentum, rsi, sma, zscore
from engine.market import FEE_TAKER

# class (PT, como gravado no DB) → chave de estratégia
CLASS_TO_STRATEGY = {
    "scalper agressivo": "scalping",
    "conservador": "conservative",
    "caçador de volume": "volume",
    "seguidor de tendência": "trend",
    "reversão à média": "mean_reversion",
    "rompedor": "breakout",
    "trader de grade": "grid",
    "surfista da volatilidade": "volatility",
    "reconhecedor de padrões": "pattern",
    "adaptativo": "adaptive",
    "especialista macd": "macd",
    "bandas de bollinger": "bollinger",
    "dca disciplinado": "dca",
    "rsi clássico": "rsi",
}

DEFAULT_GENES = {
    "scalping":       {"qty_pct_buy": 0.15, "qty_pct_sell": 0.80, "mom_period": 5, "mom_th": 0.3},
    "conservative":   {"qty_pct_buy": 0.10, "qty_pct_sell": 1.00, "rsi_period": 21, "rsi_buy": 25, "rsi_sell": 80},
    "volume":         {"qty_pct_buy": 0.25, "qty_pct_sell": 0.60, "vol_mult": 2.0},
    "trend":          {"qty_pct_buy": 0.22, "qty_pct_sell": 1.00, "fast": 20, "slow": 50},
    "mean_reversion": {"qty_pct_buy": 0.20, "qty_pct_sell": 0.90, "z_period": 30, "z_th": 1.5},
    "breakout":       {"qty_pct_buy": 0.30, "qty_pct_sell": 1.00, "lookback": 20},
    "grid":           {"qty_pct_buy": 0.12, "qty_pct_sell": 0.50, "lookback": 50, "levels": 10, "band": 3},
    "volatility":     {"qty_pct_buy": 0.18, "qty_pct_sell": 0.70, "atr_pct": 3.0, "rsi_buy": 40, "rsi_sell": 60},
    "pattern":        {"qty_pct_buy": 0.20, "qty_pct_sell": 0.85, "bars": 3},
    "adaptive":       {"qty_pct_buy": 0.25, "qty_pct_sell": 0.80, "rsi_buy": 35, "rsi_sell": 65, "score_th": 3},
    "macd":           {"qty_pct_buy": 0.22, "qty_pct_sell": 1.00},
    "bollinger":      {"qty_pct_buy": 0.25, "qty_pct_sell": 0.90, "bb_period": 20, "bb_k": 2.0},
    "dca":            {"qty_pct_buy": 0.08, "qty_pct_sell": 0.40, "rsi_buy": 42, "rsi_sell": 72},
    "rsi":            {"qty_pct_buy": 0.20, "qty_pct_sell": 1.00, "rsi_period": 14, "rsi_buy": 30, "rsi_sell": 70},
}


def resolve_strategy(agent: dict) -> str:
    raw = (agent.get("strategy") or "").strip().lower()
    if raw in DEFAULT_GENES:
        return raw
    klass = (agent.get("class") or "").strip().lower()
    if klass in CLASS_TO_STRATEGY:
        return CLASS_TO_STRATEGY[klass]
    if "scalp" in klass:
        return "scalping"
    if "conserv" in klass:
        return "conservative"
    if "volume" in klass:
        return "volume"
    if "tend" in klass or "trend" in klass:
        return "trend"
    if "média" in klass or "media" in klass or "mean" in klass:
        return "mean_reversion"
    if "romp" in klass or "break" in klass:
        return "breakout"
    if "grade" in klass or "grid" in klass:
        return "grid"
    if "volat" in klass:
        return "volatility"
    if "padrão" in klass or "padrao" in klass or "pattern" in klass:
        return "pattern"
    if "macd" in klass:
        return "macd"
    if "bollinger" in klass or "banda" in klass:
        return "bollinger"
    if "dca" in klass:
        return "dca"
    if "rsi" in klass:
        return "rsi"
    return "adaptive"


import math

def merge_genes(strategy: str, genes: Optional[dict]) -> dict:
    base = dict(DEFAULT_GENES.get(strategy, DEFAULT_GENES["adaptive"]))
    if isinstance(genes, dict):
        for k, v in genes.items():
            if k in base and isinstance(v, (int, float)) and not isinstance(v, bool):
                if not math.isfinite(v):
                    continue
                
                # Validation limits
                if "period" in k:
                    v = max(2, min(500, int(v)))
                elif k in ["qty_pct", "stop_loss_pct", "take_profit_pct", "threshold", "oversold", "overbought", "z_threshold"]:
                    v = max(0, v) # no negative percent or threshold
                elif k == "fast":
                    if "slow" in genes and isinstance(genes["slow"], (int, float)) and v >= genes["slow"]:
                        v = max(1, int(genes["slow"] - 1)) # fast must be < slow
                base[k] = v
                
        if "fast" in base and "slow" in base and base["fast"] >= base["slow"]:
            base["fast"] = max(1, int(base["slow"] - 1))
            
    return base


def knowledge_bias(knowledge: list[dict]) -> tuple[int, int, int]:
    """Conta autores distintos de SELL lucrativo vs prejuízo. Ignora BUY (pnl=0)."""
    buys, sells = set(), set()
    for k in knowledge:
        side = (k.get("side") or "").upper()
        pnl = float(k.get("outcome_pnl") or k.get("pnl") or 0)
        conf = float(k.get("confidence") or 0)
        author = k.get("author_id") or k.get("author") or id(k)
        if conf < 0.55 or pnl <= 0:
            continue
        if side == "BUY":
            buys.add(author)
        elif side == "SELL":
            sells.add(author)
    return len(buys), len(sells), len(buys) - len(sells)


def decide_from_klines(
    strategy: str,
    klines: list[dict],
    price: float,
    genes: Optional[dict] = None,
    knowledge: Optional[list[dict]] = None,
    position_qty: float = 0.0,
    balance: float = 0.0,
) -> Optional[dict[str, Any]]:
    if price <= 0 or len(klines) < 20:
        return None

    g = merge_genes(strategy, genes)
    closes = [k["close"] for k in klines]
    highs = [k["high"] for k in klines]
    lows = [k["low"] for k in klines]
    volumes = [k.get("volume", 0.0) for k in klines]

    rsi14 = rsi(closes, 14)
    macd_v, macd_s = macd(closes)
    zs = zscore(closes, 20)
    mom = momentum(closes, 10)
    kb_buys, kb_sells, kb_bias = knowledge_bias(knowledge or [])

    indicators = {
        "rsi": round(rsi14, 2),
        "macd": round(macd_v - macd_s, 5),
        "momentum": round(mom, 3),
        "zscore": round(zs, 3),
        "price": price,
    }

    side = None
    signal_type = "none"
    reason_pt = ""
    qty_pct = 0.0

    if strategy == "scalping":
        period = max(2, int(g.get("mom_period", 5)))
        m = momentum(closes, period)
        th = float(g.get("mom_th", 0.3))
        indicators["momentum"] = round(m, 3)
        if m > th:
            side, signal_type, reason_pt = "BUY", "momentum_up", f"Momentum-{period} +{m:.2f}% > {th}%"
            qty_pct = g["qty_pct_buy"]
        elif m < -th:
            side, signal_type, reason_pt = "SELL", "momentum_down", f"Momentum-{period} {m:.2f}% < -{th}%"
            qty_pct = g["qty_pct_sell"]

    elif strategy == "conservative":
        period = max(5, int(g.get("rsi_period", 21)))
        r = rsi(closes, period)
        indicators["rsi"] = round(r, 2)
        if r < float(g.get("rsi_buy", 25)):
            side, signal_type, reason_pt = "BUY", "rsi_oversold", f"RSI-{period}={r:.0f} extremo oversold"
            qty_pct = g["qty_pct_buy"]
        elif r > float(g.get("rsi_sell", 80)):
            side, signal_type, reason_pt = "SELL", "rsi_overbought", f"RSI-{period}={r:.0f} extremo overbought"
            qty_pct = g["qty_pct_sell"]

    elif strategy == "volume":
        if len(volumes) >= 20:
            avg_vol = sum(volumes[-20:]) / 20
            recent = volumes[-1]
            mult = float(g.get("vol_mult", 2.0))
            indicators["vol_ratio"] = round(recent / avg_vol, 2) if avg_vol else 0
            if avg_vol > 0 and recent > avg_vol * mult:
                if closes[-1] > closes[-2]:
                    side, signal_type, reason_pt = "BUY", "volume_spike", f"Volume {recent/avg_vol:.1f}x média, preço subindo"
                    qty_pct = g["qty_pct_buy"]
                else:
                    side, signal_type, reason_pt = "SELL", "volume_spike", f"Volume {recent/avg_vol:.1f}x média, preço caindo"
                    qty_pct = g["qty_pct_sell"]

    elif strategy in ("trend", "trend_follower"):
        fast = max(5, int(g.get("fast", 20)))
        slow = max(fast + 1, int(g.get("slow", 50)))
        if len(closes) >= slow:
            s_fast, s_slow = sma(closes, fast), sma(closes, slow)
            indicators["sma_fast"] = round(s_fast, 6)
            indicators["sma_slow"] = round(s_slow, 6)
            if s_fast > s_slow and closes[-1] > s_fast:
                side, signal_type, reason_pt = "BUY", "golden_cross", f"SMA{fast}>{slow} e close acima da rápida"
                qty_pct = g["qty_pct_buy"]
            elif s_fast < s_slow and closes[-1] < s_fast:
                side, signal_type, reason_pt = "SELL", "death_cross", f"SMA{fast}<{slow} e close abaixo da rápida"
                qty_pct = g["qty_pct_sell"]

    elif strategy == "mean_reversion":
        period = max(5, int(g.get("z_period", 30)))
        th = float(g.get("z_th", 1.5))
        z = zscore(closes, period)
        indicators["zscore"] = round(z, 3)
        if z < -th:
            side, signal_type, reason_pt = "BUY", "zscore_low", f"Z={z:.2f}σ < -{th} (reversão)"
            qty_pct = g["qty_pct_buy"]
        elif z > th:
            side, signal_type, reason_pt = "SELL", "zscore_high", f"Z=+{z:.2f}σ > {th} (reversão)"
            qty_pct = g["qty_pct_sell"]

    elif strategy == "breakout":
        lookback = max(5, int(g.get("lookback", 20)))
        window_h = highs[-lookback:]
        window_l = lows[-lookback:]
        res = max(window_h[:-1]) if len(window_h) > 1 else price
        sup = min(window_l[:-1]) if len(window_l) > 1 else price
        if price > res:
            side, signal_type, reason_pt = "BUY", "breakout", f"Rompimento ${res:.4g}→${price:.4g}"
            qty_pct = g["qty_pct_buy"]
        elif price < sup:
            side, signal_type, reason_pt = "SELL", "breakdown", f"Perdeu suporte ${sup:.4g}"
            qty_pct = g["qty_pct_sell"]

    elif strategy == "grid":
        lookback = max(10, int(g.get("lookback", 50)))
        levels = max(4, int(g.get("levels", 10)))
        band = max(1, int(g.get("band", 3)))
        w = closes[-min(lookback, len(closes)):]
        high50, low50 = max(w), min(w)
        grid_size = (high50 - low50) / levels if levels else 0
        if grid_size > 0 and price < low50 + grid_size * band:
            side, signal_type, reason_pt = "BUY", "grid_low", f"Grid baixa ${price:.4g}<banda"
            qty_pct = g["qty_pct_buy"]
        elif grid_size > 0 and price > high50 - grid_size * band:
            side, signal_type, reason_pt = "SELL", "grid_high", f"Grid alta ${price:.4g}>banda"
            qty_pct = g["qty_pct_sell"]

    elif strategy == "volatility":
        window = min(20, len(highs))
        ranges = [highs[-window + i] - lows[-window + i] for i in range(window)]
        atr = sum(ranges) / window
        avg_price = sma(closes, window) or price
        vol_pct = (atr / avg_price) * 100 if avg_price else 0
        indicators["atr_pct"] = round(vol_pct, 3)
        if vol_pct > float(g.get("atr_pct", 3.0)):
            if rsi14 < float(g.get("rsi_buy", 40)):
                side, signal_type, reason_pt = "BUY", "volatility_entry", f"ATR {vol_pct:.2f}% RSI={rsi14:.0f}"
                qty_pct = g["qty_pct_buy"]
            elif rsi14 > float(g.get("rsi_sell", 60)):
                side, signal_type, reason_pt = "SELL", "volatility_exit", f"ATR {vol_pct:.2f}% RSI={rsi14:.0f}"
                qty_pct = g["qty_pct_sell"]

    elif strategy in ("pattern", "swing", "swing_trader"):
        bars = max(3, int(g.get("bars", 3)))
        if len(closes) >= bars:
            ups = all(closes[-i] > closes[-i - 1] for i in range(1, bars))
            downs = all(closes[-i] < closes[-i - 1] for i in range(1, bars))
            if ups:
                side, signal_type, reason_pt = "BUY", "three_bar_up", f"{bars} closes consecutivos de alta"
                qty_pct = g["qty_pct_buy"]
            elif downs:
                side, signal_type, reason_pt = "SELL", "three_bar_down", f"{bars} closes consecutivos de baixa"
                qty_pct = g["qty_pct_sell"]

    elif strategy == "macd":
        if macd_v > macd_s and mom > 0:
            side, signal_type, reason_pt = "BUY", "macd_cross", f"MACD cruzou para cima ({macd_v - macd_s:.4f})"
            qty_pct = g["qty_pct_buy"]
        elif macd_v < macd_s and mom < 0:
            side, signal_type, reason_pt = "SELL", "macd_cross", "MACD abaixo do sinal"
            qty_pct = g["qty_pct_sell"]

    elif strategy == "bollinger":
        period = max(10, int(g.get("bb_period", 20)))
        k = float(g.get("bb_k", 2.0))
        if len(closes) >= period:
            window = closes[-period:]
            mean = sum(window) / period
            std = (sum((x - mean) ** 2 for x in window) / period) ** 0.5
            upper, lower = mean + k * std, mean - k * std
            indicators["bb_upper"] = round(upper, 6)
            indicators["bb_lower"] = round(lower, 6)
            if price < lower:
                side, signal_type, reason_pt = "BUY", "bb_lower", f"Preço abaixo da banda inferior ({k}σ)"
                qty_pct = g["qty_pct_buy"]
            elif price > upper:
                side, signal_type, reason_pt = "SELL", "bb_upper", f"Preço acima da banda superior ({k}σ)"
                qty_pct = g["qty_pct_sell"]

    elif strategy == "dca":
        r = rsi(closes, 14)
        indicators["rsi"] = round(r, 2)
        if r < float(g.get("rsi_buy", 42)):
            side, signal_type, reason_pt = "BUY", "dca_regular", f"DCA RSI={r:.0f} < {g.get('rsi_buy', 42)}"
            qty_pct = g["qty_pct_buy"]
        elif r > float(g.get("rsi_sell", 72)) and position_qty > 0:
            side, signal_type, reason_pt = "SELL", "dca_trim", f"DCA realiza RSI={r:.0f}"
            qty_pct = g["qty_pct_sell"]

    elif strategy == "rsi":
        period = max(5, int(g.get("rsi_period", 14)))
        r = rsi(closes, period)
        indicators["rsi"] = round(r, 2)
        if r < float(g.get("rsi_buy", 30)):
            side, signal_type, reason_pt = "BUY", "rsi_oversold", f"RSI-{period}={r:.0f} oversold"
            qty_pct = g["qty_pct_buy"]
        elif r > float(g.get("rsi_sell", 70)):
            side, signal_type, reason_pt = "SELL", "rsi_overbought", f"RSI-{period}={r:.0f} overbought"
            qty_pct = g["qty_pct_sell"]

    else:  # adaptive
        score = 0
        if rsi14 < float(g.get("rsi_buy", 35)):
            score += 2
        if mom > 1.0:
            score += 1
        if zs < -1.0:
            score += 1
        if rsi14 > float(g.get("rsi_sell", 65)):
            score -= 2
        if mom < -1.0:
            score -= 1
        if zs > 1.0:
            score -= 1
        if kb_bias >= 3:
            score += 2
        elif kb_bias <= -3:
            score -= 2
        indicators["score"] = score
        th = int(g.get("score_th", 3))
        if score >= th:
            side, signal_type, reason_pt = "BUY", "adaptive_score", f"Score {score}≥{th} (RSI/mom/Z + comunidade)"
            qty_pct = g["qty_pct_buy"]
        elif score <= -th:
            side, signal_type, reason_pt = "SELL", "adaptive_score", f"Score {score}≤{-th}"
            qty_pct = g["qty_pct_sell"]

    # Override comunitário só se a estratégia própria não disparou
    if side is None and abs(kb_bias) >= 4:
        side = "BUY" if kb_bias > 0 else "SELL"
        signal_type = "community_override"
        reason_pt = f"Rede: {abs(kb_bias)} sinais lucrativos de {'compra' if side == 'BUY' else 'venda'}"
        qty_pct = g.get("qty_pct_buy" if side == "BUY" else "qty_pct_sell", 0.2)

    if side is None:
        return None
    if side == "SELL" and position_qty <= 1e-12:
        return None

    qty_pct = max(0.01, min(float(qty_pct), 1.0))
    if side == "BUY":
        qty = (balance * qty_pct) / (price * (1 + FEE_TAKER)) if price > 0 else 0.0
    else:
        qty = position_qty * qty_pct

    if qty <= 0:
        return None

    return {
        "side": side,
        "qty": qty,
        "qty_pct": qty_pct,
        "reason": reason_pt,
        "signal_type": signal_type,
        "indicators": indicators,
        "kb_buys": kb_buys,
        "kb_sells": kb_sells,
        "strategy": strategy,
    }

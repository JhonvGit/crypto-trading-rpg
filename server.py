import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from db.database import get_db, init_db
from engine import engine_loop, stop_engine, portfolio_value, ALL_SYMBOLS, AGENT_LAST_DECISION, SHARED_KNOWLEDGE
from engine.market import ALL_SYMBOLS as _ALL_SYMBOLS, SYMBOL_LIMITS
from engine.market import get_price

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("server")

connected_ws: list[WebSocket] = []
INITIAL_BALANCE = 50.0  # Gen1 começa com $50

AGENT_PROFILES = {
    "scalper_001": {
        "strategy_desc": "Scalping de curto prazo baseado em momentum de 5 velas. Opera em janelas de minutos com entradas pequenas e frequentes para capturar micro-tendências do mercado.",
        "ml_tech": "Momentum Indicator (janela 5-candles): variação percentual close[-1]/close[-5]. Threshold ±0.3% para entrada.",
        "risk": "Agressivo — 15% do capital por entrada. Alta frequência de trades.",
        "indicators": ["Momentum-5", "Close Delta %"],
        "ml_model": "Rule-based com herança genética. Genes evolutivos ajustam threshold e qty_pct ao longo das gerações.",
    },
    "conservative_002": {
        "strategy_desc": "Compra apenas em oversold extremo (RSI21 < 25) e vende em overbought (RSI21 > 80). Prioriza sobrevivência sobre lucro rápido.",
        "ml_tech": "RSI de 21 períodos. Janela longa para eliminar ruído de curto prazo — só opera em extremos reais.",
        "risk": "Conservador — 10% por entrada. Raras operações, alta convicção.",
        "indicators": ["RSI-21"],
        "ml_model": "RSI clássico. Pressão evolutiva seleciona thresholds ótimos por geração.",
    },
    "volume_003": {
        "strategy_desc": "Detecta spikes de volume 2x acima da média de 20 períodos e opera na direção do preço. Volume é o principal indicador de intenção institucional.",
        "ml_tech": "Volume Spike: ratio vol_atual/avg_vol_20. Confirmação direcional por close vs close[-1].",
        "risk": "Moderado — 25% compra, 60% venda. Inativo sem spike.",
        "indicators": ["Volume SMA-20", "Volume Ratio", "Price Delta"],
        "ml_model": "Anomaly detection de volume. Threshold 2.0x refinado por herança evolutiva.",
    },
    "trendfollower_004": {
        "strategy_desc": "Golden Cross / Death Cross de SMA20 e SMA50. Compra quando tendência confirma, vende no cruzamento inverso.",
        "ml_tech": "Dual SMA Crossover: SMA20 > SMA50 AND close > SMA20 = BUY. Filtra mercado lateral.",
        "risk": "Moderado-agressivo — 22% por entrada. Excelente em tendências, ruim em ranging.",
        "indicators": ["SMA-20", "SMA-50"],
        "ml_model": "Trend-following clássico. Genes ajustam períodos das médias por geração.",
    },
    "meanrev_005": {
        "strategy_desc": "Reversão estatística à média com Z-score. Opera quando desvio > 1.5σ da média de 30 candles.",
        "ml_tech": "Z-score = (price - mean30) / std30. Detecta extremos com precisão matemática.",
        "risk": "Moderado — 20% compra, 90% venda. Melhor em lateral, ruim em breakouts.",
        "indicators": ["Z-Score-30", "Mean-30", "StdDev-30"],
        "ml_model": "Estatística paramétrica. Threshold ±1.5σ ajustado por evolução.",
    },
    "breakout_006": {
        "strategy_desc": "Rompimento de resistência/suporte dos últimos 20 períodos. Entra forte na direção do breakout.",
        "ml_tech": "Resistência = max(highs[-20:-1]), Suporte = min(lows[-20:-1]). Breakout = close > resistência.",
        "risk": "Agressivo — 30% compra. Alta recompensa, risco de falsos rompimentos.",
        "indicators": ["Resistance-20", "Support-20"],
        "ml_model": "Price action puro. Evolução afina lookback e % de entrada.",
    },
    "grid_007": {
        "strategy_desc": "Grade de preços sobre o range de 50 períodos dividido em 10 níveis. Market making sintético: compra baixo, vende alto sistematicamente.",
        "ml_tech": "Grid: range = (max50 - min50) / 10. BUY < min50 + 3 grids, SELL > max50 - 3 grids.",
        "risk": "Conservador — 12% compra, 50% venda. Excelente em mercado lateral.",
        "indicators": ["High-50", "Low-50", "Grid Levels x10"],
        "ml_model": "Grid determinístico. Genes aprendem tamanho ótimo de grade por geração.",
    },
    "volatility_008": {
        "strategy_desc": "Surfa em alta volatilidade (ATR > 3%). Usa RSI como filtro direcional — só entra quando vol é alta E RSI confirma.",
        "ml_tech": "ATR-20: mean(high-low, 20 candles). Volatilidade% = ATR/preço_médio*100. RSI-14 como filtro.",
        "risk": "Moderado — 18% compra, 70% venda. Completamente inativo em vol baixa.",
        "indicators": ["ATR-20", "RSI-14", "Volatility %"],
        "ml_model": "ATR + RSI compostos. Threshold de vol (3%) ajustado por pressão evolutiva.",
    },
    "pattern_009": {
        "strategy_desc": "Reconhecimento de 3-bar patterns: 3 closes consecutivos de alta = compra, 3 de baixa = venda. Simples e robusto.",
        "ml_tech": "3-Bar: closes[-1] > closes[-2] > closes[-3] (bullish) e inverso (bearish). Zero falsos positivos por ruído aleatório.",
        "risk": "Moderado — 20% compra, 85% venda. Dependente de momentum consistente.",
        "indicators": ["3-Bar Close Pattern"],
        "ml_model": "Pattern matching candlestick. Genes controlam comprimento do padrão.",
    },
    "adaptive_010": {
        "strategy_desc": "Ensemble multi-indicador com composite score: RSI + Momentum-10 + Z-score em votação ponderada. Exige score ≥ 3 para operar — máxima convicção.",
        "ml_tech": "Score: RSI<35 (+2pts), Momentum10>1% (+1pt), Z-score<-1σ (+1pt). Compra apenas com score≥3. Multi-confirmação obrigatória.",
        "risk": "Moderado-conservador — 25% com multi-confirmação, 0% sem sinal forte.",
        "indicators": ["RSI-14", "Momentum-10", "Z-Score-20", "Composite Score"],
        "ml_model": "Ensemble voting. Mais sofisticado = melhor material genético para evolução.",
    },
}


async def get_agents_data(full_trades: int = 5) -> list[dict]:
    async with get_db() as db:
        prices: dict[str, float] = {}
        for sym in ALL_SYMBOLS:
            try:
                prices[sym] = await get_price(sym)
            except Exception:
                pass

        agents_rows = await (await db.execute(
            "SELECT * FROM agents ORDER BY status, balance_usd DESC"
        )).fetchall()

        result = []
        for row in agents_rows:
            d = dict(row)
            syms_raw = d.get("symbols") or '["BTCUSDT"]'
            try: syms = __import__("json").loads(syms_raw)
            except Exception: syms = ["BTCUSDT"]
            val = await portfolio_value(d["id"], prices)

            initial = d.get("initial_balance") or INITIAL_BALANCE
            pnl_usd = val - initial
            pnl_pct = (pnl_usd / initial) * 100

            trades = await (await db.execute(
                "SELECT * FROM trades WHERE agent_id=? ORDER BY ts DESC LIMIT ?",
                (d["id"], full_trades)
            )).fetchall()

            history = await (await db.execute(
                "SELECT total_usd, ts FROM snapshots WHERE agent_id=? ORDER BY ts DESC LIMIT 60",
                (d["id"],)
            )).fetchall()

            positions = await (await db.execute(
                "SELECT symbol, qty, avg_price FROM positions WHERE agent_id=?",
                (d["id"],)
            )).fetchall()

            stats = await (await db.execute(
                "SELECT COUNT(*) as cnt, "
                "COALESCE(SUM(fee_usd), 0) as total_fee, "
                "SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins "
                "FROM trades WHERE agent_id=?",
                (d["id"],)
            )).fetchone()

            total_trades = stats["cnt"] if stats else 0
            wins = stats["wins"] if stats else 0
            win_rate = round((wins / total_trades * 100), 1) if total_trades > 0 else 0.0

            profile = AGENT_PROFILES.get(d["id"], {})

            pos_list = []
            for p in positions:
                pd = dict(p)
                cur_price = prices.get(pd["symbol"], pd["avg_price"])
                pos_pnl_pct = (cur_price / pd["avg_price"] - 1) * 100 if pd["avg_price"] > 0 else 0
                pos_list.append({
                    "symbol": pd["symbol"],
                    "qty": round(pd["qty"], 8),
                    "avg_price": round(pd["avg_price"], 6),
                    "cur_price": round(cur_price, 6),
                    "pnl_pct": round(pos_pnl_pct, 2),
                    "value_usd": round(pd["qty"] * cur_price, 4),
                })

            result.append({
                "id": d["id"],
                "name": d["name"],
                "class": d["class"],
                "emoji": d["emoji"],
                "generation": d.get("generation", 1),
                "status": d.get("status", "active"),
                "balance": round(d["balance_usd"], 4),
                "initial_balance": round(initial, 2),
                "value": round(val, 4),
                "pnl_usd": round(pnl_usd, 4),
                "pnl_pct": round(pnl_pct, 2),
                "total_fees": round(stats["total_fee"] if stats else 0, 4),
                "symbols": syms,
                "total_trades": total_trades,
                "win_rate": win_rate,
                "trades": [dict(t) for t in trades],
                "history": [{"v": h["total_usd"], "ts": h["ts"]} for h in reversed(list(history))],
                "positions": pos_list,
                "strategy_desc": profile.get("strategy_desc", ""),
                "ml_tech": profile.get("ml_tech", ""),
                "risk": profile.get("risk", ""),
                "indicators": profile.get("indicators", []),
                "ml_model": profile.get("ml_model", ""),
                "last_decision": AGENT_LAST_DECISION.get(d["id"]),
            })

        result.sort(key=lambda x: (0 if x["status"] == "active" else 1, -x["value"]))
    return result


async def broadcaster():
    while True:
        await asyncio.sleep(5)
        if not connected_ws:
            continue
        try:
            data = await get_agents_data()
            payload = json.dumps(data)
        except Exception as e:
            log.warning(f"Broadcaster error: {e}")
            continue
        dead = []
        for ws in connected_ws:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            if ws in connected_ws:
                connected_ws.remove(ws)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with get_db() as db:
        from engine.agents.initial_agents import INITIAL_AGENTS
        for agent_obj in INITIAL_AGENTS:
            syms_json = __import__("json").dumps(agent_obj.symbols)
            await db.execute("""
                INSERT OR IGNORE INTO agents(id, name, class, emoji,
                    generation, initial_balance, balance_usd, status, symbols)
                VALUES(?,?,?,?,1,?,?,'active',?)
            """, (agent_obj.id, agent_obj.name,
                  getattr(agent_obj, "klass", "trader"),
                  agent_obj.emoji, INITIAL_BALANCE, INITIAL_BALANCE, syms_json))
        await db.commit()
    engine_loop()
    bcast_task = asyncio.create_task(broadcaster())
    yield
    stop_engine()
    bcast_task.cancel()


app = FastAPI(title="Crypto Trading RPG", lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def index():
    return FileResponse("static/index-office.html")


@app.get("/classic")
async def classic_view():
    return FileResponse("static/index.html")


@app.get("/api/agents")
async def api_agents():
    return await get_agents_data()


@app.get("/api/agents/{agent_id}")
async def api_agent_detail(agent_id: str):
    """Detalhes completos: todos os trades, padrões aprendidos, evolução, ML."""
    async with get_db() as db:
        row = await (await db.execute(
            "SELECT * FROM agents WHERE id=?", (agent_id,)
        )).fetchone()
        if not row:
            return JSONResponse({"error": "not found"}, status_code=404)

        prices: dict[str, float] = {}
        for sym in ALL_SYMBOLS:
            try:
                prices[sym] = await get_price(sym)
            except Exception:
                pass

        d = dict(row)
        val = await portfolio_value(agent_id, prices)
        initial = d.get("initial_balance") or INITIAL_BALANCE
        pnl_usd = val - initial
        pnl_pct = (pnl_usd / initial) * 100

        trades = await (await db.execute(
            "SELECT * FROM trades WHERE agent_id=? ORDER BY ts DESC LIMIT 200",
            (agent_id,)
        )).fetchall()

        history = await (await db.execute(
            "SELECT total_usd, ts FROM snapshots WHERE agent_id=? ORDER BY ts DESC LIMIT 500",
            (agent_id,)
        )).fetchall()

        positions = await (await db.execute(
            "SELECT symbol, qty, avg_price FROM positions WHERE agent_id=?",
            (agent_id,)
        )).fetchall()

        stats = await (await db.execute(
            "SELECT COUNT(*) as cnt, "
            "COALESCE(SUM(fee_usd), 0) as total_fee, "
            "COALESCE(SUM(pnl), 0) as total_pnl, "
            "SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins "
            "FROM trades WHERE agent_id=?",
            (agent_id,)
        )).fetchone()

        evo_rows = await (await db.execute(
            "SELECT * FROM evolution_log WHERE bankrupt_id=? ORDER BY ts DESC",
            (agent_id,)
        )).fetchall()

        patterns = await (await db.execute(
            "SELECT symbol, side, signal_type, outcome_pnl, outcome_pct, confidence FROM knowledge_pool WHERE author_id=? ORDER BY confidence DESC LIMIT 10",
            (agent_id,)
        )).fetchall()

        total_trades = stats["cnt"] if stats else 0
        wins = stats["wins"] if stats else 0
        win_rate = round((wins / total_trades * 100), 1) if total_trades > 0 else 0.0

        profile = AGENT_PROFILES.get(agent_id, {})
        d = dict(row)
        syms_raw2 = d.get("symbols") or '["BTCUSDT"]'
        try: syms2 = __import__("json").loads(syms_raw2)
        except Exception: syms2 = ["BTCUSDT"]

        pos_list = []
        for p in positions:
            pd = dict(p)
            cur_price = prices.get(pd["symbol"], pd["avg_price"])
            pos_pnl_pct = (cur_price / pd["avg_price"] - 1) * 100 if pd["avg_price"] > 0 else 0
            pos_list.append({
                "symbol": pd["symbol"],
                "qty": round(pd["qty"], 8),
                "avg_price": round(pd["avg_price"], 6),
                "cur_price": round(cur_price, 6),
                "pnl_pct": round(pos_pnl_pct, 2),
                "value_usd": round(pd["qty"] * cur_price, 4),
            })

        return {
            "id": agent_id,
            "name": d["name"],
            "class": d["class"],
            "emoji": d["emoji"],
            "generation": d.get("generation", 1),
            "status": d.get("status", "active"),
            "initial_balance": round(initial, 2),
            "balance": round(d["balance_usd"], 4),
            "value": round(val, 4),
            "pnl_usd": round(pnl_usd, 4),
            "pnl_pct": round(pnl_pct, 2),
            "total_fees": round(stats["total_fee"] if stats else 0, 4),
            "total_pnl_gross": round(stats["total_pnl"] if stats else 0, 4),
            "total_trades": total_trades,
            "win_rate": win_rate,
            "symbols": syms2,
            "strategy_desc": profile.get("strategy_desc", ""),
            "ml_tech": profile.get("ml_tech", ""),
            "ml_model": profile.get("ml_model", ""),
            "risk": profile.get("risk", ""),
            "indicators": profile.get("indicators", []),
            "trades": [dict(t) for t in trades],
            "history": [{"v": h["total_usd"], "ts": h["ts"]} for h in reversed(list(history))],
            "positions": pos_list,
            "evolution": [dict(e) for e in evo_rows],
            "knowledge": [dict(p) for p in patterns],
        }


@app.get("/api/leaderboard")
async def api_leaderboard():
    agents = await get_agents_data()
    return [
        {"rank": i + 1, "id": a["id"], "name": a["name"], "emoji": a["emoji"],
         "value": a["value"], "pnl_pct": a["pnl_pct"], "pnl_usd": a["pnl_usd"],
         "generation": a["generation"], "win_rate": a["win_rate"],
         "total_trades": a["total_trades"], "total_fees": a["total_fees"]}
        for i, a in enumerate(agents)
    ]


@app.get("/api/decisions")
async def api_decisions():
    """Retorna a última decisão de cada agente com indicadores usados."""
    from engine import AGENT_LAST_DECISION
    return AGENT_LAST_DECISION


@app.get("/api/knowledge")
async def api_knowledge():
    """Retorna o knowledge pool compartilhado entre agentes."""
    from engine import SHARED_KNOWLEDGE
    return SHARED_KNOWLEDGE[-50:]


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    connected_ws.append(ws)
    try:
        data = await get_agents_data()
        await ws.send_text(json.dumps(data))
    except Exception:
        pass
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if ws in connected_ws:
            connected_ws.remove(ws)

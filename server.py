import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from db.database import get_db, init_db
from engine import engine_loop, portfolio_value, ALL_SYMBOLS, ALL_AGENTS
from engine.market import get_price

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("server")

connected_ws: list[WebSocket] = []


async def get_agents_data() -> list[dict]:
    """Fetch all agent states, positions, trades and history."""
    async with get_db() as db:
        prices: dict[str, float] = {}
        for sym in ALL_SYMBOLS:
            try:
                prices[sym] = await get_price(sym)
            except Exception:
                pass

        agents_rows = await (await db.execute("SELECT * FROM agents")).fetchall()
        result = []
        for row in agents_rows:
            agent_obj = next((a for a in ALL_AGENTS if a.id == row["id"]), None)
            syms = agent_obj.symbols if agent_obj else []
            val = await portfolio_value(row["id"], prices)
            trades = await (await db.execute(
                "SELECT * FROM trades WHERE agent_id=? ORDER BY ts DESC LIMIT 5",
                (row["id"],)
            )).fetchall()
            history = await (await db.execute(
                "SELECT total_usd, ts FROM snapshots WHERE agent_id=? ORDER BY ts DESC LIMIT 60",
                (row["id"],)
            )).fetchall()
            result.append({
                "id": row["id"],
                "name": row["name"],
                "class": row["class"],
                "emoji": row["emoji"],
                "generation": dict(row).get("generation", 1),
                "balance": round(row["balance_usd"], 4),
                "value": round(val, 4),
                "pnl_pct": round((val / 100.0 - 1) * 100, 2),
                "symbols": syms,
                "trades": [dict(t) for t in trades],
                "history": [{"v": h["total_usd"], "ts": h["ts"]} for h in reversed(list(history))],
            })
        result.sort(key=lambda x: x["value"], reverse=True)
    return result


async def broadcaster():
    """Every 5s push fresh agent data to all connected WebSocket clients."""
    while True:
        await asyncio.sleep(5)
        if not connected_ws:
            continue
        try:
            import json
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
        for agent in ALL_AGENTS:
            # Adicionar campos de geração para agentes iniciais
            generation = getattr(agent, 'generation', 1)
            await db.execute("""
                INSERT OR IGNORE INTO agents(id, name, class, emoji, strategy, generation, balance_usd, status)
                VALUES(?,?,?,?,?,?,100.0,'active')
            """, (agent.id, agent.name, agent.klass, agent.emoji, agent.id, generation))
        await db.commit()
    loop_task = asyncio.create_task(engine_loop(interval_seconds=30))
    bcast_task = asyncio.create_task(broadcaster())
    yield
    loop_task.cancel()
    bcast_task.cancel()


app = FastAPI(title="Crypto RPG Trading Arena", lifespan=lifespan)
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


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    connected_ws.append(ws)
    # Send initial data immediately
    try:
        import json
        data = await get_agents_data()
        await ws.send_text(json.dumps(data))
    except Exception:
        pass
    try:
        while True:
            await ws.receive_text()  # keepalive ping
    except WebSocketDisconnect:
        if ws in connected_ws:
            connected_ws.remove(ws)

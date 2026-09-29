# ⚔️ Crypto RPG Trading Arena

Multi-agent crypto trading simulation where 5 "heroes" each run a different strategy on real Binance market data, starting with **$100 fictitious capital** each.

## Heroes

| Hero | Class | Strategy | Pairs |
|------|-------|----------|-------|
| 🧙 Merlin RSI | Mago da Reversão | RSI mean-reversion | BTC, ETH |
| ⚔️ Ragnar MACD | Guerreiro Tendência | MACD crossover | BNB, SOL |
| 🏹 Lyra Bollinger | Arqueira Volatilidade | Bollinger Bands | DOGE, ADA |
| 🛡️ Thor Momentum | Paladino Tendência | Price momentum | XRP, AVAX |
| 🃏 Loki Caos | Coringa Aleatório | Random walk | LINK, DOT |

## Features

- Real Binance public OHLCV data (no API key needed)
- Simulated trades — no real money, no real orders
- WebSocket dashboard auto-refreshes every 5s
- RPG-style hero cards with HP bars
- Live leaderboard + portfolio chart
- Trades feed per hero

## Stack

- **Backend:** Python 3 + FastAPI + aiosqlite
- **Frontend:** Vanilla HTML/CSS/JS + Canvas
- **Data:** Binance REST API (public endpoints)
- **Storage:** SQLite

## Quick Start

```bash
cd /root/trading-rpg
python3 -m venv venv
venv/bin/pip install -r requirements.txt
./run.sh
```

Then open: http://localhost:8090

## Run Tests

```bash
venv/bin/pytest tests/ -v
```

## Architecture

```
server.py           FastAPI app + WebSocket broadcaster
engine/
  __init__.py       Main loop (run_tick every 30s)
  market.py         Binance OHLCV fetcher (5s cache)
  simulator.py      Portfolio simulator (BUY/SELL/P&L)
  agents/
    base.py         BaseAgent ABC
    rsi_agent.py    Merlin
    macd_agent.py   Ragnar
    bollinger_agent.py  Lyra
    momentum_agent.py   Thor
    random_agent.py     Loki
db/
  schema.sql        SQLite schema
  database.py       aiosqlite helpers
static/
  index.html        SPA
  style.css         Dark RPG theme
  app.js            WS client + Canvas renderer
```

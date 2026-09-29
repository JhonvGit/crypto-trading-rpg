CREATE TABLE IF NOT EXISTS agents (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    class       TEXT NOT NULL,
    emoji       TEXT NOT NULL,
    strategy    TEXT NOT NULL,
    balance_usd REAL NOT NULL DEFAULT 100.0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id    TEXT NOT NULL,
    symbol      TEXT NOT NULL,
    qty         REAL NOT NULL DEFAULT 0.0,
    avg_price   REAL NOT NULL DEFAULT 0.0,
    UNIQUE(agent_id, symbol)
);

CREATE TABLE IF NOT EXISTS trades (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id    TEXT NOT NULL,
    symbol      TEXT NOT NULL,
    side        TEXT NOT NULL,
    qty         REAL NOT NULL,
    price       REAL NOT NULL,
    pnl         REAL NOT NULL DEFAULT 0.0,
    ts          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id    TEXT NOT NULL,
    total_usd   REAL NOT NULL,
    ts          DATETIME DEFAULT CURRENT_TIMESTAMP
);

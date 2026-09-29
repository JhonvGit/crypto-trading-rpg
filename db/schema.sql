CREATE TABLE IF NOT EXISTS agents (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    class           TEXT NOT NULL,
    emoji           TEXT NOT NULL,
    strategy        TEXT NOT NULL,
    generation      INTEGER NOT NULL DEFAULT 1,
    parent_ids      TEXT,
    initial_balance REAL NOT NULL DEFAULT 50.0,
    balance_usd     REAL NOT NULL DEFAULT 50.0,
    total_fees_paid REAL NOT NULL DEFAULT 0.0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    eliminated_at   DATETIME,
    status          TEXT NOT NULL DEFAULT 'active'
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
    side        TEXT NOT NULL,       -- BUY | SELL
    qty         REAL NOT NULL,
    price       REAL NOT NULL,
    pnl         REAL NOT NULL DEFAULT 0.0,
    fee         REAL NOT NULL DEFAULT 0.0,   -- fee em USD pago neste trade
    ts          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id    TEXT NOT NULL,
    total_usd   REAL NOT NULL,
    ts          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learned_patterns (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id        TEXT NOT NULL,
    pattern_type    TEXT NOT NULL,
    symbol          TEXT NOT NULL,
    indicator       TEXT NOT NULL,
    threshold_low   REAL,
    threshold_high  REAL,
    action          TEXT NOT NULL,
    success_count   INTEGER DEFAULT 0,
    fail_count      INTEGER DEFAULT 0,
    avg_pnl         REAL DEFAULT 0.0,
    confidence      REAL DEFAULT 0.5,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jev_analysis (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id    TEXT NOT NULL,
    generation  INTEGER NOT NULL,
    analysis    TEXT NOT NULL,
    recommendations TEXT NOT NULL,
    score       REAL NOT NULL,
    ts          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evolution_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    eliminated_id   TEXT NOT NULL,
    new_agent_id    TEXT NOT NULL,
    parent_ids      TEXT NOT NULL,
    generation      INTEGER NOT NULL,
    reason          TEXT NOT NULL,
    inherited_patterns TEXT,
    ts              DATETIME DEFAULT CURRENT_TIMESTAMP
);

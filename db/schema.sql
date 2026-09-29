-- ═══════════════════════════════════════════════════════════
-- Crypto Trading RPG — Schema completo v3
-- Inclui: limites reais Binance, fees precisos, knowledge pool
-- ═══════════════════════════════════════════════════════════

-- Agentes (suportam múltiplas gerações)
CREATE TABLE IF NOT EXISTS agents (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    class             TEXT DEFAULT 'trader',
    emoji             TEXT DEFAULT '🤖',
    status            TEXT DEFAULT 'active',    -- active | eliminated
    generation        INTEGER DEFAULT 1,
    parent_ids        TEXT DEFAULT '[]',        -- JSON array de IDs pais
    genes             TEXT DEFAULT '{}',        -- JSON: parâmetros herdados
    strategy          TEXT DEFAULT 'adaptive',  -- chave do dispatcher (scalping, trend, ...)
    symbols           TEXT DEFAULT '["BTCUSDT"]', -- JSON array: multi-asset
    balance_usd       REAL DEFAULT 50.0,
    initial_balance   REAL DEFAULT 50.0,
    -- Métricas acumuladas
    total_trades      INTEGER DEFAULT 0,
    win_trades        INTEGER DEFAULT 0,
    total_fees_paid   REAL DEFAULT 0.0,         -- soma de todos os fees (USD)
    total_pnl_gross   REAL DEFAULT 0.0,         -- soma dos PnLs de venda
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    eliminated_at     DATETIME
);

-- Posições abertas (mark-to-market em tempo real)
CREATE TABLE IF NOT EXISTS positions (
    agent_id   TEXT NOT NULL,
    symbol     TEXT NOT NULL,
    qty        REAL NOT NULL,
    avg_price  REAL NOT NULL,               -- preço efetivo (inclui fee de compra)
    opened_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (agent_id, symbol)
);

-- Trades individuais com auditoria completa de fee
CREATE TABLE IF NOT EXISTS trades (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id    TEXT NOT NULL,
    symbol      TEXT NOT NULL,
    side        TEXT NOT NULL,              -- BUY | SELL
    qty         REAL NOT NULL,
    price       REAL NOT NULL,
    notional    REAL NOT NULL DEFAULT 0,    -- qty * price (valor bruto em USD)
    fee_rate    REAL NOT NULL DEFAULT 0.001, -- taxa aplicada (0.001 = 0.10%)
    fee_usd     REAL NOT NULL DEFAULT 0,    -- fee em USD para este trade
    pnl         REAL DEFAULT 0,             -- P&L líquido (apenas em SELL)
    pnl_pct     REAL DEFAULT 0,             -- P&L % sobre custo (apenas em SELL)
    generation  INTEGER DEFAULT 1,
    ts          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Snapshots de portfolio para gráfico de performance
CREATE TABLE IF NOT EXISTS snapshots (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id  TEXT NOT NULL,
    total_usd REAL NOT NULL,
    ts        DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Pool: lições aprendidas, trocadas entre agentes
CREATE TABLE IF NOT EXISTS knowledge_pool (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id   TEXT NOT NULL,              -- agente que gerou o conhecimento
    symbol      TEXT NOT NULL,
    side        TEXT NOT NULL,
    signal_type TEXT NOT NULL,              -- rsi_oversold | macd_cross | breakout | etc
    indicators  TEXT DEFAULT '{}',          -- JSON: {rsi, macd, momentum, zscore}
    outcome_pnl REAL DEFAULT 0,            -- P&L do trade que gerou esse knowledge
    outcome_pct REAL DEFAULT 0,
    confidence  REAL DEFAULT 0.5,          -- 0-1, aumenta com acertos
    generation  INTEGER DEFAULT 1,
    ts          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Log de aprendizado cruzado (qual agente leu qual knowledge)
CREATE TABLE IF NOT EXISTS knowledge_usage (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    reader_id   TEXT NOT NULL,
    knowledge_id INTEGER NOT NULL,
    acted       INTEGER DEFAULT 0,         -- 0=leu apenas, 1=agiu com base nisso
    ts          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Log de evolução genética
CREATE TABLE IF NOT EXISTS evolution_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    bankrupt_id   TEXT NOT NULL,
    child_ids     TEXT DEFAULT '[]',       -- JSON array
    generation    INTEGER NOT NULL,
    reason        TEXT DEFAULT 'bankruptcy',
    balance_at_death REAL DEFAULT 0,
    ts            DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cache de análises JEV (para não chamar todo ciclo)
CREATE TABLE IF NOT EXISTS jev_analysis (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id   TEXT NOT NULL,
    symbol     TEXT NOT NULL,
    side       TEXT,
    confidence REAL DEFAULT 0,
    rationale  TEXT DEFAULT '',
    ts         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_trades_agent  ON trades(agent_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol, ts DESC);
CREATE INDEX IF NOT EXISTS idx_snap_agent    ON snapshots(agent_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_kp_symbol     ON knowledge_pool(symbol, ts DESC);
CREATE INDEX IF NOT EXISTS idx_kp_author     ON knowledge_pool(author_id);

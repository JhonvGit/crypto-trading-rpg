import aiosqlite
import pathlib
from contextlib import asynccontextmanager

DB_PATH = pathlib.Path(__file__).parent.parent / "trading.db"
SCHEMA = pathlib.Path(__file__).parent / "schema.sql"

# Colunas adicionadas depois do schema inicial (CREATE TABLE IF NOT EXISTS não altera tabelas).
_AGENT_MIGRATIONS = {
    "strategy": "TEXT DEFAULT 'adaptive'",
    "genes": "TEXT DEFAULT '{}'",
    "symbols": "TEXT DEFAULT '[\"BTCUSDT\"]'",
    "generation": "INTEGER DEFAULT 1",
    "parent_ids": "TEXT DEFAULT '[]'",
    "status": "TEXT DEFAULT 'active'",
    "initial_balance": "REAL DEFAULT 50.0",
    "total_trades": "INTEGER DEFAULT 0",
    "win_trades": "INTEGER DEFAULT 0",
    "total_fees_paid": "REAL DEFAULT 0.0",
    "total_pnl_gross": "REAL DEFAULT 0.0",
    "eliminated_at": "DATETIME",
}


@asynccontextmanager
async def get_db():
    """Async context manager that yields a fresh aiosqlite connection."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA foreign_keys=ON")
        yield db


async def _migrate(db: aiosqlite.Connection):
    cur = await db.execute("PRAGMA table_info(agents)")
    cols = {row[1] for row in await cur.fetchall()}
    if not cols:
        return
    for name, decl in _AGENT_MIGRATIONS.items():
        if name not in cols:
            await db.execute(f"ALTER TABLE agents ADD COLUMN {name} {decl}")


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA journal_mode=WAL")
        await db.executescript(SCHEMA.read_text())
        await _migrate(db)
        await db.commit()

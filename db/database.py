import aiosqlite
import pathlib
from contextlib import asynccontextmanager

DB_PATH = pathlib.Path(__file__).parent.parent / "trading.db"
SCHEMA = pathlib.Path(__file__).parent / "schema.sql"


@asynccontextmanager
async def get_db():
    """Async context manager that yields a fresh aiosqlite connection."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.executescript(SCHEMA.read_text())
        await db.commit()

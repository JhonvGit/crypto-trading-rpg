import json
import pytest
import aiosqlite
import db.database as ddb
from db.database import init_db
from engine.evolution import check_bankruptcies_and_evolve


@pytest.fixture(autouse=True)
async def setup_db(tmp_path):
    ddb.DB_PATH = tmp_path / "evo.db"
    await init_db()
    async with aiosqlite.connect(ddb.DB_PATH) as db:
        for i, (aid, name, klass, strat, bal) in enumerate([
            ("rich_1", "Alpha", "Scalper Agressivo", "scalping", 80.0),
            ("rich_2", "Beta", "Conservador", "conservative", 70.0),
            ("broke_1", "Zeta", "Rompedor", "breakout", 0.4),
        ]):
            await db.execute(
                """INSERT INTO agents(id, name, class, emoji, strategy, genes, symbols,
                   balance_usd, initial_balance, status, generation)
                   VALUES(?,?,?,?,?,?,?,?,?, 'active', 1)""",
                (aid, name, klass, "🤖", strat, "{}", json.dumps(["BTCUSDT"]),
                 bal, 50.0),
            )
        await db.commit()
    yield


@pytest.mark.asyncio
async def test_bankruptcy_spawns_child_with_schema_columns():
    prices = {"BTCUSDT": 50000.0}
    created = await check_bankruptcies_and_evolve(prices)
    assert created, "deveria criar um filho"
    child = created[0]
    async with aiosqlite.connect(ddb.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        row = await (await db.execute("SELECT * FROM agents WHERE id=?", (child["id"],))).fetchone()
        assert row is not None
        assert row["status"] == "active"
        assert row["strategy"] in ("scalping", "conservative", "breakout", "adaptive")
        assert float(row["balance_usd"]) == 50.0
        dead = await (await db.execute("SELECT status FROM agents WHERE id='broke_1'")).fetchone()
        assert dead is not None and dead[0] == "eliminated"
        log = await (await db.execute("SELECT bankrupt_id, child_ids FROM evolution_log")).fetchone()
        assert log is not None and log["bankrupt_id"] == "broke_1"

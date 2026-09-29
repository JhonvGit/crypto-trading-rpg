"""
Evolução por falência.

Quem analisa: regras + genes. JEV (System One em :8085) é opcional e
só roda na criação de um filho — nunca no ciclo de trade. Se o Hub
não responder, usa crossover heurístico.
"""
from __future__ import annotations

import json
import logging
import random
from datetime import datetime, timezone

from db.database import get_db
from engine.market import ALL_SYMBOLS
from engine.strategy import DEFAULT_GENES, merge_genes, resolve_strategy

log = logging.getLogger("evolution")

INITIAL_BALANCE = 50.0
JEV_URL = "http://127.0.0.1:8085/v1/systemone"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_json(raw, default):
    if isinstance(raw, (dict, list)):
        return raw
    if not raw:
        return default
    try:
        return json.loads(raw)
    except Exception:
        return default


def mutate_genes(genes: dict, rate: float = 0.12) -> dict:
    out = dict(genes)
    for k, v in list(out.items()):
        if not isinstance(v, (int, float)):
            continue
        factor = 1.0 + random.uniform(-rate, rate)
        nv = v * factor
        if isinstance(v, int):
            nv = max(1, int(round(nv)))
        out[k] = nv
    return out


def crossover_genes(a: dict, b: dict) -> dict:
    keys = set(a) | set(b)
    child = {}
    for k in keys:
        va, vb = a.get(k), b.get(k)
        if va is None:
            child[k] = vb
        elif vb is None:
            child[k] = va
        elif isinstance(va, (int, float)) and isinstance(vb, (int, float)):
            child[k] = va if random.random() < 0.6 else vb
        else:
            child[k] = va if random.random() < 0.5 else vb
    return mutate_genes(child)


async def extract_learned_patterns(db, agent_id: str) -> list:
    rows = await (await db.execute(
        """
        SELECT symbol, side, signal_type, outcome_pnl, outcome_pct, confidence
        FROM knowledge_pool
        WHERE author_id=? AND outcome_pnl > 0
        ORDER BY outcome_pct DESC, confidence DESC
        LIMIT 20
        """,
        (agent_id,),
    )).fetchall()
    return [dict(row) for row in rows]


async def synthesize_with_jev(parent1, patterns1, val1, parent2, patterns2, val2, generation) -> dict | None:
    """Tenta JEV. Retorna None se o Hub estiver fora / resposta inválida."""
    try:
        import httpx
        import re

        prompt = (
            "Você é um otimizador de estratégias de trading rule-based. "
            f"Sintetize genes para a geração {generation} a partir de dois sobreviventes.\n\n"
            f"P1 {parent1.get('name')} value=${val1:.2f} strategy={parent1.get('strategy')} "
            f"symbols={parent1.get('symbols')} genes={parent1.get('genes')}\n"
            f"padrões={json.dumps(patterns1[:5], default=str)}\n\n"
            f"P2 {parent2.get('name')} value=${val2:.2f} strategy={parent2.get('strategy')} "
            f"symbols={parent2.get('symbols')} genes={parent2.get('genes')}\n"
            f"padrões={json.dumps(patterns2[:5], default=str)}\n\n"
            "Responda SOMENTE JSON: "
            '{"strategy":"' + "|".join(DEFAULT_GENES.keys()) + '",'
            '"symbols":["BTCUSDT"],"genes":{},"risk_profile":"moderate","key_insights":"..."}'
        )
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(
                JEV_URL,
                json={"messages": [{"role": "user", "content": prompt}]},
                headers={"Content-Type": "application/json"},
            )
        if resp.status_code != 200:
            log.warning(f"JEV HTTP {resp.status_code}")
            return None
        result = resp.json()
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content and isinstance(result, dict):
            content = json.dumps(result)
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            return None
        synthesis = json.loads(match.group())
        if not isinstance(synthesis, dict):
            return None
        log.info(f"JEV synthesis Gen {generation}: {str(synthesis.get('key_insights', ''))[:120]}")
        return synthesis
    except Exception as e:
        log.warning(f"JEV indisponível ({e}); usando crossover heurístico")
        return None


def generate_name(name1: str, name2: str, index: int) -> str:
    parts1 = (name1 or "Neo").split()
    parts2 = (name2 or "Prime").split()
    prefixes = ["Neo", "Alpha", "Sigma", "Nova", "Quantum", "Apex", "Prime"]
    first = random.choice(prefixes)
    if len(parts1) > 1 and len(parts2) > 1:
        last = (parts1[-1][:3] + parts2[-1][:3]).capitalize()
    else:
        last = f"V{index + 1}"
    return f"{first} {last}"


async def check_bankruptcies_and_evolve(prices: dict, all_agents=None):
    """
    Falência: portfolio mark-to-market < $1.
    Substitui o falido por 1 filho (população estável), cruzando os 2 melhores.
    `all_agents` é ignorado (compatibilidade com chamadas antigas).
    """
    from engine.simulator import portfolio_value

    async with get_db() as db:
        rows = await (await db.execute("SELECT * FROM agents WHERE status='active'")).fetchall()
        agents = [dict(r) for r in rows]

        scored = []
        for agent in agents:
            val = await portfolio_value(agent["id"], prices)
            if val is not None:
                scored.append((agent, val))

        bankrupts = [(a, v) for a, v in scored if v <= 1.0]
        survivors = [(a, v) for a, v in scored if v > 1.0]
        if not bankrupts:
            return []
        if len(survivors) < 2:
            log.warning("Menos de 2 sobreviventes — evolução adiada")
            return []

        survivors.sort(key=lambda x: x[1], reverse=True)
        parent1, val1 = survivors[0]
        parent2, val2 = survivors[1]

        new_agents_data = []
        for bankrupt, bankrupt_val in bankrupts:
            log.info(f"BANKRUPT {bankrupt['name']} ({bankrupt['id']}) ${bankrupt_val:.2f}")
            await db.execute(
                "UPDATE agents SET status='eliminated', eliminated_at=? WHERE id=?",
                (_now(), bankrupt["id"]),
            )

            p1 = dict(parent1)
            p2 = dict(parent2)
            p1["strategy"] = resolve_strategy(p1)
            p2["strategy"] = resolve_strategy(p2)
            g1 = _parse_json(p1.get("genes"), {})
            g2 = _parse_json(p2.get("genes"), {})
            p1["genes"] = merge_genes(p1["strategy"], g1 if isinstance(g1, dict) else {})
            p2["genes"] = merge_genes(p2["strategy"], g2 if isinstance(g2, dict) else {})
            s1 = _parse_json(p1.get("symbols"), ["BTCUSDT"])
            s2 = _parse_json(p2.get("symbols"), ["BTCUSDT"])
            p1["symbols"] = [s for s in (s1 if isinstance(s1, list) else []) if s in ALL_SYMBOLS] or ["BTCUSDT"]
            p2["symbols"] = [s for s in (s2 if isinstance(s2, list) else []) if s in ALL_SYMBOLS] or ["BTCUSDT"]

            gen = max(int(p1.get("generation") or 1), int(p2.get("generation") or 1)) + 1
            patterns1 = await extract_learned_patterns(db, p1["id"])
            patterns2 = await extract_learned_patterns(db, p2["id"])
            jev = await synthesize_with_jev(p1, patterns1, val1, p2, patterns2, val2, gen)

            strategy = p1["strategy"] if random.random() < 0.6 else p2["strategy"]
            genes = crossover_genes(p1["genes"], p2["genes"])
            symbols = list(dict.fromkeys(list(p1["symbols"]) + list(p2["symbols"])))[:3] or ["BTCUSDT"]
            insights = "crossover heurístico dos 2 melhores sobreviventes"

            if jev:
                if jev.get("strategy") in DEFAULT_GENES:
                    strategy = jev["strategy"]
                if isinstance(jev.get("genes"), dict):
                    genes = merge_genes(strategy, {**genes, **jev["genes"]})
                if isinstance(jev.get("symbols"), list) and jev["symbols"]:
                    filtered = [s for s in jev["symbols"] if isinstance(s, str) and s in ALL_SYMBOLS][:4]
                    if filtered:
                        symbols = filtered
                insights = str(jev.get("key_insights") or insights)

            import uuid
            new_uuid = uuid.uuid4().hex[:8]
            new_id = f"gen{gen}_{bankrupt['id'][:12]}_{new_uuid}"
            new_name = generate_name(p1.get("name", "P1"), p2.get("name", "P2"), 0)
            klass = p1.get("class") if strategy == p1["strategy"] else p2.get("class")
            emoji = random.choice(["🤖", "🦾", "🧠", "⚙️", "🔮", "💎", "⚡", "🎯", "🚀", "🔥"])
            parent_ids = json.dumps([p1["id"], p2["id"]])

            await db.execute(
                """
                INSERT INTO agents(id, name, class, emoji, strategy, generation, parent_ids,
                                   genes, symbols, balance_usd, initial_balance, status)
                VALUES(?,?,?,?,?,?,?,?,?,?,?, 'active')
                """,
                (
                    new_id, new_name, klass or strategy, emoji, strategy, gen, parent_ids,
                    json.dumps(genes), json.dumps(symbols), INITIAL_BALANCE, INITIAL_BALANCE,
                ),
            )
            await db.execute(
                """
                INSERT INTO evolution_log(bankrupt_id, child_ids, generation, reason, balance_at_death)
                VALUES(?,?,?,?,?)
                """,
                (
                    bankrupt["id"],
                    json.dumps([new_id]),
                    gen,
                    f"Bankrupt at ${bankrupt_val:.2f}. {insights}"[:400],
                    bankrupt_val,
                ),
            )
            new_agents_data.append({"id": new_id, "name": new_name, "generation": gen, "strategy": strategy})
            log.info(f"EVOLVED {new_name} (Gen {gen}) {strategy} from {p1.get('name')} + {p2.get('name')}")

        await db.commit()
        return new_agents_data

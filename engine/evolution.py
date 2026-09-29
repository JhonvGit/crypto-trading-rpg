"""
Sistema evolucionário de agentes - Quando um agente perde tudo ($0),
dois novos agentes são criados herdando conhecimento dos sobreviventes.
"""
import asyncio
import logging
import json
import random
from datetime import datetime
from db.database import get_db

log = logging.getLogger("evolution")


async def check_bankruptcies_and_evolve(ALL_AGENTS, prices: dict):
    """
    Verifica agentes com balance <= 1.0 (falidos) e cria novos agentes
    herdando conhecimento dos 2 melhores sobreviventes.
    """
    from engine.simulator import portfolio_value
    
    async with get_db() as db:
        bankrupts = []
        survivors = []
        
        # Avaliar todos os agentes
        for agent in ALL_AGENTS:
            val = await portfolio_value(agent.id, prices)
            if val <= 1.0:
                bankrupts.append((agent, val))
                log.info(f"💀 BANKRUPT: {agent.name} ({agent.id}) — Portfolio: ${val:.2f}")
            else:
                survivors.append((agent, val))
        
        if not bankrupts:
            return []
        
        # Ordenar sobreviventes por valor
        survivors.sort(key=lambda x: x[1], reverse=True)
        
        if len(survivors) < 2:
            log.warning("⚠️ Menos de 2 sobreviventes — não é possível evoluir")
            return []
        
        # Para cada falido, criar 2 novos agentes
        new_agents_data = []
        
        for bankrupt, bankrupt_val in bankrupts:
            # Marcar como eliminado
            await db.execute(
                "UPDATE agents SET status='eliminated', eliminated_at=? WHERE id=?",
                (datetime.now().isoformat(), bankrupt.id)
            )
            
            # Selecionar 2 pais (top 2 sobreviventes)
            parent1, val1 = survivors[0]
            parent2, val2 = survivors[1] if len(survivors) > 1 else survivors[0]
            
            # Obter geração máxima dos pais
            gen = max(
                getattr(parent1, 'generation', 1),
                getattr(parent2, 'generation', 1)
            ) + 1
            
            # Extrair padrões aprendidos dos pais
            patterns1 = await extract_learned_patterns(db, parent1.id)
            patterns2 = await extract_learned_patterns(db, parent2.id)
            
            # Combinar e otimizar via JEV
            combined_knowledge = await synthesize_with_jev(
                parent1, patterns1, val1,
                parent2, patterns2, val2,
                gen
            )
            
            # Criar 2 novos agentes
            for i in range(2):
                new_id = f"gen{gen}_{bankrupt.id}_offspring{i+1}"
                new_name = generate_name(parent1.name, parent2.name, i)
                
                new_agent_data = {
                    "id": new_id,
                    "name": new_name,
                    "class": f"Gen{gen} {random.choice(['Estrategista', 'Oportunista', 'Calculista', 'Adaptador'])}",
                    "emoji": random.choice(["🤖", "🦾", "🧠", "⚙️", "🔮", "💎", "⚡", "🎯", "🚀", "🔥"]),
                    "strategy": json.dumps({
                        "base": f"hybrid_{parent1.id}_{parent2.id}",
                        "patterns": combined_knowledge["patterns"][:5],  # Top 5 padrões
                        "risk_profile": combined_knowledge["risk_profile"],
                        "symbols": combined_knowledge["symbols"],
                    }),
                    "generation": gen,
                    "parent_ids": f"{parent1.id},{parent2.id}",
                }
                
                # Inserir novo agente no DB
                await db.execute("""
                    INSERT INTO agents(id, name, class, emoji, strategy, generation, parent_ids, balance_usd, status)
                    VALUES(?, ?, ?, ?, ?, ?, ?, 100.0, 'active')
                """, (
                    new_agent_data["id"],
                    new_agent_data["name"],
                    new_agent_data["class"],
                    new_agent_data["emoji"],
                    new_agent_data["strategy"],
                    new_agent_data["generation"],
                    new_agent_data["parent_ids"],
                ))
                
                # Log evolução
                await db.execute("""
                    INSERT INTO evolution_log(eliminated_id, new_agent_id, parent_ids, generation, reason, inherited_patterns)
                    VALUES(?, ?, ?, ?, ?, ?)
                """, (
                    bankrupt.id,
                    new_id,
                    new_agent_data["parent_ids"],
                    gen,
                    f"Bankrupt at ${bankrupt_val:.2f}",
                    json.dumps(combined_knowledge["patterns"][:10])
                ))
                
                new_agents_data.append(new_agent_data)
                log.info(f"✨ EVOLVED: {new_name} (Gen {gen}) from {parent1.name} + {parent2.name}")
        
        await db.commit()
        return new_agents_data


async def extract_learned_patterns(db, agent_id: str) -> list:
    """Extrai padrões com sucesso do agente."""
    rows = await (await db.execute("""
        SELECT pattern_type, symbol, indicator, threshold_low, threshold_high, action,
               success_count, fail_count, avg_pnl, confidence
        FROM learned_patterns
        WHERE agent_id=? AND confidence > 0.5
        ORDER BY avg_pnl DESC, confidence DESC
        LIMIT 20
    """, (agent_id,))).fetchall()
    
    return [dict(row) for row in rows]


async def synthesize_with_jev(parent1, patterns1, val1, parent2, patterns2, val2, generation) -> dict:
    """
    Usa JEV (System One) para analisar os pais e sintetizar conhecimento otimizado.
    """
    try:
        import httpx
        
        # Preparar contexto para JEV
        context = {
            "generation": generation,
            "parent1": {
                "name": parent1.name,
                "value": val1,
                "patterns": patterns1[:10],
                "symbols": parent1.symbols,
            },
            "parent2": {
                "name": parent2.name,
                "value": val2,
                "patterns": patterns2[:10],
                "symbols": parent2.symbols,
            }
        }
        
        prompt = f"""Você é JEV, um otimizador de estratégias de trading. 

Analise os dois agentes sobreviventes abaixo e sintetize uma estratégia otimizada para a próxima geração (Gen {generation}).

PARENT 1: {parent1.name} — Portfolio: ${val1:.2f}
Símbolos: {', '.join(parent1.symbols)}
Padrões de sucesso (top 5):
{json.dumps(patterns1[:5], indent=2)}

PARENT 2: {parent2.name} — Portfolio: ${val2:.2f}
Símbolos: {', '.join(parent2.symbols)}
Padrões de sucesso (top 5):
{json.dumps(patterns2[:5], indent=2)}

Retorne um JSON com:
{{
  "patterns": [lista dos 5 melhores padrões combinados/otimizados],
  "symbols": [lista de 2-3 símbolos mais promissores],
  "risk_profile": "conservative|moderate|aggressive",
  "key_insights": "insights-chave em português"
}}"""

        # Chamar JEV (System One) do Hub Investimentos
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "http://localhost:8085/v1/systemone",
                json={"messages": [{"role": "user", "content": prompt}]},
                headers={"Content-Type": "application/json"}
            )
            
            if resp.status_code == 200:
                result = resp.json()
                content = result.get("choices", [{}])[0].get("message", {}).get("content", "{}")
                
                # Extrair JSON da resposta
                import re
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    synthesis = json.loads(json_match.group())
                    log.info(f"🧠 JEV synthesis for Gen {generation}: {synthesis.get('key_insights', 'N/A')[:100]}")
                    return synthesis
    
    except Exception as e:
        log.warning(f"JEV synthesis failed: {e}, usando fallback")
    
    # Fallback: combinar heurística simples
    return {
        "patterns": (patterns1[:3] + patterns2[:2]) if patterns1 and patterns2 else [],
        "symbols": list(set(parent1.symbols + parent2.symbols))[:3],
        "risk_profile": "moderate",
        "key_insights": "Fallback: combinação direta dos pais"
    }


def generate_name(name1: str, name2: str, index: int) -> str:
    """Gera nome para o novo agente combinando os pais."""
    parts1 = name1.split()
    parts2 = name2.split()
    
    prefixes = ["Neo", "Alpha", "Sigma", "Nova", "Quantum", "Apex", "Prime"]
    first = random.choice(prefixes)
    
    if len(parts1) > 1 and len(parts2) > 1:
        last = parts1[-1][:3] + parts2[-1][:3]
    else:
        last = f"V{index+1}"
    
    return f"{first} {last.capitalize()}"


async def learn_from_trade(agent_id: str, symbol: str, side: str, entry_price: float, 
                           exit_price: float, pnl: float, ohlcv: list):
    """
    Após cada trade, analisa o resultado e salva padrões bem-sucedidos.
    """
    if not ohlcv or len(ohlcv) < 20:
        return
    
    closes = [c["close"] for c in ohlcv]
    
    # Calcular indicadores no momento do trade
    rsi = calculate_rsi(closes)
    macd_signal = calculate_macd_signal(closes)
    bb_position = calculate_bollinger_position(closes, entry_price)
    
    success = pnl > 0
    
    async with get_db() as db:
        # RSI pattern
        if 0 < rsi < 100:
            await update_pattern(db, agent_id, "rsi", symbol, "rsi", rsi - 5, rsi + 5, side, success, pnl)
        
        # MACD pattern
        await update_pattern(db, agent_id, "macd", symbol, "macd_signal", 
                           macd_signal - 0.1, macd_signal + 0.1, side, success, pnl)
        
        # Bollinger pattern
        await update_pattern(db, agent_id, "bollinger", symbol, "bb_position",
                           bb_position - 0.1, bb_position + 0.1, side, success, pnl)
        
        await db.commit()


async def update_pattern(db, agent_id, pattern_type, symbol, indicator, 
                        low, high, action, success, pnl):
    """Atualiza ou cria um padrão aprendido."""
    row = await (await db.execute("""
        SELECT id, success_count, fail_count, avg_pnl, confidence
        FROM learned_patterns
        WHERE agent_id=? AND pattern_type=? AND symbol=? AND indicator=?
          AND ABS(threshold_low - ?) < 2 AND ABS(threshold_high - ?) < 2
        LIMIT 1
    """, (agent_id, pattern_type, symbol, indicator, low, high))).fetchone()
    
    if row:
        # Atualizar existente
        new_success = row["success_count"] + (1 if success else 0)
        new_fail = row["fail_count"] + (0 if success else 1)
        total = new_success + new_fail
        new_avg_pnl = (row["avg_pnl"] * (total - 1) + pnl) / total
        new_conf = new_success / total if total > 0 else 0.5
        
        await db.execute("""
            UPDATE learned_patterns
            SET success_count=?, fail_count=?, avg_pnl=?, confidence=?, updated_at=?
            WHERE id=?
        """, (new_success, new_fail, new_avg_pnl, new_conf, datetime.now().isoformat(), row["id"]))
    else:
        # Criar novo
        await db.execute("""
            INSERT INTO learned_patterns
            (agent_id, pattern_type, symbol, indicator, threshold_low, threshold_high, 
             action, success_count, fail_count, avg_pnl, confidence)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (agent_id, pattern_type, symbol, indicator, low, high, action,
              1 if success else 0, 0 if success else 1, pnl, 1.0 if success else 0.0))


def calculate_rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i+1] - closes[i] for i in range(len(closes) - 1)]
    gains = [max(d, 0) for d in deltas[-period:]]
    losses = [abs(min(d, 0)) for d in deltas[-period:]]
    avg_g = sum(gains) / period
    avg_l = sum(losses) / period
    if avg_l == 0:
        return 100.0
    rs = avg_g / avg_l
    return 100 - (100 / (1 + rs))


def calculate_macd_signal(closes: list[float]) -> float:
    if len(closes) < 26:
        return 0.0
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    return ema12 - ema26


def calculate_bollinger_position(closes: list[float], price: float) -> float:
    if len(closes) < 20:
        return 0.5
    import math
    window = closes[-20:]
    mean = sum(window) / 20
    std = math.sqrt(sum((x - mean)**2 for x in window) / 20)
    if std == 0:
        return 0.5
    # Retorna posição normalizada: 0=lower_band, 0.5=mean, 1=upper_band
    return (price - (mean - 2*std)) / (4 * std) if std > 0 else 0.5


def _ema(prices: list[float], period: int) -> float:
    k = 2 / (period + 1)
    e = prices[0]
    for p in prices[1:]:
        e = p * k + e * (1 - k)
    return e

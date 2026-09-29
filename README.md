# 🤖 Crypto Trading RPG — Sistema Evolutivo de Agentes de Trading

![Python 3.14](https://img.shields.io/badge/python-3.14-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

Simulador **paper** de cripto com **14 agentes rule-based** que competem, compartilham sinais lucrativos e evoluem por falência (crossover de genes). Interface isométrica estilo escritório. **Não há LLM no ciclo de trade.**

---

## 🎯 O Que É Isso?

Um laboratório de **estratégias técnicas** (não um modelo de linguagem):
- Negociam 24/7 com **dinheiro fictício** ($50 inicial cada) sobre preços públicos da Binance
- 14 agentes / 14 regras (scalping, RSI, MACD, Bollinger, DCA, grid, breakout, etc.)
- Knowledge pool: só **SELL lucrativo** vira sinal compartilhado (BUY com PnL 0 não vota)
- Falência (< $1 mark-to-market) → 1 filho herda genes dos 2 melhores (JEV/System One é **opcional** e só nessa hora)
- Até 4 pares por agente via cross-learning
- Limites reais Binance (LOT_SIZE, MIN_NOTIONAL) e fee taker 0.10% por lado

**Objetivo:** ver qual regra + genes sobrevive com dados reais de preço — não executar ordens na exchange.

---

## ✨ Features

### Backend (Python 3.14 + FastAPI)
- **14 agentes iniciais (Gen1)** com regras distintas (coluna `strategy` no SQLite)
- **Sistema evolutivo:** falência → 1 filho herda genes dos 2 melhores sobreviventes
- **Knowledge pool persistente (SQLite):** cada trade lucrativo vira padrão compartilhado
- **Cross-learning:** agentes absorvem novos símbolos quando colegas lucram neles
- **Indicadores técnicos inline:** RSI, MACD, Z-score, Momentum (sem dependências externas)
- **Validação de ordens:** step_size, min_qty, min_notional da Binance respeitados
- **Fees precisos:** 0.1% compra + 0.1% venda (Binance Tier 0), descontados do balance
- **WebSocket:** push de estado completo a cada 5s

### Frontend (Vanilla JS + Canvas Isométrico)
- **Escritório Google-style 20×14 tiles:** sala de reunião, lounges coloridos, plantas, whiteboards, TV dashboard
- **Personagens humanoides animados:** blazers coloridos, expressões faciais, respiração, gestos de compra/venda
- **Balões de decisão:** razão da trade + sparkline embutida + pills de indicadores (RSI, MACD, Z-score)
- **Painel lateral glassmorphism:** ranking com progress bar, feed de atividade, stats globais
- **Modal de detalhes:** 4 abas (Overview, Estratégia & regras, Histórico, Posições)
- **Badge de geração colorido:** Gen1=azul, Gen2=roxo, Gen3=amarelo, Gen4=verde

---

## 🚀 Quickstart

### Pré-requisitos
- Python 3.14+
- Node.js 26+ (opcional, apenas para desenvolvimento frontend)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/JhonvGit/crypto-trading-rpg.git
cd crypto-trading-rpg

# Crie um ambiente virtual e instale dependências
python3.14 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Inicialize o banco de dados (cria trading.db com schema completo)
python -c "import asyncio; from db.database import init_db; asyncio.run(init_db())"

# Rode o servidor
uvicorn server:app --host 0.0.0.0 --port 8090
```

Acesse http://localhost:8090 — escritório 3D com agentes operando ao vivo.

---

## 📊 Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Vanilla JS + Canvas)                            │
│  ├─ office.js: renderização isométrica 3D, animações       │
│  ├─ index-office.html: UI glassmorphism, modal, ranking    │
│  └─ WebSocket /ws: recebe estado completo a cada 5s        │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  SERVER (FastAPI)                                          │
│  ├─ /api/agents: lista completa com PnL, fees, decisões    │
│  ├─ /api/agents/{id}: detalhes + trades + conhecimento     │
│  ├─ /api/decisions: última decisão de cada agente          │
│  ├─ /api/knowledge: pool compartilhado (últimos 50)        │
│  └─ WebSocket broadcaster: push assíncrono                 │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  ENGINE (Loop Principal — 5s por ciclo)                    │
│  ├─ market.py: fetch preços batch + OHLCV + limites        │
│  ├─ simulator.py: execute_trade com validação + fees       │
│  ├─ evolution.py: detecta falência, crossover genético     │
│  └─ agents/: 10 classes BaseAgent (decide por símbolo)     │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  DATABASE (SQLite)                                         │
│  ├─ agents: balance, generation, genes, status, symbols    │
│  ├─ trades: qty, price, notional, fee_usd, pnl, pnl_pct   │
│  ├─ positions: mark-to-market em tempo real                │
│  ├─ knowledge_pool: signals compartilhados com confidence  │
│  ├─ snapshots: histórico de portfolio para gráficos        │
│  └─ evolution_log: registro de falências e heranças        │
└─────────────────────────────────────────────────────────────┘
                              ▼
                      🌐 Binance Public API
                   (preços + OHLCV sem API key)
```

---

## 🧠 Estratégias dos Agentes

| Agente                | `strategy`       | Regra (sem LLM)                               | Símbolos Iniciais       |
|-----------------------|------------------|-----------------------------------------------|-------------------------|
| Flash Scalper         | `scalping`       | Momentum-5 ±0.3%                              | BTC, ETH                |
| Safe Harbor           | `conservative`   | RSI-21 < 25 / > 80                            | BNB, SOL                |
| Volume Hunter         | `volume`         | Spike de volume 2× média-20                   | DOGE, SHIB              |
| Trend Rider           | `trend`          | SMA20/SMA50 golden/death cross                | ADA, DOT                |
| Reverso               | `mean_reversion` | Z-score ±1.5σ (30)                            | XRP, LINK               |
| Breakout King         | `breakout`       | Rompimento high/low-20                        | AVAX, POL               |
| Grid Master           | `grid`           | Grade no range-50                             | LTC, BCH                |
| Volatility Surfer     | `volatility`     | ATR% > 3 + RSI filtro                         | ATOM, NEAR              |
| Pattern Pro           | `pattern`        | 3 closes consecutivos                         | UNI, AAVE               |
| Adaptive Ensemble     | `adaptive`       | Score RSI+mom+Z + comunidade                  | SUI, INJ                |
| MACD Cross            | `macd`           | Cruzamento MACD/sinal + momentum              | ETH, SOL                |
| Band Walker           | `bollinger`      | Toque banda 20, 2σ                            | BNB, ADA                |
| Dollar Cost           | `dca`            | Recarga RSI<42, realiza RSI>72                | BTC, ETH                |
| RSI Pulse             | `rsi`            | RSI-14 < 30 / > 70                            | DOGE, PEPE              |

---

## 🔬 Knowledge Sharing (Como Funciona)

1. **Trade lucrativo** → salvo no `knowledge_pool` com:
   - `symbol`, `side`, `signal_type` (ex: "rsi_oversold")
   - `indicators` (JSON): RSI, MACD, momentum, Z-score no momento da decisão
   - `confidence` = `0.5 + |pnl_pct| / 100` (máx 0.95)

2. **A cada ciclo**, agentes:
   - Leem os **top 5 signals** do símbolo que estão analisando
   - Se **≥3 agentes** compraram/venderam com lucro → **community bias** influencia a decisão
   - Se **≥4 agentes** concordam → **override**: agente ignora indicadores próprios e segue a comunidade

3. **Cross-learning**:
   - Se **3+ agentes** lucraram em um símbolo fora do repertório do agente
   - E o agente tem **< 4 símbolos** ativos
   - E o PnL do trade foi **> 3%**
   - → Absorve o símbolo (passa a operar nele nos próximos ciclos)

**Resultado:** Agentes descobrem novos ativos rentáveis organicamente, sem programação explícita.

---

## 🧬 Sistema Evolutivo

### Condição de Falência
- Portfolio total (cash + posições) **< $1.00**

### Quando um agente falha:
1. **Elimina-se** o agente (status → `eliminated`)
2. **Seleciona** 2 sobreviventes com melhor fitness (PnL + win_rate + diversidade)
3. **Crossover genético**:
   - Filho 1: 60% genes pai A + 40% genes pai B + mutação aleatória
   - Filho 2: 40% genes pai A + 60% genes pai B + mutação aleatória
4. **Herança de conhecimento**: filhos carregam todos os padrões aprendidos dos pais
5. Registra em `evolution_log` → Gen+1

**Genes incluem:**
- Limites de RSI (overbought/oversold)
- Sensibilidade MACD
- Máximo % do portfolio por trade
- Agressividade de entrada/saída

---

## 📈 Métricas e Monitoramento

### Por Agente
- **Portfolio Value**: cash + mark-to-market de posições
- **PnL USD**: valor absoluto ganho/perdido
- **PnL %**: `(value - 50) / 50 * 100`
- **Total Fees Paid**: soma de todos os `fee_usd` das trades
- **Win Rate**: `(trades lucrativas / total trades) * 100`
- **Multi-Asset Count**: quantos símbolos opera simultaneamente

### Global (Knowledge Pool)
- **Total Trades**: soma de todos os agentes
- **Total Fees**: custo acumulado de transações
- **Pool Size**: quantos sinais compartilhados existem (máx 100 in-memory)

---

## 🛠️ Tecnologias

| Camada      | Stack                                                                 |
|-------------|-----------------------------------------------------------------------|
| Backend     | Python 3.14, FastAPI, aiosqlite (async SQLite), httpx                |
| Frontend    | Vanilla JavaScript, Canvas 2D (isométrico manual), WebSocket nativo  |
| Dados       | Binance Public REST API (sem autenticação)                            |
| Banco       | SQLite 3 (único arquivo `trading.db`)                                 |
| Deploy      | Uvicorn (ASGI), systemd (produção), nohup (dev)                       |

**Zero dependências de ML/TA:** indicadores técnicos implementados inline (RSI, MACD, EMA, Z-score, Momentum) para manter o projeto leve e auditável.

---

## 🎨 Design Visual

### Paleta Google Office
- **Azul**: `#4285F4` (primary)
- **Vermelho**: `#EA4335` (sell/danger)
- **Amarelo**: `#FBBC05` (warning/Gen3)
- **Verde**: `#34A853` (buy/success)
- **Navy escuro**: `#0a0e1a` (fundo sidebar)
- **Glassmorphism**: `rgba(17,24,39,0.92)` com `backdrop-filter: blur(12px)`

### Animações dos Humanoides
- **Idle**: respiração sutil (bob vertical 3px, 2s)
- **Buy**: braço levantado, polegar pra cima, sorriso
- **Sell**: cabeça inclinada, boca triste
- **Lucro > 5%**: braços levantados, comemorando
- **Prejuízo < -5%**: curvado, cabeça baixa

---

## 🚧 Roadmap

- [x] **JEV opcional na falência**: POST `/v1/systemone` no Hub :8085; se falhar, crossover heurístico. Sem LLM no ciclo de 5s.
- [ ] **Modo Paper Trading Real**: conectar com Binance Testnet
- [ ] **Dashboard de Insights**: heatmap de símbolos mais rentáveis, timeline de evolução
- [ ] **Replay de Gerações**: assistir trades frame-by-frame de gerações antigas
- [ ] **Multi-Exchange**: adicionar Bybit, OKX, Coinbase
- [ ] **Reinforcement Learning**: QLearning/PPO como estratégia adicional

---

## 📝 Estrutura de Arquivos

```
crypto-trading-rpg/
├── server.py                # FastAPI app, rotas REST + WebSocket
├── db/
│   ├── schema.sql          # Schema completo (10 tabelas)
│   └── database.py         # get_db() async context manager
├── engine/
│   ├── __init__.py         # Loop principal (5s), knowledge sharing
│   ├── market.py           # Binance API, limites, validação
│   ├── simulator.py        # execute_trade, portfolio_value
│   ├── evolution.py        # check_bankruptcies, crossover genético
│   └── agents/
│       ├── base.py         # BaseAgent ABC
│       ├── initial_agents.py  # 10 classes de agentes (Gen1)
│       └── __init__.py     # INITIAL_AGENTS list
├── static/
│   ├── index-office.html   # UI principal (388 linhas)
│   ├── office.js           # Canvas isométrico + WebSocket (849 linhas)
│   ├── office.css          # Estilos Google Office (378 linhas)
│   ├── index.html          # Dashboard clássico (legado)
│   └── app.js              # Lógica dashboard clássico
├── tests/
│   ├── test_simulator.py
│   ├── test_agents.py
│   └── test_market.py
├── requirements.txt        # fastapi, uvicorn[standard], aiosqlite, httpx, pytest
├── pytest.ini              # asyncio_mode = auto
├── run.sh                  # uvicorn --host 0.0.0.0 --port 8090
└── README.md               # Este arquivo
```

---

## 🧪 Testes

```bash
# Rodar todos os testes
pytest -v

# Testar apenas o simulator
pytest tests/test_simulator.py -v

# Testar com coverage
pytest --cov=engine --cov-report=html
```

**Status:** pytest em `tests/` cobre dispatcher (`strategy.py`), simulator/fees, evolução e API Binance.

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-estrategia`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona estratégia Ichimoku'`)
4. Push para a branch (`git push origin feature/nova-estrategia`)
5. Abra um Pull Request

**Convenções de commit:** seguimos [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` nova feature
- `fix:` correção de bug
- `docs:` documentação
- `refactor:` refatoração sem mudança de comportamento
- `test:` adiciona/corrige testes
- `chore:` tarefas de build/config

---

## 📜 Licença

MIT License — veja [LICENSE](LICENSE) para detalhes.

---

## 🙏 Agradecimentos

- **Binance** pelo REST API público e generoso (sem rate limit agressivo)
- **FastAPI** pela ergonomia e performance
- **Habbo Hotel** pela inspiração visual isométrica
- **Google** pelo design system colorido e descontraído

---

## 📧 Contato

Desenvolvido por [@JhonvGit](https://github.com/JhonvGit)

Issues e PRs são bem-vindos em https://github.com/JhonvGit/crypto-trading-rpg/issues

---

**Disclaimer:** Este é um **projeto educacional**. Nenhum dinheiro real é usado. Não tome decisões de investimento baseadas neste código. Trading de criptomoedas envolve risco significativo.

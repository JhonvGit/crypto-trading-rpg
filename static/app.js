/* ========================================================
   Crypto RPG Trading Arena — app.js
   WebSocket client + canvas renderer + leaderboard
   ======================================================== */

const COLORS = ["#ffd700", "#00ff88", "#ff4466", "#00bfff", "#e056fd"];

let lastData = [];

// ---- Utilities ----

function fmtUSD(v) {
  return "$" + Number(v).toFixed(4);
}

function pnlClass(pct) {
  if (pct > 0) return "pnl-pos";
  if (pct < 0) return "pnl-neg";
  return "pnl-neu";
}

function pnlStr(pct) {
  return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
}

// ---- Leaderboard ----

function buildLeaderboard(data) {
  const tbody = document.getElementById("leader-body");
  tbody.innerHTML = "";
  data.forEach((a, i) => {
    const rank = i + 1;
    const pct  = a.pnl_pct;
    const last = a.trades && a.trades[0];
    const lastStr = last
      ? `<span class="${last.side === "BUY" ? "trade-buy" : "trade-sell"}">${last.side}</span> ${last.symbol} @ $${Number(last.price).toFixed(3)}`
      : "<span style='color:#666'>—</span>";

    let badgeClass = "";
    if (rank === 1) badgeClass = "rank-1";
    if (rank === 2) badgeClass = "rank-2";
    if (rank === 3) badgeClass = "rank-3";

    const tr = document.createElement("tr");
    if (rank === 1) tr.className = "rank-1-row";
    tr.innerHTML = `
      <td class="${badgeClass}"><span class="rank-badge">${rank <= 3 ? ["🥇","🥈","🥉"][rank-1] : rank}</span></td>
      <td>${a.emoji} <strong>${a.name}</strong></td>
      <td style="color:#aaa">${a.class}</td>
      <td><strong>${fmtUSD(a.value)}</strong></td>
      <td class="${pnlClass(pct)}">${pnlStr(pct)}</td>
      <td>${lastStr}</td>
      <td style="color:#888;font-size:0.8em">${(a.symbols || []).join(", ")}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---- Hero Cards ----

function buildHeroes(data) {
  const grid = document.getElementById("heroes-grid");
  grid.innerHTML = "";

  data.forEach((a, i) => {
    // HP bar = value expressed as % of a 0-200 range (starts 100, can go to 200+)
    const hp     = Math.min(Math.max((a.value / 200) * 100, 1), 100);
    const losing = a.pnl_pct < 0;
    const isLeader = i === 0;

    const last = a.trades && a.trades[0];
    let lastTradeHTML = `<span class="trade-wait">Aguardando tick...</span>`;
    if (last) {
      const cls = last.side === "BUY" ? "trade-buy" : "trade-sell";
      lastTradeHTML = `<span class="${cls}">${last.side}</span> ${last.symbol} @ $${Number(last.price).toFixed(3)}`;
    }

    const card = document.createElement("div");
    card.className = `hero-card${isLeader ? " is-leader" : ""}${losing ? " is-losing" : ""}`;
    card.style.setProperty("--card-accent", COLORS[i % COLORS.length]);

    card.innerHTML = `
      ${isLeader ? '<span class="crown">👑</span>' : ""}
      <span class="hero-emoji">${a.emoji}</span>
      <div class="hero-name">${a.name}</div>
      <div class="hero-class">${a.class}</div>
      <div class="hp-wrap">
        <div class="hp-label"><span>HP</span><span>${hp.toFixed(0)}%</span></div>
        <div class="hp-bar">
          <div class="hp-fill${losing ? " losing" : ""}" style="width:${hp}%"></div>
        </div>
      </div>
      <div class="hero-value" style="color:${losing ? "var(--red)" : "var(--green)"}">${fmtUSD(a.value)}</div>
      <div class="hero-pnl ${pnlClass(a.pnl_pct)}">${pnlStr(a.pnl_pct)}</div>
      <div class="hero-pairs">${(a.symbols || []).join(" · ")}</div>
      <div class="hero-last-trade">${lastTradeHTML}</div>
    `;
    grid.appendChild(card);
  });
}

// ---- Chart ----

function drawChart(data) {
  const canvas = document.getElementById("chart-canvas");
  const ctx    = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const PAD = { top: 20, right: 30, bottom: 40, left: 60 };

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#14142b";
  ctx.fillRect(0, 0, W, H);

  const allVals = data.flatMap(a => (a.history || []).map(h => h.v));
  if (!allVals.length) return;

  const minV = Math.min(...allVals, 90);
  const maxV = Math.max(...allVals, 110);
  const range = maxV - minV || 1;

  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top  - PAD.bottom;

  // Grid lines + Y labels
  ctx.strokeStyle = "#252545";
  ctx.lineWidth = 1;
  ctx.font = "11px monospace";
  ctx.fillStyle = "#666688";
  const GRID_LINES = 5;
  for (let i = 0; i <= GRID_LINES; i++) {
    const y = PAD.top + chartH - (chartH * i / GRID_LINES);
    const val = minV + (range * i / GRID_LINES);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y);
    ctx.stroke();
    ctx.fillText("$" + val.toFixed(1), 2, y + 4);
  }

  // $100 baseline
  const baseY = PAD.top + chartH - ((100 - minV) / range) * chartH;
  ctx.save();
  ctx.strokeStyle = "#445";
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD.left, baseY); ctx.lineTo(W - PAD.right, baseY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#556";
  ctx.font = "10px monospace";
  ctx.fillText("$100", 2, baseY - 3);
  ctx.restore();

  // X axis label
  ctx.fillStyle = "#666688";
  ctx.font = "10px monospace";
  ctx.fillText("← histórico", PAD.left, H - 8);

  // Draw each agent's line
  data.forEach((agent, idx) => {
    const pts = agent.history || [];
    if (pts.length < 2) return;

    const xStep = chartW / Math.max(pts.length - 1, 1);
    const color = COLORS[idx % COLORS.length];

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    pts.forEach((pt, i) => {
      const x = PAD.left + i * xStep;
      const y = PAD.top + chartH - ((pt.v - minV) / range) * chartH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // Dot + label at end
    const last = pts[pts.length - 1];
    const lx = PAD.left + (pts.length - 1) * xStep;
    const ly = PAD.top + chartH - ((last.v - minV) / range) * chartH;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = "13px monospace";
    ctx.fillText(agent.emoji, lx + 6, ly + 4);
    ctx.restore();
  });
}

function buildLegend(data) {
  const div = document.getElementById("chart-legend");
  div.innerHTML = "";
  data.forEach((a, i) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></span>${a.emoji} ${a.name}`;
    div.appendChild(item);
  });
}

// ---- Trades Feed ----

function buildTradesFeed(data) {
  const feed = document.getElementById("trades-feed");
  feed.innerHTML = "";
  data.forEach((a, i) => {
    if (!a.trades || !a.trades.length) return;
    const card = document.createElement("div");
    card.className = "trade-card";
    const color = COLORS[i % COLORS.length];
    card.innerHTML = `
      <div class="trade-card-header">
        <span class="trade-card-agent" style="color:${color}">${a.emoji} ${a.name}</span>
        <span style="font-size:0.75rem;color:#666">${a.class}</span>
      </div>
      ${a.trades.slice(0, 3).map(t => `
        <div class="trade-entry">
          <span class="te-label">${t.symbol}</span>
          <span class="${t.side === "BUY" ? "te-buy" : "te-sell"}">${t.side}</span>
          <span>$${Number(t.price).toFixed(3)}</span>
          <span style="color:${t.pnl >= 0 ? "var(--green)" : "var(--red)"}">
            ${t.pnl >= 0 ? "+" : ""}${Number(t.pnl).toFixed(4)}
          </span>
        </div>
      `).join("")}
    `;
    feed.appendChild(card);
  });
}

// ---- Render ----

function render(data) {
  if (!data || !data.length) return;
  lastData = data;
  buildLeaderboard(data);
  buildHeroes(data);
  drawChart(data);
  buildLegend(data);
  buildTradesFeed(data);
}

// ---- WebSocket ----

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onopen = () => {
    document.getElementById("status").textContent = "🟢 Conectado — atualizando a cada 5s";
  };

  ws.onmessage = (e) => {
    try {
      render(JSON.parse(e.data));
    } catch (err) {
      console.error("WS parse error:", err);
    }
  };

  ws.onclose = () => {
    document.getElementById("status").textContent = "🔴 Desconectado — reconectando em 3s...";
    setTimeout(connect, 3000);
  };

  ws.onerror = () => ws.close();

  // Keepalive ping every 15s
  const ping = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    else clearInterval(ping);
  }, 15000);
}

// ---- Boot ----
fetch("/api/agents")
  .then(r => r.json())
  .then(render)
  .catch(console.error);

connect();

// Redraw chart on resize
window.addEventListener("resize", () => {
  if (lastData.length) drawChart(lastData);
});

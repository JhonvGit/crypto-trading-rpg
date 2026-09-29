/* ========================================================
   Trading Office Isométrico — Renderização 3D tipo Habbo
   ======================================================== */

const COLORS = {
  agents: ["#ffd700", "#00ff88", "#ff4466", "#00bfff", "#e056fd", "#ff9500", "#00ffff", "#ff1493", "#7fff00", "#ff6347"],
  floor: "#2d2d44",
  wall: "#383850",
  desk: "#5a4a3a",
  screen: "#1a1a2e",
  plant: "#2d5a2d",
};

// Projeção isométrica
function isoX(x, y) { return (x - y) * 32; }
function isoY(x, y) { return (x + y) * 16; }

// Estado global
let agents = [];
let selectedAgent = null;
let zoom = 1.0;
let offsetX = 0;
let offsetY = 50;
let lastData = [];
let activityLog = [];

// Elementos canvas
const canvas = document.getElementById("office-canvas");
const ctx = canvas.getContext("2d");
const tooltip = document.getElementById("trader-tooltip");
const miniCanvas = document.getElementById("mini-chart");
const miniCtx = miniCanvas.getContext("2d");

// Posições fixas das mesas (grid 12x8)
const DESK_POSITIONS = [
  {x: 2, y: 2}, {x: 4, y: 2}, {x: 6, y: 2}, {x: 8, y: 2}, {x: 10, y: 2},
  {x: 2, y: 5}, {x: 4, y: 5}, {x: 6, y: 5}, {x: 8, y: 5}, {x: 10, y: 5},
];

// ---- RENDERIZAÇÃO DA SALA ----

function drawOfficeRoom() {
  const W = canvas.width;
  const H = canvas.height;
  
  ctx.save();
  ctx.translate(W / 2 + offsetX, H / 3 + offsetY);
  ctx.scale(zoom, zoom);

  // Piso (12x8 tiles)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 12; x++) {
      drawTile(x, y, COLORS.floor);
    }
  }

  // Paredes traseiras
  drawWall(0, 0, 12, "#2a2a3a");
  drawWall(0, 0, 8, "#323242", true);

  // Mobília e decoração
  drawPlant(1, 1);
  drawPlant(11, 1);
  drawPlant(1, 7);
  drawPlant(11, 7);

  // Mesas e computadores
  DESK_POSITIONS.forEach((pos, i) => {
    drawDesk(pos.x, pos.y);
    drawComputer(pos.x, pos.y, i < agents.length ? agents[i].id : null);
  });

  // Robôs traders
  agents.forEach((agent, i) => {
    const pos = DESK_POSITIONS[i] || {x: 6, y: 4};
    // Animar leve movimento
    const wobble = Math.sin(Date.now() / 1000 + i) * 0.1;
    drawAgent(pos.x + wobble, pos.y, agent, i);
  });

  ctx.restore();
}

function drawTile(x, y, color) {
  const sx = isoX(x, y);
  const sy = isoY(x, y);
  
  ctx.fillStyle = color;
  ctx.strokeStyle = "#1a1a2a";
  ctx.lineWidth = 1;
  
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + 32, sy + 16);
  ctx.lineTo(sx, sy + 32);
  ctx.lineTo(sx - 32, sy + 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawWall(x, y, length, color, vertical = false) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2;
  
  if (vertical) {
    const sx = isoX(x, y);
    const sy = isoY(x, y);
    ctx.fillRect(sx - 2, sy - 80, 4, 80);
    for (let i = 0; i < length; i++) {
      const sxi = isoX(x, y + i);
      const syi = isoY(x, y + i);
      ctx.fillRect(sxi - 32, syi + 16 - 80, 64, 80);
    }
  } else {
    for (let i = 0; i < length; i++) {
      const sxi = isoX(x + i, y);
      const syi = isoY(x + i, y);
      ctx.fillRect(sxi - 32, syi - 80, 64, 80);
    }
  }
}

function drawDesk(x, y) {
  const sx = isoX(x, y);
  const sy = isoY(x, y);
  
  // Base da mesa (retângulo isométrico)
  ctx.fillStyle = COLORS.desk;
  ctx.strokeStyle = "#3a2a1a";
  ctx.lineWidth = 1;
  
  ctx.beginPath();
  ctx.moveTo(sx, sy - 8);
  ctx.lineTo(sx + 24, sy + 4);
  ctx.lineTo(sx, sy + 16);
  ctx.lineTo(sx - 24, sy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Topo da mesa (altura)
  ctx.fillStyle = "#6a5a4a";
  ctx.beginPath();
  ctx.moveTo(sx, sy - 8);
  ctx.lineTo(sx + 24, sy + 4);
  ctx.lineTo(sx + 24, sy);
  ctx.lineTo(sx, sy - 12);
  ctx.closePath();
  ctx.fill();
}

function drawComputer(x, y, agentId) {
  const sx = isoX(x, y);
  const sy = isoY(x, y);
  
  // Monitor
  ctx.fillStyle = COLORS.screen;
  ctx.fillRect(sx - 10, sy - 28, 20, 16);
  
  // Tela (verde se agente está ativo)
  if (agentId) {
    const agent = agents.find(a => a.id === agentId);
    const screenColor = agent && agent.pnl_pct >= 0 ? "#00ff88" : "#ff4466";
    ctx.fillStyle = screenColor;
    ctx.fillRect(sx - 8, sy - 26, 16, 12);
    
    // "Gráfico" piscando
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    const flicker = Math.sin(Date.now() / 300) > 0 ? 1 : 0.3;
    ctx.globalAlpha = flicker;
    ctx.fillRect(sx - 6, sy - 22, 4, 6);
    ctx.fillRect(sx - 1, sy - 24, 4, 8);
    ctx.fillRect(sx + 4, sy - 20, 4, 4);
    ctx.globalAlpha = 1;
  }
  
  // Base do monitor
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(sx - 3, sy - 12, 6, 4);
}

function drawPlant(x, y) {
  const sx = isoX(x, y);
  const sy = isoY(x, y);
  
  // Vaso
  ctx.fillStyle = "#5a3a2a";
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + 8, sy + 4);
  ctx.lineTo(sx + 8, sy + 12);
  ctx.lineTo(sx, sy + 8);
  ctx.lineTo(sx - 8, sy + 12);
  ctx.lineTo(sx - 8, sy + 4);
  ctx.closePath();
  ctx.fill();
  
  // Planta (círculos verdes)
  ctx.fillStyle = COLORS.plant;
  ctx.beginPath();
  ctx.arc(sx - 4, sy - 8, 6, 0, Math.PI * 2);
  ctx.arc(sx + 4, sy - 6, 5, 0, Math.PI * 2);
  ctx.arc(sx, sy - 12, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawAgent(x, y, agent, index) {
  const sx = isoX(x, y);
  const sy = isoY(x, y);
  
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(sx, sy + 18, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Corpo do robô (retângulo com cor do agente)
  const color = COLORS.agents[index % COLORS.agents.length];
  ctx.fillStyle = color;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  
  ctx.fillRect(sx - 10, sy - 10, 20, 24);
  ctx.strokeRect(sx - 10, sy - 10, 20, 24);
  
  // Cabeça
  ctx.fillStyle = color;
  ctx.fillRect(sx - 8, sy - 22, 16, 12);
  ctx.strokeRect(sx - 8, sy - 22, 16, 12);
  
  // Olhos (LED)
  const eyeColor = agent.pnl_pct >= 0 ? "#00ff88" : "#ff4466";
  ctx.fillStyle = eyeColor;
  ctx.fillRect(sx - 5, sy - 18, 3, 3);
  ctx.fillRect(sx + 2, sy - 18, 3, 3);
  
  // Nome tag
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(sx - 24, sy - 32, 48, 10);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 8px monospace";
  ctx.textAlign = "center";
  ctx.fillText(agent.emoji + " " + agent.name.split(" ")[0], sx, sy - 24);
  
  // Badge de geração
  if (agent.generation > 1) {
    ctx.fillStyle = COLORS.agents[index % COLORS.agents.length];
    ctx.beginPath();
    ctx.arc(sx + 12, sy - 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = "bold 8px monospace";
    ctx.fillText(`G${agent.generation}`, sx + 12, sy - 5);
  }
  
  // Indicador de performance
  const barWidth = 20;
  const barHeight = 3;
  const pnlNorm = Math.max(-1, Math.min(1, agent.pnl_pct / 100));
  const barFill = (pnlNorm + 1) / 2 * barWidth;
  
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(sx - barWidth/2, sy + 16, barWidth, barHeight);
  ctx.fillStyle = pnlNorm >= 0 ? "#00ff88" : "#ff4466";
  ctx.fillRect(sx - barWidth/2, sy + 16, barFill, barHeight);
  
  // Detectar hover
  const mousePos = getMousePos();
  if (mousePos) {
    const dx = mousePos.x - sx;
    const dy = mousePos.y - sy;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 30) {
      showTooltip(agent, mousePos.x, mousePos.y);
    }
  }
}

// ---- INTERAÇÃO ----

let mousePos = null;

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mousePos = {
    x: e.clientX - rect.left - canvas.width / 2 - offsetX,
    y: e.clientY - rect.top - canvas.height / 3 - offsetY,
  };
});

canvas.addEventListener("mouseleave", () => {
  mousePos = null;
  tooltip.classList.remove("visible");
});

function getMousePos() {
  return mousePos;
}

function showTooltip(agent, x, y) {
  tooltip.innerHTML = `
    <div class="tooltip-name">${agent.emoji} ${agent.name}</div>
    <div class="tooltip-stat">Classe: ${agent.class}</div>
    <div class="tooltip-stat">Geração: ${agent.generation}</div>
    <div class="tooltip-stat">Portfólio: $${agent.value.toFixed(2)}</div>
    <div class="tooltip-stat">Balance: $${agent.balance.toFixed(2)}</div>
    <div class="tooltip-pnl ${agent.pnl_pct >= 0 ? 'positive' : 'negative'}">
      P&L: ${agent.pnl_pct >= 0 ? '+' : ''}${agent.pnl_pct.toFixed(2)}%
    </div>
  `;
  tooltip.style.left = x + 20 + "px";
  tooltip.style.top = y + "px";
  tooltip.classList.add("visible");
}

// ---- CONTROLES ----

document.getElementById("zoom-in").addEventListener("click", () => {
  zoom = Math.min(2, zoom + 0.2);
});

document.getElementById("zoom-out").addEventListener("click", () => {
  zoom = Math.max(0.5, zoom - 0.2);
});

document.getElementById("view-reset").addEventListener("click", () => {
  zoom = 1.0;
  offsetX = 0;
  offsetY = 50;
});

// ---- RANKING LATERAL ----

function updateRanking(data) {
  const rankingList = document.getElementById("ranking-list");
  rankingList.innerHTML = "";
  
  data.forEach((agent, i) => {
    const pnlClass = agent.pnl_pct > 0 ? "positive" : agent.pnl_pct < 0 ? "negative" : "neutral";
    const item = document.createElement("div");
    item.className = `rank-item${i === 0 ? " top" : ""}`;
    item.innerHTML = `
      <div class="rank-num">${i + 1}</div>
      <div class="rank-avatar">${agent.emoji}</div>
      <div class="rank-info">
        <div class="rank-name">${agent.name} <small>Gen ${agent.generation || 1}</small></div>
        <div class="rank-value">$${agent.value.toFixed(2)}</div>
      </div>
      <div class="rank-pnl ${pnlClass}">
        ${agent.pnl_pct >= 0 ? "+" : ""}${agent.pnl_pct.toFixed(1)}%
      </div>
    `;
    rankingList.appendChild(item);
  });
}

// ---- FEED DE ATIVIDADE ----

function addActivity(agent, trade) {
  const item = document.createElement("div");
  item.className = `activity-item ${trade.side.toLowerCase()}`;
  item.innerHTML = `
    <span class="activity-trader">${agent.emoji} ${agent.name}</span>
    <span class="activity-action ${trade.side.toLowerCase()}">${trade.side}</span>
    <strong>${trade.symbol}</strong> @ $${Number(trade.price).toFixed(2)}
    <span class="activity-time">${new Date(trade.ts).toLocaleTimeString()}</span>
  `;
  
  const feed = document.getElementById("activity-feed");
  feed.insertBefore(item, feed.firstChild);
  
  // Manter só últimas 20
  while (feed.children.length > 20) {
    feed.removeChild(feed.lastChild);
  }
}

// ---- MINI GRÁFICO ----

function drawMiniChart(data) {
  const W = miniCanvas.width;
  const H = miniCanvas.height;
  
  miniCtx.clearRect(0, 0, W, H);
  miniCtx.fillStyle = "rgba(0,0,0,0.3)";
  miniCtx.fillRect(0, 0, W, H);
  
  if (!data.length) return;
  
  // Pegar histórico dos 3 melhores
  const top3 = data.slice(0, 3);
  const allVals = top3.flatMap(a => (a.history || []).map(h => h.v));
  if (!allVals.length) return;
  
  const minV = Math.min(...allVals, 90);
  const maxV = Math.max(...allVals, 110);
  const range = maxV - minV || 1;
  
  const PAD = 30;
  
  // Baseline $100
  const baseY = H - PAD - ((100 - minV) / range) * (H - 2 * PAD);
  miniCtx.strokeStyle = "#555";
  miniCtx.setLineDash([3, 3]);
  miniCtx.lineWidth = 1;
  miniCtx.beginPath();
  miniCtx.moveTo(PAD, baseY);
  miniCtx.lineTo(W - PAD, baseY);
  miniCtx.stroke();
  miniCtx.setLineDash([]);
  
  // Linhas dos agentes
  top3.forEach((agent, idx) => {
    const pts = agent.history || [];
    if (pts.length < 2) return;
    
    const xStep = (W - 2 * PAD) / Math.max(pts.length - 1, 1);
    const color = COLORS.agents[data.indexOf(agent) % COLORS.agents.length];
    
    miniCtx.strokeStyle = color;
    miniCtx.lineWidth = 2;
    miniCtx.beginPath();
    pts.forEach((pt, i) => {
      const x = PAD + i * xStep;
      const y = H - PAD - ((pt.v - minV) / range) * (H - 2 * PAD);
      i === 0 ? miniCtx.moveTo(x, y) : miniCtx.lineTo(x, y);
    });
    miniCtx.stroke();
  });
}

// ---- RENDERIZAÇÃO PRINCIPAL ----

function render(data) {
  if (!data || !data.length) return;
  
  // Atualizar agentes
  agents = data;
  lastData = data;
  
  // Detectar novos trades
  data.forEach(agent => {
    if (agent.trades && agent.trades[0]) {
      const lastTrade = agent.trades[0];
      // Verificar se é novo (evitar duplicatas)
      const exists = activityLog.some(log => 
        log.agent_id === agent.id && 
        log.trade_id === lastTrade.id
      );
      if (!exists) {
        activityLog.push({agent_id: agent.id, trade_id: lastTrade.id});
        addActivity(agent, lastTrade);
      }
    }
  });
  
  // Renderizar sala
  drawOfficeRoom();
  
  // Atualizar ranking
  updateRanking(data);
  
  // Mini gráfico
  drawMiniChart(data);
}

// ---- RELÓGIO ----

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"});
  document.getElementById("time-display").textContent = timeStr;
}
setInterval(updateClock, 1000);
updateClock();

// ---- WEBSOCKET ----

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onopen = () => {
    document.getElementById("status").textContent = "🟢 Conectado";
  };

  ws.onmessage = (e) => {
    try {
      render(JSON.parse(e.data));
    } catch (err) {
      console.error("WS parse error:", err);
    }
  };

  ws.onclose = () => {
    document.getElementById("status").textContent = "🔴 Desconectado — reconectando...";
    setTimeout(connect, 3000);
  };

  const ping = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    else clearInterval(ping);
  }, 15000);
}

// ---- LOOP DE ANIMAÇÃO ----

function animate() {
  drawOfficeRoom();
  requestAnimationFrame(animate);
}

// ---- BOOT ----

fetch("/api/agents")
  .then(r => r.json())
  .then(render)
  .catch(console.error);

connect();
animate();

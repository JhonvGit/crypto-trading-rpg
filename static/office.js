/* ═══════════════════════════════════════════════════════════
   Trading Office — Renderização Isométrica 3D estilo Habbo
   10 Robôs Traders · Escritório de Investimentos
   ═══════════════════════════════════════════════════════════ */

// ── CANVAS SETUP ──────────────────────────────────────────
const wrap   = document.getElementById("office-wrap");
const canvas = document.getElementById("office-canvas");
const ctx    = canvas.getContext("2d");
const miniCanvas = document.getElementById("mini-chart");
const miniCtx    = miniCanvas.getContext("2d");
miniCanvas.width  = 290;
miniCanvas.height = 120;

function resizeCanvas() {
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ── CÂMERA ────────────────────────────────────────────────
let cam = { x: 0, y: -80, zoom: 1.0 };
let drag = { down: false, sx: 0, sy: 0, cx: 0, cy: 0 };

canvas.addEventListener("mousedown", e => {
  drag.down = true;
  drag.sx = e.clientX; drag.sy = e.clientY;
  drag.cx = cam.x;     drag.cy = cam.y;
});
window.addEventListener("mouseup",   () => drag.down = false);
window.addEventListener("mousemove", e => {
  if (drag.down) {
    cam.x = drag.cx + (e.clientX - drag.sx);
    cam.y = drag.cy + (e.clientY - drag.sy);
  }
  // atualiza posição do mouse para hit-test
  const r = canvas.getBoundingClientRect();
  mouse.cx = e.clientX - r.left;
  mouse.cy = e.clientY - r.top;
});

document.getElementById("btn-zi").onclick = () => cam.zoom = Math.min(2.5, cam.zoom + 0.15);
document.getElementById("btn-zo").onclick = () => cam.zoom = Math.max(0.4, cam.zoom - 0.15);
document.getElementById("btn-zr").onclick = () => { cam.x = 0; cam.y = -80; cam.zoom = 1.0; };

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  cam.zoom = Math.max(0.4, Math.min(2.5, cam.zoom - e.deltaY * 0.001));
}, { passive: false });

// ── PROJEÇÃO ISOMÉTRICA ───────────────────────────────────
const TILE_W = 64, TILE_H = 32, WALL_H = 80;

function iso(gx, gy) {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2)
  };
}

// Projeto de mundo → tela
function world2screen(wx, wy) {
  const cx = canvas.width  / 2 + cam.x;
  const cy = canvas.height / 2 + cam.y;
  return {
    x: cx + wx * cam.zoom,
    y: cy + wy * cam.zoom
  };
}

// ── PALETA ────────────────────────────────────────────────
const C = {
  floor1 : "#2a2a40",  floor2 : "#242438",
  wallL  : "#1e1e30",  wallR  : "#181828",
  desk   : "#4a3a2a",  deskT  : "#5a4a3a",  deskS : "#3a2a1a",
  chair  : "#2a4a3a",
  screen : "#0a0a1a",
  plant1 : "#1e3a1e",  plant2 : "#2a4a2a",  pot   : "#4a2a2a",
  carpet : "#1a1a3a",
  agentC : ["#ffd700","#00ff88","#ff4466","#00bfff","#e056fd",
            "#ff9500","#00ffff","#ff1493","#7fff00","#ff6347"],
};

// ── LAYOUT DA SALA ────────────────────────────────────────
const ROOM_W = 14, ROOM_H = 10;

// 10 posições de mesa (2 fileiras de 5)
const DESKS = [
  {gx:2,gy:2},{gx:4,gy:2},{gx:6,gy:2},{gx:8,gy:2},{gx:10,gy:2},
  {gx:2,gy:6},{gx:4,gy:6},{gx:6,gy:6},{gx:8,gy:6},{gx:10,gy:6},
];

// ── ESTADO GLOBAL ─────────────────────────────────────────
let agentsData  = [];
let activityLog = new Set();
let elimCount   = 0;
let mouse       = { cx: -999, cy: -999 };
let tooltip     = document.getElementById("tooltip");
let hoveredAgent = null;
let time        = 0;

// ── DESENHO DE TILES ──────────────────────────────────────

function drawTile(gx, gy, fill, stroke="#1a1a28") {
  const { x, y } = iso(gx, gy);
  const s = world2screen(x, y);
  const hw = (TILE_W / 2) * cam.zoom,
        hh = (TILE_H / 2) * cam.zoom;

  ctx.beginPath();
  ctx.moveTo(s.x,      s.y - hh);
  ctx.lineTo(s.x + hw, s.y);
  ctx.lineTo(s.x,      s.y + hh);
  ctx.lineTo(s.x - hw, s.y);
  ctx.closePath();
  ctx.fillStyle   = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth   = 0.5;
  ctx.fill();
  ctx.stroke();
}

function drawWallLeft(gx, gy, gh=1) {
  for (let h=0; h<gh; h++) {
    const { x, y } = iso(gx, gy);
    const s  = world2screen(x, y);
    const hw = (TILE_W / 2) * cam.zoom;
    const hh = (TILE_H / 2) * cam.zoom;
    const wh = WALL_H * cam.zoom;

    ctx.beginPath();
    ctx.moveTo(s.x - hw, s.y - h*hh*0.5);
    ctx.lineTo(s.x,      s.y + hh - h*hh*0.5);
    ctx.lineTo(s.x,      s.y + hh - wh - h*hh*0.5);
    ctx.lineTo(s.x - hw, s.y - wh - h*hh*0.5);
    ctx.closePath();
    ctx.fillStyle   = C.wallL;
    ctx.strokeStyle = "#0f0f1a";
    ctx.lineWidth   = 1;
    ctx.fill();
    ctx.stroke();
  }
}

function drawWallBack(gx, gy) {
  const { x, y } = iso(gx, gy);
  const s  = world2screen(x, y);
  const hw = (TILE_W / 2) * cam.zoom;
  const hh = (TILE_H / 2) * cam.zoom;
  const wh = WALL_H * cam.zoom;

  // Esquerda da parede de fundo
  ctx.beginPath();
  ctx.moveTo(s.x - hw, s.y);
  ctx.lineTo(s.x,      s.y - hh);
  ctx.lineTo(s.x,      s.y - hh - wh);
  ctx.lineTo(s.x - hw, s.y - wh);
  ctx.closePath();
  ctx.fillStyle = C.wallL;
  ctx.strokeStyle = "#0f0f1a";
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();

  // Direita
  ctx.beginPath();
  ctx.moveTo(s.x,      s.y - hh);
  ctx.lineTo(s.x + hw, s.y);
  ctx.lineTo(s.x + hw, s.y - wh);
  ctx.lineTo(s.x,      s.y - hh - wh);
  ctx.closePath();
  ctx.fillStyle = C.wallR;
  ctx.strokeStyle = "#0f0f1a";
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();
}

// ── MÓVEIS ─────────────────────────────────────────────────

function drawDesk(gx, gy, agentIndex) {
  const { x, y } = iso(gx, gy);
  const s  = world2screen(x, y);
  const z  = cam.zoom;
  const hw = (TILE_W / 2 - 4) * z,
        hh = (TILE_H / 2 - 2) * z;
  const dh = 20 * z;   // altura da mesa

  // Topo
  ctx.beginPath();
  ctx.moveTo(s.x,      s.y - dh - hh);
  ctx.lineTo(s.x + hw, s.y - dh);
  ctx.lineTo(s.x,      s.y - dh + hh);
  ctx.lineTo(s.x - hw, s.y - dh);
  ctx.closePath();
  ctx.fillStyle = C.deskT;
  ctx.fill();
  ctx.strokeStyle = "#2a1a0a";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Lado esquerdo
  ctx.beginPath();
  ctx.moveTo(s.x - hw, s.y - dh);
  ctx.lineTo(s.x,      s.y - dh + hh);
  ctx.lineTo(s.x,      s.y + hh);
  ctx.lineTo(s.x - hw, s.y);
  ctx.closePath();
  ctx.fillStyle = C.desk;
  ctx.fill();
  ctx.stroke();

  // Lado direito
  ctx.beginPath();
  ctx.moveTo(s.x,      s.y - dh + hh);
  ctx.lineTo(s.x + hw, s.y - dh);
  ctx.lineTo(s.x + hw, s.y);
  ctx.lineTo(s.x,      s.y + hh);
  ctx.closePath();
  ctx.fillStyle = C.deskS;
  ctx.fill();
  ctx.stroke();

  // Monitor
  drawMonitor(s.x - 6*z, s.y - dh - 14*z, z, agentIndex);
  
  // Teclado
  ctx.fillStyle = "#2a2a3a";
  ctx.fillRect(s.x + 2*z, s.y - dh - 2*z, 14*z, 5*z);
}

function drawMonitor(sx, sy, z, agentIndex) {
  const w = 22*z, h = 18*z;
  
  // Moldura
  ctx.fillStyle = "#1a1a2a";
  ctx.fillRect(sx - w/2, sy - h, w, h);
  
  // Tela
  const agent = agentsData[agentIndex];
  if (agent) {
    const sc = agent.pnl_pct >= 0 ? "#003820" : "#380018";
    ctx.fillStyle = sc;
    ctx.fillRect(sx - w/2 + 2*z, sy - h + 2*z, w - 4*z, h - 4*z);
    
    // Gráfico simplificado na tela
    const history = agent.history || [];
    if (history.length > 1) {
      const tw = w - 6*z, th = h - 6*z;
      const ox = sx - w/2 + 3*z, oy = sy - 4*z;
      
      const vals = history.map(p => p.v);
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const range = maxV - minV || 1;
      
      ctx.strokeStyle = agent.pnl_pct >= 0 ? "#00ff88" : "#ff4466";
      ctx.lineWidth = 1;
      ctx.beginPath();
      history.forEach((p, i) => {
        const px = ox + (i / Math.max(history.length-1, 1)) * tw;
        const py = oy - ((p.v - minV) / range) * th;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
    
    // LED piscando
    const blink = Math.sin(time * 4 + agentIndex) > 0 ? 1 : 0.3;
    ctx.globalAlpha = blink;
    ctx.fillStyle = agent.pnl_pct >= 0 ? "#00ff88" : "#ff4466";
    ctx.fillRect(sx + w/2 - 5*z, sy - h + 2*z, 3*z, 3*z);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(sx - w/2 + 2*z, sy - h + 2*z, w - 4*z, h - 4*z);
  }
  
  // Haste
  ctx.fillStyle = "#111";
  ctx.fillRect(sx - 2*z, sy, 4*z, 6*z);
}

function drawChair(gx, gy) {
  const { x, y } = iso(gx - 0.5, gy + 0.5);
  const s = world2screen(x, y);
  const z = cam.zoom;
  
  ctx.fillStyle = C.chair;
  ctx.strokeStyle = "#0a1a0a";
  ctx.lineWidth = 0.5;
  
  // Base da cadeira
  ctx.beginPath();
  ctx.arc(s.x, s.y, 10*z, 0, Math.PI*2);
  ctx.fill();
  ctx.stroke();
  
  // Encosto
  ctx.fillRect(s.x - 6*z, s.y - 22*z, 12*z, 14*z);
}

function drawPlant(gx, gy) {
  const { x, y } = iso(gx, gy);
  const s = world2screen(x, y);
  const z = cam.zoom;
  
  // Vaso
  ctx.fillStyle = C.pot;
  ctx.beginPath();
  ctx.moveTo(s.x - 8*z, s.y);
  ctx.lineTo(s.x + 8*z, s.y);
  ctx.lineTo(s.x + 5*z, s.y + 12*z);
  ctx.lineTo(s.x - 5*z, s.y + 12*z);
  ctx.closePath();
  ctx.fill();
  
  // Folhas
  [[0,-1],[-.8,-.5],[.8,-.5]].forEach(([dx,dy]) => {
    ctx.fillStyle = Math.random() > 0.5 ? C.plant1 : C.plant2;
    ctx.beginPath();
    ctx.ellipse(s.x + dx*14*z, s.y + dy*14*z, 10*z, 14*z, dx*0.5, 0, Math.PI*2);
    ctx.fill();
  });
}

function drawCarpet() {
  // Tapete central vermelho tipo área de reunião
  for (let gx = 4; gx <= 8; gx++) {
    for (let gy = 4; gy <= 4; gy++) {
      drawTile(gx, gy, "#200a1a", "#300a2a");
    }
  }
}

// ── TV/TICKER NA PAREDE ───────────────────────────────────
function drawWallTV() {
  const { x, y } = iso(6, 0);
  const s = world2screen(x, y - WALL_H * 0.6);
  const z = cam.zoom;
  const w = 70*z, h = 40*z;
  
  // Moldura
  ctx.fillStyle = "#0a0a1a";
  ctx.strokeStyle = "#ffd700";
  ctx.lineWidth = 2;
  ctx.fillRect(s.x - w/2, s.y - h, w, h);
  ctx.strokeRect(s.x - w/2, s.y - h, w, h);
  
  // Tela com ticker
  ctx.fillStyle = "#001a00";
  ctx.fillRect(s.x - w/2 + 3*z, s.y - h + 3*z, w - 6*z, h - 6*z);
  
  ctx.fillStyle = "#00ff88";
  ctx.font = `bold ${8*z}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText("📊 TRADING OFFICE", s.x, s.y - h + 14*z);
  
  ctx.font = `${7*z}px monospace`;
  const bestAgent = agentsData[0];
  if (bestAgent) {
    ctx.fillStyle = bestAgent.pnl_pct >= 0 ? "#00ff88" : "#ff4466";
    ctx.fillText(`LÍDER: ${bestAgent.emoji}${bestAgent.name}`, s.x, s.y - h + 25*z);
    ctx.fillText(`$${bestAgent.value.toFixed(2)} (${bestAgent.pnl_pct >= 0 ? '+' : ''}${bestAgent.pnl_pct.toFixed(1)}%)`, s.x, s.y - h + 35*z);
  }
  ctx.textAlign = "left";
}

// ── ROBÔ TRADER ───────────────────────────────────────────
function drawRobot(gx, gy, agent, idx) {
  const bobY = Math.sin(time * 2 + idx * 1.2) * 2;
  const { x, y } = iso(gx, gy);
  const s  = world2screen(x, y + bobY);
  const z  = cam.zoom;
  const color = C.agentC[idx % C.agentC.length];
  
  // Sombra
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + 4*z, 12*z, 5*z, 0, 0, Math.PI*2);
  ctx.fill();
  
  // Pernas
  ctx.fillStyle = "#1a1a2a";
  ctx.fillRect(s.x - 8*z, s.y + 2*z, 6*z, 10*z);
  ctx.fillRect(s.x + 2*z, s.y + 2*z, 6*z, 10*z);
  
  // Corpo
  const bodyGrad = ctx.createLinearGradient(s.x - 12*z, s.y - 16*z, s.x + 12*z, s.y + 2*z);
  bodyGrad.addColorStop(0, color);
  bodyGrad.addColorStop(1, shadeColor(color, -40));
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(s.x - 12*z, s.y - 16*z, 24*z, 20*z, 4*z);
  ctx.fill();
  ctx.stroke();
  
  // Detalhes no corpo (luzes)
  ctx.fillStyle = agent.pnl_pct >= 0 ? "#00ff88" : "#ff4466";
  const ledBlink = Math.sin(time * 5 + idx) > 0 ? 1 : 0.4;
  ctx.globalAlpha = ledBlink;
  ctx.beginPath();
  ctx.arc(s.x - 6*z, s.y - 8*z, 2.5*z, 0, Math.PI*2);
  ctx.arc(s.x,       s.y - 8*z, 2.5*z, 0, Math.PI*2);
  ctx.arc(s.x + 6*z, s.y - 8*z, 2.5*z, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
  
  // Braços
  const armSwing = Math.sin(time * 2 + idx) * 0.3;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4*z;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(s.x - 12*z, s.y - 12*z);
  ctx.lineTo(s.x - 18*z, s.y - 6*z + armSwing*8*z);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s.x + 12*z, s.y - 12*z);
  ctx.lineTo(s.x + 18*z, s.y - 6*z - armSwing*8*z);
  ctx.stroke();
  
  // Cabeça
  const headGrad = ctx.createLinearGradient(s.x - 10*z, s.y - 32*z, s.x + 10*z, s.y - 16*z);
  headGrad.addColorStop(0, lightenColor(color, 20));
  headGrad.addColorStop(1, color);
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(s.x - 10*z, s.y - 32*z, 20*z, 16*z, 4*z);
  ctx.fill();
  ctx.stroke();
  
  // Olhos (display da cabeça)
  const eyeColor = agent.pnl_pct >= 0 ? "#00ff88" : "#ff4466";
  ctx.fillStyle = C.screen;
  ctx.fillRect(s.x - 8*z, s.y - 30*z, 16*z, 10*z);
  
  // Expressão nos olhos
  ctx.fillStyle = eyeColor;
  if (agent.pnl_pct > 2) {
    // Feliz ↑
    ctx.fillRect(s.x - 6*z, s.y - 27*z, 4*z, 4*z);
    ctx.fillRect(s.x + 2*z, s.y - 27*z, 4*z, 4*z);
  } else if (agent.pnl_pct < -2) {
    // Triste ↓
    ctx.fillRect(s.x - 6*z, s.y - 24*z, 4*z, 4*z);
    ctx.fillRect(s.x + 2*z, s.y - 24*z, 4*z, 4*z);
  } else {
    // Neutro =
    ctx.fillRect(s.x - 6*z, s.y - 26*z, 4*z, 3*z);
    ctx.fillRect(s.x + 2*z, s.y - 26*z, 4*z, 3*z);
  }
  
  // Antena
  ctx.strokeStyle = color;
  ctx.lineWidth = 2*z;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - 32*z);
  ctx.lineTo(s.x, s.y - 38*z);
  ctx.stroke();
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(s.x, s.y - 38*z, 2.5*z, 0, Math.PI*2);
  ctx.fill();
  
  // Badge de geração
  const gen = agent.generation || 1;
  if (gen > 1) {
    ctx.fillStyle = "#e056fd";
    ctx.beginPath();
    ctx.arc(s.x + 12*z, s.y - 30*z, 7*z, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${6*z}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("G"+gen, s.x + 12*z, s.y - 27*z);
    ctx.textAlign = "left";
  }
  
  // Tooltip ao hover
  const hover = isHovered(s, 18*z, 40*z);
  if (hover) {
    hoveredAgent = agent;
    showTooltip(agent, mouse.cx + 12, mouse.cy - 10);
  }
  
  // Balão de fala com ação recente
  const lastTrade = agent.trades && agent.trades[0];
  if (lastTrade && Math.random() > 0.99) {
    agent._bubble = { text: `${lastTrade.side} ${lastTrade.symbol}`, t: time };
  }
  if (agent._bubble && time - agent._bubble.t < 3) {
    drawBubble(s.x, s.y - 44*z, agent._bubble.text, agent.pnl_pct >= 0 ? "#00ff88" : "#ff4466", z);
  }
}

function drawBubble(sx, sy, text, color, z) {
  ctx.fillStyle = "rgba(0,0,0,0.8)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.font = `${7*z}px monospace`;
  const tw = ctx.measureText(text).width + 8*z;
  const bh = 12*z;
  ctx.fillRect(sx - tw/2, sy - bh, tw, bh);
  ctx.strokeRect(sx - tw/2, sy - bh, tw, bh);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, sx, sy - 3*z);
  ctx.textAlign = "left";
}

// ── HIT TEST ──────────────────────────────────────────────
function isHovered(s, hw, hh) {
  return mouse.cx > s.x - hw && mouse.cx < s.x + hw &&
         mouse.cy > s.y - hh && mouse.cy < s.y;
}

// ── TOOLTIP ───────────────────────────────────────────────
function showTooltip(agent, tx, ty) {
  const pnlClass = agent.pnl_pct >= 0 ? "up" : "dn";
  document.getElementById("tt-name").textContent  = `${agent.emoji} ${agent.name}`;
  document.getElementById("tt-class").textContent = `⚙️ ${agent.class}`;
  document.getElementById("tt-gen").textContent   = `🧬 Geração ${agent.generation || 1}`;
  document.getElementById("tt-sym").textContent   = `📈 ${(agent.symbols||[]).join(", ")}`;
  document.getElementById("tt-bal").textContent   = `💰 Balance: $${agent.balance.toFixed(2)}`;
  const pnlEl = document.getElementById("tt-pnl");
  pnlEl.textContent = `${agent.pnl_pct >= 0 ? "▲" : "▼"} $${agent.value.toFixed(2)} (${agent.pnl_pct >= 0 ? "+" : ""}${agent.pnl_pct.toFixed(2)}%)`;
  pnlEl.className = "tt-pnl " + pnlClass;
  tooltip.style.left = tx + "px";
  tooltip.style.top  = ty + "px";
  tooltip.classList.add("show");
}

canvas.addEventListener("mousemove", () => {
  if (!hoveredAgent) tooltip.classList.remove("show");
  hoveredAgent = null;
});

// ── COR HELPERS ───────────────────────────────────────────
function shadeColor(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + pct));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + pct));
  const b = Math.max(0, Math.min(255, (n & 0xff) + pct));
  return `rgb(${r},${g},${b})`;
}
function lightenColor(hex, pct) { return shadeColor(hex, pct); }

// ── MINI GRÁFICO ──────────────────────────────────────────
function drawMiniChart() {
  const W = miniCanvas.width, H = miniCanvas.height;
  miniCtx.clearRect(0, 0, W, H);
  miniCtx.fillStyle = "rgba(0,0,0,0.4)";
  miniCtx.fillRect(0, 0, W, H);
  
  const allVals = agentsData.flatMap(a => (a.history || []).map(h => h.v));
  if (allVals.length < 2) return;
  
  const minV = Math.min(...allVals, 90), maxV = Math.max(...allVals, 110);
  const range = maxV - minV || 1;
  const PAD = 22;
  const cw = W - PAD*2, ch = H - PAD*2;
  
  // $100 baseline
  const baseY = H - PAD - ((100 - minV) / range) * ch;
  miniCtx.strokeStyle = "#333";
  miniCtx.setLineDash([4,4]);
  miniCtx.lineWidth = 1;
  miniCtx.beginPath();
  miniCtx.moveTo(PAD, baseY); miniCtx.lineTo(W - PAD, baseY);
  miniCtx.stroke();
  miniCtx.setLineDash([]);
  miniCtx.fillStyle = "#444";
  miniCtx.font = "9px monospace";
  miniCtx.fillText("$100", 2, baseY - 2);
  
  // Linhas de cada agente
  agentsData.forEach((agent, idx) => {
    const pts = agent.history || [];
    if (pts.length < 2) return;
    const xStep = cw / Math.max(pts.length - 1, 1);
    const color = C.agentC[idx % C.agentC.length];
    
    miniCtx.strokeStyle = color;
    miniCtx.lineWidth = 1.5;
    miniCtx.globalAlpha = idx < 3 ? 1 : 0.5;
    miniCtx.beginPath();
    pts.forEach((p, i) => {
      const px = PAD + i * xStep;
      const py = H - PAD - ((p.v - minV) / range) * ch;
      i === 0 ? miniCtx.moveTo(px, py) : miniCtx.lineTo(px, py);
    });
    miniCtx.stroke();
  });
  miniCtx.globalAlpha = 1;
}

// ── RANKING LATERAL ───────────────────────────────────────
function updateRanking() {
  const el = document.getElementById("ranking-list");
  el.innerHTML = "";
  agentsData.forEach((a, i) => {
    const pnlC = a.pnl_pct > 0 ? "up" : a.pnl_pct < 0 ? "dn" : "nt";
    const div = document.createElement("div");
    div.className = "rank-row" + (i===0 ? " leader" : "");
    div.innerHTML = `
      <div class="rr-pos">${["🥇","🥈","🥉"][i] || i+1}</div>
      <div class="rr-emoji">${a.emoji}</div>
      <div class="rr-info">
        <div class="rr-name">${a.name}</div>
        <div class="rr-gen">Gen ${a.generation||1} · ${a.class}</div>
        <div class="rr-val">$${a.value.toFixed(2)}</div>
      </div>
      <div class="rr-pnl ${pnlC}">${a.pnl_pct>=0?"+":""}${a.pnl_pct.toFixed(1)}%</div>
    `;
    el.appendChild(div);
  });
}

// ── FEED DE ATIVIDADE ─────────────────────────────────────
function addActivity(emoji, name, type, text, color) {
  const feed = document.getElementById("activity-feed");
  const div  = document.createElement("div");
  div.className = `act-item ${type}`;
  const now = new Date().toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit",second:"2-digit"});
  div.innerHTML = `
    <span class="act-agent">${emoji} ${name}</span>
    <span class="act-${type}">${text}</span>
    <span class="act-time">${now}</span>
  `;
  feed.insertBefore(div, feed.firstChild);
  while (feed.children.length > 30) feed.removeChild(feed.lastChild);
}

// ── TOPBAR STATS ──────────────────────────────────────────
function updateTopbar() {
  document.getElementById("count-active").textContent = agentsData.length;
  const maxGen = Math.max(...agentsData.map(a => a.generation || 1));
  document.getElementById("count-gen").textContent = maxGen;
  document.getElementById("count-elim").textContent = elimCount;
}

// ── RENDER PRINCIPAL ──────────────────────────────────────
function renderOffice() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Fundo estrelas
  ctx.fillStyle = "#080818";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Piso (renderizado de fundo para frente, para oclusão correta)
  // Paredes de fundo primeiro
  for (let gx = 0; gx < ROOM_W; gx++) {
    drawWallBack(gx, 0);
  }
  for (let gy = 0; gy < ROOM_H; gy++) {
    drawWallLeft(0, gy);
  }
  
  // Piso
  for (let gy = 0; gy < ROOM_H; gy++) {
    for (let gx = 0; gx < ROOM_W; gx++) {
      const alt = (gx + gy) % 2 === 0;
      drawTile(gx, gy, alt ? C.floor1 : C.floor2);
    }
  }
  
  // Plantas nos cantos
  drawPlant(0, ROOM_H - 1);
  drawPlant(ROOM_W - 1, 0);
  drawPlant(0, 1);
  drawPlant(ROOM_W - 1, ROOM_H - 2);
  
  // TV na parede
  drawWallTV();
  
  // Mesas, cadeiras, robôs (ordenados por gy para oclusão correta)
  const desksSorted = [...DESKS].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
  
  desksSorted.forEach((desk, i) => {
    drawChair(desk.gx, desk.gy);
    drawDesk(desk.gx, desk.gy, i);
    
    if (agentsData[i]) {
      drawRobot(desk.gx - 0.5, desk.gy - 0.5, agentsData[i], i);
    }
  });
  
  time += 0.016;
}

// ── RECEBER DADOS ─────────────────────────────────────────
function onData(data) {
  if (!data || !data.length) return;
  
  // Detectar novos trades e evolução
  data.forEach(agent => {
    if (agent.trades && agent.trades[0]) {
      const t = agent.trades[0];
      const key = `${agent.id}-${t.id}`;
      if (!activityLog.has(key)) {
        activityLog.add(key);
        addActivity(agent.emoji, agent.name, t.side.toLowerCase(),
          `${t.side} ${t.symbol} @ $${Number(t.price).toFixed(2)}`, "");
      }
    }
    
    if ((agent.generation || 1) > 1) {
      const gkey = `evolved-${agent.id}`;
      if (!activityLog.has(gkey)) {
        activityLog.add(gkey);
        elimCount++;
        addActivity(agent.emoji, agent.name, "ev",
          `🧬 EVOLUÇÃO Gen ${agent.generation}`, "");
      }
    }
  });
  
  agentsData = data;
  updateRanking();
  updateTopbar();
  drawMiniChart();
}

// ── WEBSOCKET ─────────────────────────────────────────────
function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  
  ws.onopen = () => {
    document.getElementById("status").textContent = "🟢 Conectado";
  };
  ws.onmessage = e => {
    try { onData(JSON.parse(e.data)); } catch(err) { console.error(err); }
  };
  ws.onclose = () => {
    document.getElementById("status").textContent = "🔴 Reconectando...";
    setTimeout(connect, 3000);
  };
  ws.onerror = () => ws.close();
  setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send("ping"); }, 15000);
}

// ── RELÓGIO ───────────────────────────────────────────────
setInterval(() => {
  document.getElementById("clock").textContent =
    new Date().toLocaleTimeString("pt-BR");
}, 1000);

// ── BOOT ──────────────────────────────────────────────────
fetch("/api/agents").then(r => r.json()).then(onData).catch(console.error);
connect();

// Loop de animação
(function loop() {
  renderOffice();
  requestAnimationFrame(loop);
})();

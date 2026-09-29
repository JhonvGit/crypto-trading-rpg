/* ═══════════════════════════════════════════════════════════
   Trading Office — Isométrico 3D · 10 Robôs Traders
   Textos de decisão · Mini-gráficos · Modal · Knowledge Share
   ═══════════════════════════════════════════════════════════ */

// ── CANVAS / ELEMENTOS ────────────────────────────────────
const wrap       = document.getElementById("office-wrap");
const canvas     = document.getElementById("office-canvas");
const ctx        = canvas.getContext("2d");
const miniCanvas = document.getElementById("mini-chart");
const miniCtx    = miniCanvas.getContext("2d");
miniCanvas.width  = 290;
miniCanvas.height = 110;

function resizeCanvas() {
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ── CÂMERA ────────────────────────────────────────────────
let cam  = { x: 0, y: -60, zoom: 1.0 };
let drag = { down: false, sx: 0, sy: 0, cx: 0, cy: 0 };
let mouse = { cx: -999, cy: -999 };

canvas.addEventListener("mousedown", e => {
  drag.down = true;
  drag.sx = e.clientX; drag.sy = e.clientY;
  drag.cx = cam.x;    drag.cy = cam.y;
});
window.addEventListener("mouseup",   () => drag.down = false);
window.addEventListener("mousemove", e => {
  if (drag.down) {
    cam.x = drag.cx + (e.clientX - drag.sx);
    cam.y = drag.cy + (e.clientY - drag.sy);
  }
  const r = canvas.getBoundingClientRect();
  mouse.cx = e.clientX - r.left;
  mouse.cy = e.clientY - r.top;
});
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  cam.zoom = Math.max(0.4, Math.min(2.5, cam.zoom - e.deltaY * 0.001));
}, { passive: false });

document.getElementById("btn-zi").onclick = () => cam.zoom = Math.min(2.5, cam.zoom + 0.15);
document.getElementById("btn-zo").onclick = () => cam.zoom = Math.max(0.4, cam.zoom - 0.15);
document.getElementById("btn-zr").onclick = () => { cam.x = 0; cam.y = -60; cam.zoom = 1.0; };

// Clique no canvas para abrir modal
canvas.addEventListener("click", e => {
  const r = canvas.getBoundingClientRect();
  const cx = e.clientX - r.left, cy = e.clientY - r.top;
  DESKS.forEach((desk, i) => {
    if (!agentsData[i]) return;
    const { x, y } = iso(desk.gx - 0.5, desk.gy - 0.5);
    const s = world2screen(x, y);
    const z = cam.zoom;
    if (cx > s.x - 18*z && cx < s.x + 18*z && cy > s.y - 42*z && cy < s.y + 2*z) {
      openModal(agentsData[i]);
    }
  });
});

// ── PROJEÇÃO ISO ──────────────────────────────────────────
const TILE_W = 64, TILE_H = 32, WALL_H = 80;

function iso(gx, gy) {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) };
}
function world2screen(wx, wy) {
  return {
    x: canvas.width  / 2 + cam.x + wx * cam.zoom,
    y: canvas.height / 2 + cam.y + wy * cam.zoom
  };
}

// ── PALETA ────────────────────────────────────────────────
const C = {
  floor1:"#2a2a40", floor2:"#242438",
  wallL:"#1e1e30",  wallR:"#181828",
  desk:"#4a3a2a",   deskT:"#5a4a3a", deskS:"#3a2a1a",
  chair:"#2a4a3a",
  screen:"#0a0a1a",
  plant1:"#1e3a1e", plant2:"#2a4a2a", pot:"#4a2a2a",
  agentC:["#ffd700","#00ff88","#ff4466","#00bfff","#e056fd",
          "#ff9500","#00ffff","#ff1493","#7fff00","#ff6347"],
};

// ── LAYOUT ────────────────────────────────────────────────
const ROOM_W = 14, ROOM_H = 10;
const DESKS = [
  {gx:2,gy:2},{gx:4,gy:2},{gx:6,gy:2},{gx:8,gy:2},{gx:10,gy:2},
  {gx:2,gy:6},{gx:4,gy:6},{gx:6,gy:6},{gx:8,gy:6},{gx:10,gy:6},
];

// ── ESTADO ────────────────────────────────────────────────
let agentsData   = [];
let activityLog  = new Set();
let elimCount    = 0;
let hoveredAgent = null;
let time         = 0;

// Bolhas de decisão por agente: { text, reason, side, t, alpha }
const decisionBubbles = {};

// ── TILES / PAREDES ───────────────────────────────────────
function drawTile(gx, gy, fill, stroke="#1a1a28") {
  const {x,y} = iso(gx,gy), s = world2screen(x,y);
  const hw = (TILE_W/2)*cam.zoom, hh = (TILE_H/2)*cam.zoom;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y-hh); ctx.lineTo(s.x+hw, s.y);
  ctx.lineTo(s.x, s.y+hh); ctx.lineTo(s.x-hw, s.y);
  ctx.closePath();
  ctx.fillStyle=fill; ctx.strokeStyle=stroke; ctx.lineWidth=0.5;
  ctx.fill(); ctx.stroke();
}

function drawWallBack(gx, gy) {
  const {x,y}=iso(gx,gy), s=world2screen(x,y);
  const hw=(TILE_W/2)*cam.zoom, hh=(TILE_H/2)*cam.zoom, wh=WALL_H*cam.zoom;
  ctx.strokeStyle="#0f0f1a"; ctx.lineWidth=1;
  [[C.wallL,[s.x-hw,s.y,s.x,s.y-hh,s.x,s.y-hh-wh,s.x-hw,s.y-wh]],
   [C.wallR,[s.x,s.y-hh,s.x+hw,s.y,s.x+hw,s.y-wh,s.x,s.y-hh-wh]]
  ].forEach(([fill,pts])=>{
    ctx.beginPath(); ctx.moveTo(pts[0],pts[1]);
    for(let i=2;i<pts.length;i+=2) ctx.lineTo(pts[i],pts[i+1]);
    ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); ctx.stroke();
  });
}

function drawWallLeft(gx, gy) {
  const {x,y}=iso(gx,gy), s=world2screen(x,y);
  const hw=(TILE_W/2)*cam.zoom, hh=(TILE_H/2)*cam.zoom, wh=WALL_H*cam.zoom;
  ctx.beginPath();
  ctx.moveTo(s.x-hw,s.y); ctx.lineTo(s.x,s.y+hh);
  ctx.lineTo(s.x,s.y+hh-wh); ctx.lineTo(s.x-hw,s.y-wh);
  ctx.closePath();
  ctx.fillStyle=C.wallL; ctx.strokeStyle="#0f0f1a"; ctx.lineWidth=1;
  ctx.fill(); ctx.stroke();
}

// ── MÓVEIS ────────────────────────────────────────────────
function drawDesk(gx, gy, idx) {
  const {x,y}=iso(gx,gy), s=world2screen(x,y);
  const z=cam.zoom, hw=(TILE_W/2-4)*z, hh=(TILE_H/2-2)*z, dh=20*z;
  // topo
  ctx.beginPath();
  ctx.moveTo(s.x,s.y-dh-hh); ctx.lineTo(s.x+hw,s.y-dh);
  ctx.lineTo(s.x,s.y-dh+hh); ctx.lineTo(s.x-hw,s.y-dh);
  ctx.closePath(); ctx.fillStyle=C.deskT; ctx.strokeStyle="#2a1a0a";
  ctx.lineWidth=1; ctx.fill(); ctx.stroke();
  // lado esq
  ctx.beginPath();
  ctx.moveTo(s.x-hw,s.y-dh); ctx.lineTo(s.x,s.y-dh+hh);
  ctx.lineTo(s.x,s.y+hh); ctx.lineTo(s.x-hw,s.y);
  ctx.closePath(); ctx.fillStyle=C.desk; ctx.fill(); ctx.stroke();
  // lado dir
  ctx.beginPath();
  ctx.moveTo(s.x,s.y-dh+hh); ctx.lineTo(s.x+hw,s.y-dh);
  ctx.lineTo(s.x+hw,s.y); ctx.lineTo(s.x,s.y+hh);
  ctx.closePath(); ctx.fillStyle=C.deskS; ctx.fill(); ctx.stroke();
  // monitor com mini-gráfico
  drawMonitor(s.x-6*z, s.y-dh-14*z, z, idx);
  // teclado
  ctx.fillStyle="#2a2a3a";
  ctx.fillRect(s.x+2*z, s.y-dh-2*z, 14*z, 5*z);
}

function drawMonitor(sx, sy, z, idx) {
  const w=26*z, h=20*z;
  ctx.fillStyle="#1a1a2a";
  ctx.fillRect(sx-w/2, sy-h, w, h);
  const agent = agentsData[idx];
  if (agent) {
    const bg = agent.pnl_pct >= 0 ? "#003820" : "#380018";
    ctx.fillStyle = bg;
    ctx.fillRect(sx-w/2+2*z, sy-h+2*z, w-4*z, h-4*z);
    // sparkline de velas simplificadas
    const hist = agent.history || [];
    if (hist.length > 1) {
      const tw=w-6*z, th=h-6*z;
      const ox=sx-w/2+3*z, oy=sy-4*z;
      const vals = hist.map(p=>p.v);
      const minV=Math.min(...vals), maxV=Math.max(...vals);
      const range=maxV-minV||1;
      ctx.strokeStyle = agent.pnl_pct>=0?"#00ff88":"#ff4466";
      ctx.lineWidth=1;
      ctx.beginPath();
      hist.forEach((p,i)=>{
        const px=ox+(i/Math.max(hist.length-1,1))*tw;
        const py=oy-((p.v-minV)/range)*th;
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      });
      ctx.stroke();
      // RSI bar no fundo do monitor
      if (agent.last_decision) {
        const rsi = agent.last_decision.rsi||50;
        const rsiW = ((w-4*z)*(rsi/100));
        ctx.fillStyle = rsi<35?"#00ff88":rsi>65?"#ff4466":"#ffd700";
        ctx.globalAlpha=0.4;
        ctx.fillRect(sx-w/2+2*z, sy-4*z, rsiW, 2*z);
        ctx.globalAlpha=1;
      }
    } else {
      ctx.fillStyle="#00ff8830";
      ctx.font=`${5*z}px monospace`;
      ctx.textAlign="center";
      ctx.fillText("aguard", sx, sy-h/2+2*z);
      ctx.textAlign="left";
    }
    // LED
    const blink=Math.sin(time*5+idx)>0?1:0.3;
    ctx.globalAlpha=blink;
    ctx.fillStyle=agent.pnl_pct>=0?"#00ff88":"#ff4466";
    ctx.fillRect(sx+w/2-5*z, sy-h+2*z, 3*z, 3*z);
    ctx.globalAlpha=1;
  } else {
    ctx.fillStyle="#0a0a1a";
    ctx.fillRect(sx-w/2+2*z, sy-h+2*z, w-4*z, h-4*z);
  }
  ctx.fillStyle="#111";
  ctx.fillRect(sx-2*z, sy, 4*z, 6*z);
}

function drawChair(gx, gy) {
  const {x,y}=iso(gx-0.5,gy+0.5), s=world2screen(x,y), z=cam.zoom;
  ctx.fillStyle=C.chair; ctx.strokeStyle="#0a1a0a"; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.arc(s.x,s.y,10*z,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillRect(s.x-6*z, s.y-22*z, 12*z, 14*z);
}

function drawPlant(gx, gy) {
  const {x,y}=iso(gx,gy), s=world2screen(x,y), z=cam.zoom;
  ctx.fillStyle=C.pot;
  ctx.beginPath();
  ctx.moveTo(s.x-8*z,s.y); ctx.lineTo(s.x+8*z,s.y);
  ctx.lineTo(s.x+5*z,s.y+12*z); ctx.lineTo(s.x-5*z,s.y+12*z);
  ctx.closePath(); ctx.fill();
  [[0,-1],[-.8,-.5],[.8,-.5]].forEach(([dx,dy])=>{
    ctx.fillStyle=dx===0?C.plant1:C.plant2;
    ctx.beginPath();
    ctx.ellipse(s.x+dx*14*z,s.y+dy*14*z,10*z,14*z,dx*0.5,0,Math.PI*2);
    ctx.fill();
  });
}

// ── TV NA PAREDE ──────────────────────────────────────────
function drawWallTV() {
  const {x,y}=iso(6,0), s=world2screen(x,y-WALL_H*0.6);
  const z=cam.zoom, w=80*z, h=46*z;
  ctx.fillStyle="#0a0a1a"; ctx.strokeStyle="#ffd700"; ctx.lineWidth=2;
  ctx.fillRect(s.x-w/2,s.y-h,w,h); ctx.strokeRect(s.x-w/2,s.y-h,w,h);
  ctx.fillStyle="#001a00";
  ctx.fillRect(s.x-w/2+3*z,s.y-h+3*z,w-6*z,h-6*z);
  ctx.fillStyle="#00ff88"; ctx.font=`bold ${8*z}px monospace`;
  ctx.textAlign="center";
  ctx.fillText("📊 TRADING OFFICE", s.x, s.y-h+14*z);
  const best=agentsData[0];
  if (best) {
    const col=best.pnl_pct>=0?"#00ff88":"#ff4466";
    ctx.fillStyle=col; ctx.font=`${7*z}px monospace`;
    ctx.fillText(`👑 ${best.emoji} ${best.name}`, s.x, s.y-h+27*z);
    ctx.fillText(`$${best.value.toFixed(2)}  ${best.pnl_pct>=0?"+":""}${best.pnl_pct.toFixed(1)}%  fee=$${(best.total_fees||0).toFixed(3)}`, s.x, s.y-h+38*z);
  }
  ctx.textAlign="left";
}

// ── PAINEL DE KNOWLEDGE SHARE (canto esq) ─────────────────
function drawKnowledgePanel() {
  if (!agentsData.length) return;
  const {x,y}=iso(0.5,7), s=world2screen(x,y-WALL_H*0.5);
  const z=cam.zoom;
  if (z < 0.6) return; // só mostra em zoom suficiente
  const w=70*z, h=50*z;
  ctx.fillStyle="rgba(5,5,20,0.85)";
  ctx.strokeStyle="#e056fd"; ctx.lineWidth=1;
  ctx.fillRect(s.x-w/2,s.y-h,w,h);
  ctx.strokeRect(s.x-w/2,s.y-h,w,h);
  ctx.fillStyle="#e056fd"; ctx.font=`bold ${6*z}px monospace`;
  ctx.textAlign="center";
  ctx.fillText("🔗 KNOWLEDGE", s.x, s.y-h+9*z);
  ctx.fillStyle="#aaa"; ctx.font=`${5.5*z}px monospace`;
  // contar signals shared
  const buys  = agentsData.filter(a=>a.last_decision&&a.last_decision.side==="BUY").length;
  const sells = agentsData.filter(a=>a.last_decision&&a.last_decision.side==="SELL").length;
  ctx.fillStyle="#00ff88";
  ctx.fillText(`▲ ${buys} BUY signals`, s.x, s.y-h+22*z);
  ctx.fillStyle="#ff4466";
  ctx.fillText(`▼ ${sells} SELL signals`, s.x, s.y-h+34*z);
  ctx.fillStyle="#888";
  ctx.fillText(`pool ativo`, s.x, s.y-h+44*z);
  ctx.textAlign="left";
}

// ── ROBÔ TRADER ───────────────────────────────────────────
function drawRobot(gx, gy, agent, idx) {
  const bobY = Math.sin(time*2+idx*1.2)*2;
  const {x,y}=iso(gx,gy), s=world2screen(x,y+bobY);
  const z=cam.zoom, color=C.agentC[idx%C.agentC.length];

  // Sombra
  ctx.fillStyle="rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.ellipse(s.x,s.y+4*z,12*z,5*z,0,0,Math.PI*2); ctx.fill();

  // Pernas
  ctx.fillStyle="#1a1a2a";
  ctx.fillRect(s.x-8*z,s.y+2*z,6*z,10*z);
  ctx.fillRect(s.x+2*z,s.y+2*z,6*z,10*z);

  // Corpo
  const bg=ctx.createLinearGradient(s.x-12*z,s.y-16*z,s.x+12*z,s.y+2*z);
  bg.addColorStop(0,color); bg.addColorStop(1,shade(color,-40));
  ctx.fillStyle=bg; ctx.strokeStyle="#000"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.roundRect(s.x-12*z,s.y-16*z,24*z,20*z,4*z);
  ctx.fill(); ctx.stroke();

  // LEDs piscando no corpo
  const led=Math.sin(time*5+idx)>0?1:0.4;
  ctx.globalAlpha=led;
  ctx.fillStyle=agent.pnl_pct>=0?"#00ff88":"#ff4466";
  [-6,0,6].forEach(ox=>{
    ctx.beginPath(); ctx.arc(s.x+ox*z,s.y-8*z,2.5*z,0,Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha=1;

  // Braços animados
  const arm=Math.sin(time*2+idx)*0.3;
  ctx.strokeStyle=color; ctx.lineWidth=4*z; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(s.x-12*z,s.y-12*z); ctx.lineTo(s.x-18*z,s.y-6*z+arm*8*z); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s.x+12*z,s.y-12*z); ctx.lineTo(s.x+18*z,s.y-6*z-arm*8*z); ctx.stroke();

  // Cabeça
  const hg=ctx.createLinearGradient(s.x-10*z,s.y-32*z,s.x+10*z,s.y-16*z);
  hg.addColorStop(0,shade(color,20)); hg.addColorStop(1,color);
  ctx.fillStyle=hg; ctx.strokeStyle="#000"; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.roundRect(s.x-10*z,s.y-32*z,20*z,16*z,4*z);
  ctx.fill(); ctx.stroke();

  // Display dos olhos
  const eyC=agent.pnl_pct>=0?"#00ff88":"#ff4466";
  ctx.fillStyle=C.screen; ctx.fillRect(s.x-8*z,s.y-30*z,16*z,10*z);
  ctx.fillStyle=eyC;
  if (agent.pnl_pct>2) {
    ctx.fillRect(s.x-6*z,s.y-27*z,4*z,4*z); ctx.fillRect(s.x+2*z,s.y-27*z,4*z,4*z);
  } else if (agent.pnl_pct<-2) {
    ctx.fillRect(s.x-6*z,s.y-24*z,4*z,4*z); ctx.fillRect(s.x+2*z,s.y-24*z,4*z,4*z);
  } else {
    ctx.fillRect(s.x-6*z,s.y-26*z,4*z,3*z); ctx.fillRect(s.x+2*z,s.y-26*z,4*z,3*z);
  }

  // Antena
  ctx.strokeStyle=color; ctx.lineWidth=2*z;
  ctx.beginPath(); ctx.moveTo(s.x,s.y-32*z); ctx.lineTo(s.x,s.y-40*z); ctx.stroke();
  ctx.fillStyle=eyC; ctx.beginPath(); ctx.arc(s.x,s.y-40*z,3*z,0,Math.PI*2); ctx.fill();

  // Badge geração
  const gen=agent.generation||1;
  if (gen>1) {
    ctx.fillStyle="#e056fd";
    ctx.beginPath(); ctx.arc(s.x+12*z,s.y-30*z,7*z,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff"; ctx.font=`bold ${6*z}px monospace`; ctx.textAlign="center";
    ctx.fillText("G"+gen,s.x+12*z,s.y-27*z); ctx.textAlign="left";
  }

  // ── TEXTO DE DECISÃO ACIMA DO ROBÔ ────────────────────
  drawDecisionText(s, z, agent, idx);

  // ── TOOLTIP ao hover ──────────────────────────────────
  if (isHovered(s,18*z,44*z)) {
    hoveredAgent=agent;
    showTooltip(agent);
  }
}

// ── TEXTO DE DECISÃO ─────────────────────────────────────
function drawDecisionText(s, z, agent, idx) {
  if (z < 0.6) return; // só aparece com zoom adequado

  const dec = agent.last_decision;
  const lastTrade = agent.trades && agent.trades[0];

  // Linha 1: Razão da decisão (da API /decisions)
  let reasonText = null;
  if (dec && dec.reason) {
    reasonText = `${dec.side==="BUY"?"▲":"▼"} ${dec.symbol||""}: ${dec.reason}`;
  } else if (lastTrade) {
    reasonText = `${lastTrade.side} ${lastTrade.symbol} @ $${Number(lastTrade.price).toFixed(2)}`;
  }

  // Linha 2: Indicadores em tempo real
  let indLine = null;
  if (dec) {
    indLine = `RSI ${(dec.rsi||0).toFixed(0)} · M${(dec.momentum||0)>=0?"+":""}${(dec.momentum||0).toFixed(1)}% · Z${(dec.zscore||0).toFixed(1)}σ`;
  }

  // Linha 3: Knowledge share
  let shareText = null;
  if (dec && (dec.shared_buy>0||dec.shared_sell>0)) {
    shareText = `🔗 ${dec.shared_buy} buy / ${dec.shared_sell} sell (comunidade)`;
  }

  if (!reasonText && !indLine) return;

  const lineH = 10*z;
  const lines = [reasonText, indLine, shareText].filter(Boolean);
  const totalH = lines.length * lineH + 6*z;
  const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
  const boxW = maxW + 12*z;

  const bx = s.x - boxW/2;
  const by = s.y - 44*z - totalH - 6*z;

  // Fundo semi-transparente com borda colorida
  const borderCol = dec && dec.side==="BUY" ? "#00ff88" : dec && dec.side==="SELL" ? "#ff4466" : "#ffd700";
  ctx.fillStyle = "rgba(5,5,20,0.88)";
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, totalH, 4*z);
  ctx.fill();
  ctx.stroke();

  // Seta apontando para o robô
  ctx.fillStyle = borderCol;
  ctx.beginPath();
  ctx.moveTo(s.x-4*z, by+totalH); ctx.lineTo(s.x+4*z, by+totalH); ctx.lineTo(s.x, by+totalH+5*z);
  ctx.closePath(); ctx.fill();

  // Textos
  ctx.font = `bold ${7*z}px 'Segoe UI', monospace`;
  ctx.textAlign = "center";
  lines.forEach((line, i) => {
    let col = "#e0e0ff";
    if (i===0) col = borderCol;
    else if (i===1) col = "#aaaadd";
    else if (i===2) col = "#e056fd";
    ctx.fillStyle = col;
    ctx.fillText(line, s.x, by + (i+1)*lineH + 1*z);
  });
  ctx.textAlign = "left";

  // ── Mini sparkline de RSI no balão ──────────────────
  if (dec && agent.history && agent.history.length > 3) {
    const chartY = by + totalH - 1*z;
    const chartH = 8*z;
    const chartW = boxW - 6*z;
    const chartX = bx + 3*z;
    // área
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(chartX, chartY-chartH, chartW, chartH);
    // linha
    const vals = agent.history.slice(-20).map(h=>h.v);
    const mn=Math.min(...vals), mx=Math.max(...vals), rng=mx-mn||0.01;
    ctx.strokeStyle = borderCol; ctx.lineWidth=1;
    ctx.beginPath();
    vals.forEach((v,i)=>{
      const px=chartX+i/(vals.length-1)*chartW;
      const py=chartY-((v-mn)/rng)*chartH;
      i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    });
    ctx.stroke();
  }
}

// ── TOOLTIP ────────────────────────────────────────────────
const tooltip = document.getElementById("tooltip");
function showTooltip(agent) {
  const pnlC = agent.pnl_pct>=0?"up":"dn";
  document.getElementById("tt-name").textContent  = `${agent.emoji} ${agent.name}`;
  document.getElementById("tt-class").textContent = `⚙️ ${agent.class}`;
  document.getElementById("tt-fees").textContent  = `💸 Fees: $${(agent.total_fees||0).toFixed(4)}`;
  document.getElementById("tt-sym").textContent   = `📈 ${(agent.symbols||[]).join(", ")}`;
  document.getElementById("tt-bal").textContent   = `💰 Cash: $${agent.balance.toFixed(2)}  Patrimônio: $${agent.value.toFixed(2)}`;
  const el = document.getElementById("tt-pnl");
  el.textContent = `${agent.pnl_pct>=0?"▲":"▼"} ${agent.pnl_pct>=0?"+":""}${agent.pnl_pct.toFixed(2)}% sobre $${agent.initial_balance||50}`;
  el.className = "tt-pnl " + pnlC;
  tooltip.style.left = (mouse.cx+14)+"px";
  tooltip.style.top  = (mouse.cy-10)+"px";
  tooltip.classList.add("show");
}
canvas.addEventListener("mousemove", ()=>{ if(!hoveredAgent) tooltip.classList.remove("show"); hoveredAgent=null; });

// ── HIT TEST ──────────────────────────────────────────────
function isHovered(s, hw, hh) {
  return mouse.cx>s.x-hw && mouse.cx<s.x+hw && mouse.cy>s.y-hh && mouse.cy<s.y;
}

// ── COR HELPERS ───────────────────────────────────────────
function shade(hex, p) {
  const n=parseInt(hex.slice(1),16);
  const r=Math.max(0,Math.min(255,(n>>16)+p));
  const g=Math.max(0,Math.min(255,((n>>8)&0xff)+p));
  const b=Math.max(0,Math.min(255,(n&0xff)+p));
  return `rgb(${r},${g},${b})`;
}

// ── MINI CHART LATERAL ────────────────────────────────────
function drawMiniChart() {
  const W=miniCanvas.width, H=miniCanvas.height;
  miniCtx.clearRect(0,0,W,H);
  miniCtx.fillStyle="rgba(0,0,0,0.4)"; miniCtx.fillRect(0,0,W,H);
  const allVals=agentsData.flatMap(a=>(a.history||[]).map(h=>h.v));
  if (allVals.length<2) return;
  const minV=Math.min(...allVals,45), maxV=Math.max(...allVals,55);
  const range=maxV-minV||1, PAD=20, cw=W-PAD*2, ch=H-PAD*2;
  // linha de aporte $50
  const baseY=H-PAD-((50-minV)/range)*ch;
  miniCtx.strokeStyle="#444"; miniCtx.setLineDash([4,4]); miniCtx.lineWidth=1;
  miniCtx.beginPath(); miniCtx.moveTo(PAD,baseY); miniCtx.lineTo(W-PAD,baseY); miniCtx.stroke();
  miniCtx.setLineDash([]);
  miniCtx.fillStyle="#555"; miniCtx.font="9px monospace";
  miniCtx.fillText("$50",2,baseY-2);
  // top 3 agentes
  agentsData.slice(0,3).forEach((agent,idx)=>{
    const pts=agent.history||[];
    if(pts.length<2) return;
    const xStep=cw/Math.max(pts.length-1,1);
    const color=C.agentC[idx%C.agentC.length];
    miniCtx.strokeStyle=color; miniCtx.lineWidth=2; miniCtx.globalAlpha=1;
    miniCtx.beginPath();
    pts.forEach((p,i)=>{
      const px=PAD+i*xStep, py=H-PAD-((p.v-minV)/range)*ch;
      i===0?miniCtx.moveTo(px,py):miniCtx.lineTo(px,py);
    });
    miniCtx.stroke();
    // nome do agente no final
    if(pts.length>0){
      const last=pts[pts.length-1];
      const lx=PAD+(pts.length-1)*xStep, ly=H-PAD-((last.v-minV)/range)*ch;
      miniCtx.fillStyle=color; miniCtx.font="8px monospace";
      miniCtx.fillText(agent.emoji,lx+2,ly+3);
    }
  });
  miniCtx.globalAlpha=1;
}

// ── RANKING ───────────────────────────────────────────────
function updateRanking() {
  const el=document.getElementById("ranking-list"); el.innerHTML="";
  agentsData.forEach((a,i)=>{
    const pnlC=a.pnl_pct>0?"up":a.pnl_pct<0?"dn":"nt";
    const div=document.createElement("div");
    div.className="rank-row"+(i===0?" leader":"");
    div.innerHTML=`
      <div class="rr-pos">${["🥇","🥈","🥉"][i]||i+1}</div>
      <div class="rr-emoji">${a.emoji}</div>
      <div class="rr-info">
        <div class="rr-name">${a.name}</div>
        <div class="rr-meta">Gen ${a.generation||1} · ${a.win_rate||0}% win · ${a.total_trades||0} trades</div>
        <div class="rr-val">$${a.value.toFixed(2)} <span style="color:#888;font-size:0.68rem">fee $${(a.total_fees||0).toFixed(3)}</span></div>
      </div>
      <div class="rr-pnl ${pnlC}">${a.pnl_pct>=0?"+":""}${a.pnl_pct.toFixed(1)}%</div>
    `;
    div.onclick=()=>openModal(a);
    el.appendChild(div);
  });
}

// ── FEED DE ATIVIDADE ─────────────────────────────────────
function addActivity(emoji, name, type, text, fee) {
  const feed=document.getElementById("activity-feed");
  const div=document.createElement("div"); div.className=`act-item ${type}`;
  const now=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const feeStr = fee>0?`<span class="act-fee"> fee $${fee.toFixed(4)}</span>`:"";
  div.innerHTML=`
    <span class="act-agent">${emoji} ${name}</span>
    <span class="act-${type}">${text}</span>${feeStr}
    <span class="act-time">${now}</span>
  `;
  feed.insertBefore(div,feed.firstChild);
  while(feed.children.length>35) feed.removeChild(feed.lastChild);
}

// ── TOPBAR ─────────────────────────────────────────────────
function updateTopbar() {
  document.getElementById("count-active").textContent=agentsData.filter(a=>a.status==="active").length;
  document.getElementById("count-gen").textContent=Math.max(...agentsData.map(a=>a.generation||1),1);
  document.getElementById("count-elim").textContent=elimCount;
}

// ── RENDER PRINCIPAL ──────────────────────────────────────
function renderOffice() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle="#080818"; ctx.fillRect(0,0,canvas.width,canvas.height);

  // Paredes de fundo
  for(let gx=0;gx<ROOM_W;gx++) drawWallBack(gx,0);
  for(let gy=0;gy<ROOM_H;gy++) drawWallLeft(0,gy);

  // Piso
  for(let gy=0;gy<ROOM_H;gy++)
    for(let gx=0;gx<ROOM_W;gx++)
      drawTile(gx,gy,(gx+gy)%2===0?C.floor1:C.floor2);

  // Plantas
  [[0,ROOM_H-1],[ROOM_W-1,0],[0,1],[ROOM_W-1,ROOM_H-2]].forEach(([gx,gy])=>drawPlant(gx,gy));

  drawWallTV();
  drawKnowledgePanel();

  // Ordena mesas por profundidade isométrica
  const sorted=[...DESKS].sort((a,b)=>(a.gx+a.gy)-(b.gx+b.gy));
  sorted.forEach((desk,i)=>{
    drawChair(desk.gx,desk.gy);
    drawDesk(desk.gx,desk.gy,i);
    if(agentsData[i]) drawRobot(desk.gx-0.5,desk.gy-0.5,agentsData[i],i);
  });

  time+=0.016;
}

// ── MODAL ─────────────────────────────────────────────────
const modal      = document.getElementById("agent-modal");
const modalChart = document.getElementById("modal-chart");
const mCtx       = modalChart.getContext("2d");
let   modalAgent = null;

function openModal(agent) {
  modalAgent = agent;
  modal.classList.add("open");
  // Buscar dados completos da API
  fetch(`/api/agents/${agent.id}`)
    .then(r=>r.json())
    .then(d=>fillModal(d))
    .catch(()=>fillModal(agent));
}

function fillModal(a) {
  document.getElementById("modal-emoji").textContent = a.emoji;
  document.getElementById("modal-name").textContent  = `${a.name}`;
  document.getElementById("modal-class").textContent = `${a.class} — Gen ${a.generation||1} — ${(a.symbols||[]).join(", ")}`;

  // Stats
  const pnlPos = (a.pnl_pct||0)>=0;
  document.getElementById("ms-v").textContent = `$${(a.value||0).toFixed(2)}`;
  document.getElementById("ms-p").textContent = `${pnlPos?"+":""}${(a.pnl_pct||0).toFixed(2)}%`;
  document.getElementById("ms-p").closest(".mstat").className = "mstat "+(pnlPos?"up":"dn");
  document.getElementById("ms-w").textContent = `${a.win_rate||0}%`;
  document.getElementById("ms-f").textContent = `$${(a.total_fees||0).toFixed(4)}`;
  document.getElementById("ms-t").textContent = a.total_trades||0;
  document.getElementById("ms-g").textContent = `Gen ${a.generation||1}`;

  // Aba Estratégia
  document.getElementById("s-desc").textContent  = a.strategy_desc  || "—";
  document.getElementById("s-ml").textContent    = a.ml_tech         || "—";
  document.getElementById("s-model").textContent = a.ml_model        || "—";
  const inds = document.getElementById("s-indicators"); inds.innerHTML="";
  (a.indicators||[]).forEach(ind=>{
    const tag=document.createElement("span"); tag.className="indicator-tag";
    tag.textContent=ind; inds.appendChild(tag);
  });
  const riskEl = document.getElementById("s-risk"); riskEl.innerHTML="";
  const r=a.risk||""; const cls=r.toLowerCase().includes("agress")?"high":r.toLowerCase().includes("conser")?"low":"medium";
  riskEl.innerHTML=`<span class="risk-badge ${cls}">${r||"Moderado"}</span>`;

  // Aba Trades
  const tbody=document.getElementById("trades-tbody"); tbody.innerHTML="";
  const noT=document.getElementById("no-trades");
  const trades=a.trades||[];
  if(trades.length===0){ noT.style.display="block"; }
  else {
    noT.style.display="none";
    trades.forEach(t=>{
      const pnl=Number(t.pnl)||0, fee=Number(t.fee)||0;
      const ts=t.ts?new Date(t.ts).toLocaleTimeString("pt-BR"):"-";
      tbody.innerHTML+=`<tr>
        <td>${ts}</td>
        <td>${t.symbol}</td>
        <td class="side-${t.side.toLowerCase()}">${t.side}</td>
        <td>${Number(t.qty).toFixed(6)}</td>
        <td>$${Number(t.price).toFixed(4)}</td>
        <td class="${pnl>=0?"pnl-pos":"pnl-neg"}">${pnl>=0?"+":""}$${pnl.toFixed(4)}</td>
        <td class="fee-val">$${fee.toFixed(4)}</td>
      </tr>`;
    });
  }

  // Aba Posições
  const ptbody=document.getElementById("pos-tbody"); ptbody.innerHTML="";
  const noP=document.getElementById("no-pos");
  const positions=a.positions||[];
  if(positions.length===0){ noP.style.display="block"; }
  else {
    noP.style.display="none";
    positions.forEach(p=>{
      const col=p.pnl_pct>=0?"#00ff88":"#ff4466";
      ptbody.innerHTML+=`<tr>
        <td>${p.symbol}</td>
        <td>${p.qty}</td>
        <td>$${p.avg_price}</td>
        <td>$${p.cur_price}</td>
        <td style="color:${col}">${p.pnl_pct>=0?"+":""}${p.pnl_pct}%</td>
        <td>$${p.value_usd}</td>
      </tr>`;
    });
  }

  // Overview: last_decision info
  const hist=a.history||[];
  drawModalChart(hist, a.initial_balance||50);

  // Ativar aba overview
  switchTab("overview");
}

function drawModalChart(history, initial) {
  modalChart.width  = modalChart.offsetWidth || 800;
  modalChart.height = 180;
  const W=modalChart.width, H=modalChart.height;
  mCtx.clearRect(0,0,W,H);
  mCtx.fillStyle="#0a0a1a"; mCtx.fillRect(0,0,W,H);
  if(history.length<2) {
    mCtx.fillStyle="#444"; mCtx.font="14px monospace"; mCtx.textAlign="center";
    mCtx.fillText("Aguardando dados...", W/2, H/2);
    return;
  }
  const vals=history.map(h=>h.v);
  const minV=Math.min(...vals,initial*0.8), maxV=Math.max(...vals,initial*1.1);
  const range=maxV-minV||1;
  const PAD=30, cw=W-PAD*2, ch=H-PAD*2;

  // Grade horizontal
  [0,25,50,75,100].forEach(pct=>{
    const v=minV+(range*pct/100);
    const py=H-PAD-((v-minV)/range)*ch;
    mCtx.strokeStyle="#1a1a35"; mCtx.lineWidth=1;
    mCtx.beginPath(); mCtx.moveTo(PAD,py); mCtx.lineTo(W-PAD,py); mCtx.stroke();
    mCtx.fillStyle="#444"; mCtx.font="9px monospace"; mCtx.textAlign="right";
    mCtx.fillText(`$${v.toFixed(1)}`,PAD-3,py+3);
  });

  // Linha de aporte inicial
  const baseY=H-PAD-((initial-minV)/range)*ch;
  mCtx.strokeStyle="#ffd70060"; mCtx.setLineDash([6,4]); mCtx.lineWidth=1.5;
  mCtx.beginPath(); mCtx.moveTo(PAD,baseY); mCtx.lineTo(W-PAD,baseY); mCtx.stroke();
  mCtx.setLineDash([]);
  mCtx.fillStyle="#ffd700"; mCtx.font="9px monospace"; mCtx.textAlign="left";
  mCtx.fillText(`$${initial} (aporte)`,PAD+4,baseY-4);

  // Área sob a curva (gradiente)
  const lastVal=vals[vals.length-1];
  const color=lastVal>=initial?"#00ff88":"#ff4466";
  const grad=mCtx.createLinearGradient(0,PAD,0,H-PAD);
  grad.addColorStop(0,color+"50"); grad.addColorStop(1,color+"00");
  mCtx.beginPath();
  history.forEach((p,i)=>{
    const px=PAD+i/(history.length-1)*cw;
    const py=H-PAD-((p.v-minV)/range)*ch;
    i===0?mCtx.moveTo(px,py):mCtx.lineTo(px,py);
  });
  mCtx.lineTo(PAD+cw,H-PAD); mCtx.lineTo(PAD,H-PAD); mCtx.closePath();
  mCtx.fillStyle=grad; mCtx.fill();

  // Linha principal
  mCtx.strokeStyle=color; mCtx.lineWidth=2.5;
  mCtx.beginPath();
  history.forEach((p,i)=>{
    const px=PAD+i/(history.length-1)*cw;
    const py=H-PAD-((p.v-minV)/range)*ch;
    i===0?mCtx.moveTo(px,py):mCtx.lineTo(px,py);
  });
  mCtx.stroke();

  // Ponto final
  const lx=PAD+cw, ly=H-PAD-((lastVal-minV)/range)*ch;
  mCtx.fillStyle=color;
  mCtx.beginPath(); mCtx.arc(lx,ly,5,0,Math.PI*2); mCtx.fill();
  mCtx.fillStyle=color; mCtx.font="bold 11px monospace"; mCtx.textAlign="left";
  mCtx.fillText(`$${lastVal.toFixed(2)}`,lx+7,ly+4);
}

// Tabs
document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.onclick=()=>switchTab(btn.dataset.tab);
});
function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  document.querySelectorAll(".tab-pane").forEach(p=>p.classList.toggle("active",p.id===`pane-${name}`));
  if(name==="overview"&&modalAgent) {
    // re-desenha chart com tamanho atualizado
    setTimeout(()=>{
      if(modalChart.offsetWidth>0) {
        fetch(`/api/agents/${modalAgent.id}`).then(r=>r.json()).then(d=>{
          drawModalChart(d.history||[],d.initial_balance||50);
        }).catch(()=>{});
      }
    },50);
  }
}

// Fechar modal
document.getElementById("modal-close").onclick = ()=>modal.classList.remove("open");
modal.addEventListener("click",e=>{ if(e.target===modal) modal.classList.remove("open"); });

// ── WEBSOCKET ─────────────────────────────────────────────
function onData(data) {
  if(!data||!data.length) return;
  data.forEach(agent=>{
    if(agent.trades&&agent.trades[0]) {
      const t=agent.trades[0], key=`${agent.id}-${t.id}`;
      if(!activityLog.has(key)){
        activityLog.add(key);
        addActivity(agent.emoji,agent.name,t.side.toLowerCase(),
          `${t.side} ${t.symbol} @ $${Number(t.price).toFixed(4)}`,Number(t.fee)||0);
      }
    }
    if((agent.generation||1)>1){
      const gk=`evo-${agent.id}`;
      if(!activityLog.has(gk)){
        activityLog.add(gk); elimCount++;
        addActivity(agent.emoji,agent.name,"ev",`🧬 EVOLUÇÃO Gen ${agent.generation}`);
      }
    }
  });
  agentsData=data;
  updateRanking(); updateTopbar(); drawMiniChart();
  // Atualiza modal se aberto
  if(modal.classList.contains("open")&&modalAgent) {
    const updated=data.find(a=>a.id===modalAgent.id);
    if(updated) {
      document.getElementById("ms-v").textContent=`$${(updated.value||0).toFixed(2)}`;
      document.getElementById("ms-f").textContent=`$${(updated.total_fees||0).toFixed(4)}`;
      const pnlPos=(updated.pnl_pct||0)>=0;
      document.getElementById("ms-p").textContent=`${pnlPos?"+":""}${(updated.pnl_pct||0).toFixed(2)}%`;
    }
  }
}

function connect() {
  const proto=location.protocol==="https:"?"wss":"ws";
  const ws=new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen=()=>document.getElementById("status").textContent="🟢 Conectado";
  ws.onmessage=e=>{ try{onData(JSON.parse(e.data));}catch(err){console.error(err);} };
  ws.onclose=()=>{ document.getElementById("status").textContent="🔴 Reconectando..."; setTimeout(connect,3000); };
  ws.onerror=()=>ws.close();
  setInterval(()=>{ if(ws.readyState===WebSocket.OPEN) ws.send("ping"); },15000);
}

// Relógio
setInterval(()=>{ document.getElementById("clock").textContent=new Date().toLocaleTimeString("pt-BR"); },1000);

// Boot
fetch("/api/agents").then(r=>r.json()).then(onData).catch(console.error);
connect();

// Loop de animação
(function loop(){ renderOffice(); requestAnimationFrame(loop); })();

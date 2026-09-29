/* ═══════════════════════════════════════════════════════════
   Trading Office — Google Style Isométrico
   Sala 20x14 · Personagens humanoides · Design moderno
   ═══════════════════════════════════════════════════════════ */

// ── CANVAS / ELEMENTOS ────────────────────────────────────
const wrap       = document.getElementById("office-wrap");
const canvas     = document.getElementById("office-canvas");
const ctx        = canvas.getContext("2d");
const miniCanvas = document.getElementById("mini-chart");
const miniCtx    = miniCanvas.getContext("2d");
miniCanvas.width  = 300;
miniCanvas.height = 100;

function resizeCanvas() {
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ── CÂMERA ────────────────────────────────────────────────
const CAM_HOME = { x: 0, y: -80, zoom: 0.85 };
let cam  = { ...CAM_HOME };
let drag = { down: false, sx: 0, sy: 0, cx: 0, cy: 0 };
let mouse = { cx: -999, cy: -999 };
const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  cam.zoom = Math.max(0.4, Math.min(2.2, cam.zoom - e.deltaY * 0.001));
}, { passive: false });

document.getElementById("btn-zi").onclick = () => cam.zoom = Math.min(2.2, cam.zoom + 0.12);
document.getElementById("btn-zo").onclick = () => cam.zoom = Math.max(0.4, cam.zoom - 0.12);
document.getElementById("btn-zr").onclick = () => { cam.x = CAM_HOME.x; cam.y = CAM_HOME.y; cam.zoom = CAM_HOME.zoom; };

// ── PROJEÇÃO ISO ──────────────────────────────────────────
const TILE_W = 56, TILE_H = 28, WALL_H = 90;

function iso(gx, gy) {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) };
}
function world2screen(wx, wy) {
  return {
    x: canvas.width  / 2 + cam.x + wx * cam.zoom,
    y: canvas.height / 2 + cam.y + wy * cam.zoom
  };
}

// ── PALETA GOOGLE ─────────────────────────────────────────
const C = {
  floor1: "#f8f9fa", floor2: "#e8eaed", floorDark: "#dadce0",
  wall: "#fff", wallShade: "#e8eaed",
  desk: "#fff", deskEdge: "#dadce0",
  glass: "rgba(66,133,244,0.08)",
  plant: "#34a853", plantDark: "#188038", pot: "#dadce0",
  sky: "#4285f4",
  // Cores de roupa dos humanoides (blazers coloridos)
  clothes: [
    "#4285F4","#EA4335","#FBBC05","#34A853",
    "#4285F4","#EA4335","#FBBC05","#34A853",
    "#4285F4","#EA4335","#FBBC05","#34A853",
    "#4285F4","#EA4335",
  ],
  skin: "#ffd1a3",
  hair: ["#1a1a1a","#4a2f1a","#6e3f1e","#8b5a2b","#d4af37"],
};

// ── LAYOUT SALA MAIOR 20x14 ──────────────────────────────
const ROOM_W = 20, ROOM_H = 14;

// 14 mesas em 2 blocos (2 tiles de folga). Evita reunião (gx 2–6, gy 9–12) e lounge (gx 15–18, gy 5–9).
const DESKS = [
  {gx:3, gy:3},  {gx:5, gy:3},  {gx:7, gy:3},
  {gx:3, gy:6},  {gx:5, gy:6},  {gx:7, gy:6},
  {gx:10,gy:3},  {gx:12,gy:3}, {gx:14,gy:3},
  {gx:10,gy:6},  {gx:12,gy:6}, {gx:14,gy:6},
  {gx:10,gy:9},  {gx:12,gy:9},
];

// Elementos decorativos
const PLANTS = [
  {gx:1,gy:1}, {gx:18,gy:1}, {gx:1,gy:12}, {gx:18,gy:12},
  {gx:8,gy:10}, {gx:16,gy:10}
];

const MEETING_TABLE = {gx:3, gy:10, w:4, h:2}; // Mesa oval reunião
const LOUNGE_SOFAS = [{gx:16,gy:6},{gx:17,gy:7}]; // Sofás coloridos
const WHITEBOARD = {gx:10, gy:0.2}; // Quadro branco na parede
const TV_WALL = {gx:6, gy:0.2}; // TV grande dashboard

// ── ESTADO ────────────────────────────────────────────────
let agentsData   = [];
let activityLog  = new Set();
let elimCount    = 0;
let hoveredAgent = null;
let time         = 0;

// ── TILES / PAREDES ───────────────────────────────────────
function drawTile(gx, gy, fill) {
  const {x,y} = iso(gx,gy), s = world2screen(x,y);
  const hw = (TILE_W/2)*cam.zoom, hh = (TILE_H/2)*cam.zoom;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y-hh); ctx.lineTo(s.x+hw, s.y);
  ctx.lineTo(s.x, s.y+hh); ctx.lineTo(s.x-hw, s.y);
  ctx.closePath();
  ctx.fillStyle=fill; ctx.strokeStyle=C.floorDark; ctx.lineWidth=0.5;
  ctx.fill(); ctx.stroke();
}

function drawWallBack(gx, gy) {
  const {x,y}=iso(gx,gy), s=world2screen(x,y);
  const hw=(TILE_W/2)*cam.zoom, hh=(TILE_H/2)*cam.zoom, wh=WALL_H*cam.zoom;
  // Parede branca com sombra
  ctx.fillStyle=C.wall;
  ctx.strokeStyle="#ccc"; ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(s.x-hw,s.y); ctx.lineTo(s.x,s.y-hh);
  ctx.lineTo(s.x,s.y-hh-wh); ctx.lineTo(s.x-hw,s.y-wh);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  
  ctx.fillStyle=C.wallShade;
  ctx.beginPath();
  ctx.moveTo(s.x,s.y-hh); ctx.lineTo(s.x+hw,s.y);
  ctx.lineTo(s.x+hw,s.y-wh); ctx.lineTo(s.x,s.y-hh-wh);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

function drawWallLeft(gx, gy) {
  const {x,y}=iso(gx,gy), s=world2screen(x,y);
  const hw=(TILE_W/2)*cam.zoom, hh=(TILE_H/2)*cam.zoom, wh=WALL_H*cam.zoom;
  ctx.beginPath();
  ctx.moveTo(s.x-hw,s.y); ctx.lineTo(s.x,s.y+hh);
  ctx.lineTo(s.x,s.y+hh-wh); ctx.lineTo(s.x-hw,s.y-wh);
  ctx.closePath();
  ctx.fillStyle=C.wall; ctx.strokeStyle="#ccc"; ctx.lineWidth=1;
  ctx.fill(); ctx.stroke();
}

// Janela grande na parede (skyline fictício)
function drawWindow(gx, gy, w) {
  const {x,y}=iso(gx,gy), s=world2screen(x,y-WALL_H*0.6);
  const z=cam.zoom, ww=w*TILE_W*z, hh=40*z;
  ctx.fillStyle=C.sky;
  ctx.fillRect(s.x-ww/2, s.y-hh, ww, hh);
  ctx.strokeStyle="#4285f480"; ctx.lineWidth=2;
  ctx.strokeRect(s.x-ww/2, s.y-hh, ww, hh);
  // Divisórias da janela
  for(let i=1; i<w; i++) {
    const px = s.x - ww/2 + (ww/w)*i;
    ctx.beginPath(); ctx.moveTo(px, s.y-hh); ctx.lineTo(px, s.y); ctx.stroke();
  }
  // Skyline simples
  ctx.fillStyle="rgba(255,255,255,0.4)";
  const buildings = [0.6,0.8,0.5,0.9,0.6,0.7];
  buildings.forEach((h,i)=>{
    const bx = s.x-ww/2 + (ww/buildings.length)*i;
    const bw = ww/buildings.length - 2*z;
    const bh = hh*h*0.5;
    ctx.fillRect(bx, s.y-bh, bw, bh);
  });
}

// ── MÓVEIS ────────────────────────────────────────────────
function drawDesk(gx, gy, idx) {
  const {x,y}=iso(gx,gy), s=world2screen(x,y);
  const z=cam.zoom, hw=(TILE_W/2-6)*z, hh=(TILE_H/2-3)*z, dh=18*z;
  // topo branco
  ctx.beginPath();
  ctx.moveTo(s.x,s.y-dh-hh); ctx.lineTo(s.x+hw,s.y-dh);
  ctx.lineTo(s.x,s.y-dh+hh); ctx.lineTo(s.x-hw,s.y-dh);
  ctx.closePath();
  ctx.fillStyle=C.desk; ctx.strokeStyle=C.deskEdge; ctx.lineWidth=1;
  ctx.fill(); ctx.stroke();
  // lado esq
  ctx.beginPath();
  ctx.moveTo(s.x-hw,s.y-dh); ctx.lineTo(s.x,s.y-dh+hh);
  ctx.lineTo(s.x,s.y+hh); ctx.lineTo(s.x-hw,s.y);
  ctx.closePath();
  ctx.fillStyle=C.wallShade; ctx.fill(); ctx.stroke();
  // lado dir
  ctx.beginPath();
  ctx.moveTo(s.x,s.y-dh+hh); ctx.lineTo(s.x+hw,s.y-dh);
  ctx.lineTo(s.x+hw,s.y); ctx.lineTo(s.x,s.y+hh);
  ctx.closePath();
  ctx.fillStyle=C.floorDark; ctx.fill(); ctx.stroke();
  
  // Monitor moderno
  drawMonitor(s.x-4*z, s.y-dh-12*z, z, idx);
  
  // Teclado
  ctx.fillStyle="#e8eaed";
  ctx.fillRect(s.x+4*z, s.y-dh-2*z, 12*z, 4*z);
}

function drawMonitor(sx, sy, z, idx) {
  const w=24*z, h=18*z;
  // Moldura preta
  ctx.fillStyle="#202124";
  ctx.fillRect(sx-w/2, sy-h, w, h);
  
  const agent = agentsData[idx];
  if (agent) {
    const bg = agent.pnl_pct >= 0 ? "#0d3d2d" : "#3d0d1d";
    ctx.fillStyle = bg;
    ctx.fillRect(sx-w/2+1.5*z, sy-h+1.5*z, w-3*z, h-3*z);
    
    // Sparkline
    const hist = agent.history || [];
    if (hist.length > 1) {
      const tw=w-5*z, th=h-5*z;
      const ox=sx-w/2+2.5*z, oy=sy-2.5*z;
      const vals = hist.slice(-20).map(p=>p.v);
      const minV=Math.min(...vals), maxV=Math.max(...vals);
      const range=maxV-minV||1;
      ctx.strokeStyle = agent.pnl_pct>=0?"#34a853":"#ea4335";
      ctx.lineWidth=1.2;
      ctx.beginPath();
      vals.forEach((v,i)=>{
        const px=ox+(i/Math.max(vals.length-1,1))*tw;
        const py=oy-((v-minV)/range)*th;
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      });
      ctx.stroke();
      
      // RSI bar no fundo
      if (agent.last_decision) {
        const rsi = agent.last_decision.rsi||50;
        const rsiW = ((w-3*z)*(rsi/100));
        ctx.fillStyle = rsi<35?"#34a853":rsi>65?"#ea4335":"#fbbc05";
        ctx.globalAlpha=0.35;
        ctx.fillRect(sx-w/2+1.5*z, sy-3*z, rsiW, 1.5*z);
        ctx.globalAlpha=1;
      }
    } else {
      ctx.fillStyle="#34a85360";
      ctx.font=`${5*z}px sans-serif`;
      ctx.textAlign="center";
      ctx.fillText("...", sx, sy-h/2+2*z);
      ctx.textAlign="left";
    }
    
    // LED piscando
    const blink = REDUCE_MOTION ? 1 : (Math.sin(time*4+idx)>0?1:0.3);
    ctx.globalAlpha=blink;
    ctx.fillStyle=agent.pnl_pct>=0?"#34a853":"#ea4335";
    ctx.beginPath();
    ctx.arc(sx+w/2-3*z, sy-h+3*z, 2*z, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=1;
  } else {
    ctx.fillStyle="#000";
    ctx.fillRect(sx-w/2+1.5*z, sy-h+1.5*z, w-3*z, h-3*z);
  }
  // Pé
  ctx.fillStyle="#333";
  ctx.fillRect(sx-1.5*z, sy, 3*z, 5*z);
}

function drawChair(gx, gy, color) {
  const {x,y}=iso(gx-0.4,gy+0.6), s=world2screen(x,y), z=cam.zoom;
  // Assento colorido estilo ergonômico
  ctx.fillStyle=color; ctx.strokeStyle="#333"; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.arc(s.x,s.y,9*z,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // Encosto
  ctx.fillRect(s.x-5*z, s.y-20*z, 10*z, 12*z);
  ctx.strokeRect(s.x-5*z, s.y-20*z, 10*z, 12*z);
}

function drawPlant(gx, gy) {
  const {x,y}=iso(gx,gy), s=world2screen(x,y), z=cam.zoom;
  // Vaso branco moderno
  ctx.fillStyle="#fff";
  ctx.strokeStyle="#dadce0"; ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(s.x-7*z,s.y); ctx.lineTo(s.x+7*z,s.y);
  ctx.lineTo(s.x+5*z,s.y+11*z); ctx.lineTo(s.x-5*z,s.y+11*z);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  
  // Folhas tropicais grandes
  [[0,-1.2],[-.7,-.6],[.7,-.6],[-.5,-.2],[.5,-.2]].forEach(([dx,dy])=>{
    ctx.fillStyle=dx===0?C.plant:C.plantDark;
    ctx.beginPath();
    ctx.ellipse(s.x+dx*12*z,s.y+dy*16*z,9*z,13*z,dx*0.6,0,Math.PI*2);
    ctx.fill();
  });
}

// Mesa de reunião oval
function drawMeetingTable() {
  const {gx,gy,w,h} = MEETING_TABLE;
  const {x,y} = iso(gx+w/2, gy+h/2), s = world2screen(x,y);
  const z = cam.zoom, rw=(w*TILE_W/2)*z, rh=(h*TILE_H/2)*z;
  
  ctx.fillStyle="#fff";
  ctx.strokeStyle=C.deskEdge; ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y-10*z, rw, rh, 0, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  
  // Cadeiras ao redor
  const chairs = 6;
  for(let i=0; i<chairs; i++) {
    const angle = (i/chairs)*Math.PI*2;
    const cx = s.x + Math.cos(angle)*(rw+8*z);
    const cy = s.y-10*z + Math.sin(angle)*(rh+6*z);
    ctx.fillStyle=C.clothes[i%C.clothes.length];
    ctx.beginPath(); ctx.arc(cx,cy,7*z,0,Math.PI*2); ctx.fill();
  }
}

// Sofás lounge coloridos
function drawSofa(gx, gy, color) {
  const {x,y}=iso(gx,gy), s=world2screen(x,y), z=cam.zoom;
  ctx.fillStyle=color;
  ctx.fillRect(s.x-16*z, s.y-8*z, 32*z, 16*z);
  ctx.fillRect(s.x-16*z, s.y-18*z, 32*z, 10*z); // Encosto
  ctx.strokeStyle="#333"; ctx.lineWidth=1;
  ctx.strokeRect(s.x-16*z, s.y-8*z, 32*z, 16*z);
  ctx.strokeRect(s.x-16*z, s.y-18*z, 32*z, 10*z);
}

// Whiteboard na parede
function drawWhiteboard() {
  const {gx,gy} = WHITEBOARD;
  const {x,y}=iso(gx,gy), s=world2screen(x,y-WALL_H*0.5);
  const z=cam.zoom, w=70*z, h=40*z;
  
  ctx.fillStyle="#fff";
  ctx.strokeStyle="#4285f4"; ctx.lineWidth=2;
  ctx.fillRect(s.x-w/2, s.y-h, w, h);
  ctx.strokeRect(s.x-w/2, s.y-h, w, h);
  
  // Gráfico desenhado (placeholder)
  ctx.strokeStyle="#ea4335"; ctx.lineWidth=1.5;
  ctx.beginPath();
  const pts = [0.3,0.5,0.4,0.7,0.6,0.8];
  pts.forEach((py,i)=>{
    const px = s.x-w/2+10*z + (w-20*z)*(i/(pts.length-1));
    const wy = s.y-h+10*z + (h-20*z)*py;
    i===0?ctx.moveTo(px,wy):ctx.lineTo(px,wy);
  });
  ctx.stroke();
  
  ctx.fillStyle="#4285f4"; ctx.font=`bold ${6*z}px sans-serif`;
  ctx.textAlign="center";
  ctx.fillText("Performance", s.x, s.y-h+8*z);
  ctx.textAlign="left";
}

// TV Dashboard na parede
function drawTVDashboard() {
  const {gx,gy} = TV_WALL;
  const {x,y}=iso(gx,gy), s=world2screen(x,y-WALL_H*0.6);
  const z=cam.zoom, w=90*z, h=50*z;
  
  ctx.fillStyle="#000";
  ctx.strokeStyle="#4285f4"; ctx.lineWidth=2.5;
  ctx.fillRect(s.x-w/2,s.y-h,w,h);
  ctx.strokeRect(s.x-w/2,s.y-h,w,h);
  
  ctx.fillStyle="#001a00";
  ctx.fillRect(s.x-w/2+3*z,s.y-h+3*z,w-6*z,h-6*z);
  
  ctx.fillStyle="#34a853"; ctx.font=`bold ${7*z}px sans-serif`;
  ctx.textAlign="center";
  ctx.fillText("📊 TRADING OFFICE", s.x, s.y-h+12*z);
  
  const best=agentsData[0];
  if (best) {
    const col=best.pnl_pct>=0?"#34a853":"#ea4335";
    ctx.fillStyle=col; ctx.font=`${6*z}px sans-serif`;
    ctx.fillText(`👑 ${best.emoji} ${best.name}`, s.x, s.y-h+24*z);
    ctx.fillText(`$${best.value.toFixed(2)}  ${best.pnl_pct>=0?"+":""}${best.pnl_pct.toFixed(1)}%`, s.x, s.y-h+35*z);
    ctx.font=`${5*z}px sans-serif`;
    ctx.fillStyle="#888";
    ctx.fillText(`fee $${(best.total_fees||0).toFixed(3)} · ${best.total_trades||0} trades`, s.x, s.y-h+44*z);
  }
  ctx.textAlign="left";
}

// ── PERSONAGEM HUMANOIDE ──────────────────────────────────
function drawHumanoid(gx, gy, agent, idx) {
  const bobY = REDUCE_MOTION ? 0 : Math.sin(time*1.8+idx*1.3)*1.5;
  const {x,y}=iso(gx,gy), s=world2screen(x,y+bobY);
  const z=cam.zoom;
  const clothColor = C.clothes[idx%C.clothes.length];
  const skinColor = C.skin;
  const hairColor = C.hair[idx%C.hair.length];
  
  // Sombra
  ctx.fillStyle="rgba(0,0,0,0.15)";
  ctx.beginPath(); ctx.ellipse(s.x,s.y+3*z,10*z,4*z,0,0,Math.PI*2); ctx.fill();
  
  // Estado de animação
  let armAngle = REDUCE_MOTION ? 0 : Math.sin(time*2+idx)*0.2;
  let headTilt = 0;
  let expression = "neutral"; // neutral, happy, worried
  
  if (agent.last_decision) {
    const dec = agent.last_decision;
    if (dec.side === "BUY") {
      armAngle = -0.6; // Polegar pra cima
      expression = "happy";
    } else if (dec.side === "SELL") {
      headTilt = 0.15;
      expression = "worried";
    }
  }
  
  if (agent.pnl_pct > 5) {
    // Comemorando: em pé, braços levantados
    armAngle = -0.8;
    expression = "happy";
  } else if (agent.pnl_pct < -5) {
    // Desanimado: curvado, cabeça baixa
    headTilt = 0.3;
    expression = "worried";
  }
  
  // ── PERNAS ──
  ctx.fillStyle="#2c2c2c";
  ctx.fillRect(s.x-7*z, s.y+1*z, 5*z, 9*z); // esq
  ctx.fillRect(s.x+2*z, s.y+1*z, 5*z, 9*z); // dir
  
  // ── CORPO (blazer colorido) ──
  const grad = ctx.createLinearGradient(s.x-10*z,s.y-18*z,s.x+10*z,s.y+1*z);
  grad.addColorStop(0, clothColor);
  grad.addColorStop(1, shadeColor(clothColor,-30));
  ctx.fillStyle=grad;
  ctx.strokeStyle="#000"; ctx.lineWidth=1;
  ctx.beginPath();
  ctx.roundRect(s.x-10*z, s.y-18*z, 20*z, 20*z, 3*z);
  ctx.fill(); ctx.stroke();
  
  // Crachá na lapela
  ctx.fillStyle="#fff";
  ctx.fillRect(s.x+6*z, s.y-14*z, 3*z, 4*z);
  ctx.fillStyle=clothColor; ctx.font=`${3*z}px sans-serif`; ctx.textAlign="center";
  ctx.fillText(agent.emoji, s.x+7.5*z, s.y-10.5*z);
  ctx.textAlign="left";
  
  // ── BRAÇOS ──
  const armL = REDUCE_MOTION ? 0 : Math.sin(time*2+idx)*6*z;
  const armR = REDUCE_MOTION ? 0 : Math.cos(time*2+idx)*6*z;
  
  // Braço esquerdo
  ctx.strokeStyle=clothColor; ctx.lineWidth=5*z; ctx.lineCap="round";
  ctx.beginPath();
  ctx.moveTo(s.x-10*z, s.y-14*z);
  ctx.lineTo(s.x-16*z, s.y-8*z+armL+armAngle*10*z);
  ctx.stroke();
  // Mão
  ctx.fillStyle=skinColor;
  ctx.beginPath(); ctx.arc(s.x-16*z, s.y-8*z+armL+armAngle*10*z, 3*z, 0, Math.PI*2); ctx.fill();
  
  // Braço direito
  ctx.strokeStyle=clothColor;
  ctx.beginPath();
  ctx.moveTo(s.x+10*z, s.y-14*z);
  ctx.lineTo(s.x+16*z, s.y-8*z+armR-armAngle*10*z);
  ctx.stroke();
  // Mão
  ctx.fillStyle=skinColor;
  ctx.beginPath(); ctx.arc(s.x+16*z, s.y-8*z+armR-armAngle*10*z, 3*z, 0, Math.PI*2); ctx.fill();
  
  // ── PESCOÇO ──
  ctx.fillStyle=skinColor;
  ctx.fillRect(s.x-3*z, s.y-20*z, 6*z, 4*z);
  
  // ── CABEÇA ──
  ctx.save();
  ctx.translate(s.x, s.y-26*z);
  ctx.rotate(headTilt);
  
  // Rosto oval
  const headGrad = ctx.createRadialGradient(0,-2*z,0, 0,-2*z,10*z);
  headGrad.addColorStop(0, skinColor);
  headGrad.addColorStop(1, shadeColor(skinColor,-15));
  ctx.fillStyle=headGrad;
  ctx.strokeStyle="#000"; ctx.lineWidth=1;
  ctx.beginPath();
  ctx.ellipse(0, -2*z, 8*z, 10*z, 0, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  
  // Cabelo estilizado
  ctx.fillStyle=hairColor;
  ctx.beginPath();
  ctx.ellipse(0, -8*z, 8*z, 6*z, 0, 0, Math.PI, true);
  ctx.fill();
  
  // ── ROSTO ──
  // Olhos
  const eyeY = expression==="worried" ? 0*z : -1*z;
  ctx.fillStyle="#fff";
  ctx.beginPath(); ctx.arc(-3*z, eyeY, 2.5*z, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(3*z, eyeY, 2.5*z, 0, Math.PI*2); ctx.fill();
  
  // Pupilas
  const pupilCol = agent.pnl_pct>=0 ? "#34a853" : "#ea4335";
  ctx.fillStyle=pupilCol;
  ctx.beginPath(); ctx.arc(-3*z, eyeY, 1.2*z, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(3*z, eyeY, 1.2*z, 0, Math.PI*2); ctx.fill();
  
  // Boca
  ctx.strokeStyle="#000"; ctx.lineWidth=0.8; ctx.lineCap="round";
  ctx.beginPath();
  if (expression === "happy") {
    // Sorriso
    ctx.arc(0, 3*z, 4*z, 0.2, Math.PI-0.2);
  } else if (expression === "worried") {
    // Triste
    ctx.arc(0, 7*z, 4*z, Math.PI+0.2, -0.2, true);
  } else {
    // Neutro
    ctx.moveTo(-3*z, 4*z); ctx.lineTo(3*z, 4*z);
  }
  ctx.stroke();
  
  ctx.restore();
  
  // Badge geração
  const gen=agent.generation||1;
  if (gen>1) {
    ctx.fillStyle=gen===2?"#a855f7":gen===3?"#fbbc05":"#10b981";
    ctx.beginPath(); ctx.arc(s.x+10*z,s.y-30*z,6*z,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff"; ctx.font=`bold ${5*z}px sans-serif`; ctx.textAlign="center";
    ctx.fillText("G"+gen,s.x+10*z,s.y-27*z);
    ctx.textAlign="left";
  }
  
  // ── TEXTO DE DECISÃO ACIMA ────────────────────────────
  drawDecisionBubble(s, z, agent, idx);
  
  // ── TOOLTIP ao hover ──────────────────────────────────
  if (isHovered(s,16*z,48*z)) {
    hoveredAgent=agent;
    showTooltip(agent);
  }
}

// ── BALÃO DE DECISÃO COM SPARKLINE ───────────────────────
function drawDecisionBubble(s, z, agent, idx) {
  if (z < 0.6) return;
  
  const dec = agent.last_decision;
  const lastTrade = agent.trades && agent.trades[0];
  
  let reasonText = null;
  if (dec && dec.reason) {
    reasonText = `${dec.side==="BUY"?"▲":"▼"} ${dec.symbol||""}: ${dec.reason}`;
  } else if (lastTrade) {
    reasonText = `${lastTrade.side} ${lastTrade.symbol} @ $${Number(lastTrade.price).toFixed(2)}`;
  }
  
  // Indicadores em pills coloridos
  let indPills = [];
  if (dec) {
    const rsi = (dec.indicators?.rsi || 0)||0;
    const rsiCol = rsi<35?"#34a853":rsi>65?"#ea4335":"#fbbc05";
    indPills.push({text:`RSI ${rsi.toFixed(0)}`, col:rsiCol});
    
    if ((dec.indicators?.momentum || 0)) {
      const mCol = (dec.indicators?.momentum || 0)>=0?"#34a853":"#ea4335";
      indPills.push({text:`M${(dec.indicators?.momentum || 0)>=0?"+":""}${(dec.indicators?.momentum || 0).toFixed(1)}%`, col:mCol});
    }
    if ((dec.indicators?.zscore || 0)) {
      indPills.push({text:`Z${(dec.indicators?.zscore || 0).toFixed(1)}σ`, col:"#4285f4"});
    }
  }
  
  // Knowledge share
  let shareText = null;
  if (dec && (dec.shared_buy>0||dec.shared_sell>0)) {
    shareText = `🔗 ${dec.shared_buy} buy · ${dec.shared_sell} sell`;
  }
  
  if (!reasonText && indPills.length===0) return;
  
  const lineH = 9*z;
  const lines = [reasonText, ...indPills.map(p=>p.text), shareText].filter(Boolean);
  const totalH = lines.length * lineH + 10*z;
  
  ctx.font = `${6*z}px sans-serif`;
  const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
  const boxW = maxW + 16*z;
  
  const bx = s.x - boxW/2;
  const by = s.y - 50*z - totalH;
  
  // Fundo glassmorphism
  const borderCol = dec && dec.side==="BUY" ? "#34a853" : dec && dec.side==="SELL" ? "#ea4335" : "#4285f4";
  ctx.fillStyle = "rgba(17,24,39,0.92)";
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, totalH, 8*z);
  ctx.fill();
  ctx.stroke();
  
  // Seta apontando
  ctx.fillStyle = borderCol;
  ctx.beginPath();
  ctx.moveTo(s.x-4*z, by+totalH); ctx.lineTo(s.x+4*z, by+totalH); ctx.lineTo(s.x, by+totalH+6*z);
  ctx.closePath(); ctx.fill();
  
  // Textos
  ctx.font = `bold ${6.5*z}px sans-serif`;
  ctx.textAlign = "center";
  let yOff = by + lineH;
  
  // Linha 1: razão principal
  if (reasonText) {
    ctx.fillStyle = borderCol;
    ctx.fillText(reasonText, s.x, yOff);
    yOff += lineH;
  }
  
  // Indicators como pills
  indPills.forEach(pill => {
    ctx.fillStyle = pill.col;
    ctx.font = `${5.5*z}px sans-serif`;
    ctx.fillText(pill.text, s.x, yOff);
    yOff += lineH*0.8;
  });
  
  // Knowledge share
  if (shareText) {
    ctx.fillStyle = "#a855f7";
    ctx.font = `${5*z}px sans-serif`;
    ctx.fillText(shareText, s.x, yOff);
  }
  
  ctx.textAlign = "left";
  
  // Mini sparkline no fundo do balão
  if (dec && agent.history && agent.history.length > 3) {
    const chartY = by + totalH - 2*z;
    const chartH = 10*z;
    const chartW = boxW - 8*z;
    const chartX = bx + 4*z;
    
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(chartX, chartY-chartH, chartW, chartH);
    
    const vals = agent.history.slice(-15).map(h=>h.v);
    const mn=Math.min(...vals), mx=Math.max(...vals), rng=mx-mn||0.01;
    ctx.strokeStyle = borderCol; ctx.lineWidth=1.2;
    ctx.beginPath();
    vals.forEach((v,i)=>{
      const px=chartX+i/(vals.length-1)*chartW;
      const py=chartY-((v-mn)/rng)*chartH;
      i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    });
    ctx.stroke();
  }
}

function strategyLabel(agent) {
  return (agent && agent.strategy) ? String(agent.strategy) : "—";
}
function lastReason(agent) {
  const d = agent && agent.last_decision;
  if (!d) return "";
  const side = d.side || "";
  const sym = d.symbol || "";
  const reason = d.reason || "";
  return [side, sym, reason].filter(Boolean).join(" · ");
}
function honestRules(raw, fallback) {
  const t = (raw || "").trim();
  if (!t) return fallback;
  return t
    .replace(/\bTécnica de ML\b/gi, "Regras")
    .replace(/\bmachine learning\b/gi, "indicadores")
    .replace(/\bML\b/g, "regras")
    /* removed naive replace */
}
const tooltip = document.getElementById("tooltip");
function showTooltip(agent) {
  const pnlC = agent.pnl_pct>=0?"up":"dn";
  document.getElementById("tt-name").textContent  = `${agent.emoji||""} ${agent.name||""}`;
  document.getElementById("tt-class").textContent = agent.class || "";
  document.getElementById("tt-strat").textContent = `Estratégia: ${strategyLabel(agent)}`;
  const reason = lastReason(agent);
  const ttReason = document.getElementById("tt-reason");
  ttReason.textContent = reason ? `Decisão: ${reason}` : "";
  ttReason.style.display = reason ? "" : "none";
  document.getElementById("tt-fees").textContent  = `Fees: $${(agent.total_fees||0).toFixed(4)}`;
  document.getElementById("tt-sym").textContent   = (agent.symbols||[]).join(", ");
  document.getElementById("tt-bal").textContent   = `Cash: $${Number(agent.balance||0).toFixed(2)}  Patrimônio: $${Number(agent.value||0).toFixed(2)}`;
  const elPnl = document.getElementById("tt-pnl");
  elPnl.textContent = `${agent.pnl_pct>=0?"▲":"▼"} ${agent.pnl_pct>=0?"+":""}${Number(agent.pnl_pct||0).toFixed(2)}% sobre $${agent.initial_balance||50}`;
  elPnl.className = "tt-pnl " + pnlC;
  tooltip.classList.add("show");
  const tw = tooltip.offsetWidth || 240, th = tooltip.offsetHeight || 120;
  let left = mouse.cx + 14, top = mouse.cy - 10;
  if (left + tw > wrap.clientWidth - 8) left = mouse.cx - tw - 12;
  if (left < 8) left = 8;
  if (top + th > wrap.clientHeight - 8) top = wrap.clientHeight - th - 8;
  if (top < 8) top = 8;
  tooltip.style.left = left + "px";
  tooltip.style.top  = top + "px";
}
canvas.addEventListener("mouseleave", () => {
  hoveredAgent = null;
  tooltip.classList.remove("show");
});

// ── HIT TEST ──────────────────────────────────────────────
function isHovered(s, hw, hh) {
  return mouse.cx>s.x-hw && mouse.cx<s.x+hw && mouse.cy>s.y-hh && mouse.cy<s.y;
}

// ── COR HELPER ────────────────────────────────────────────
function shadeColor(hex, p) {
  const n=parseInt(hex.slice(1),16);
  const r=Math.max(0,Math.min(255,(n>>16)+p));
  const g=Math.max(0,Math.min(255,((n>>8)&0xff)+p));
  const b=Math.max(0,Math.min(255,(n&0xff)+p));
  return `rgb(${r},${g},${b})`;
}

// ── CLIQUE NO CANVAS (abrir modal) ────────────────────────
function deskScreen(desk) {
  const { x, y } = iso(desk.gx - 0.5, desk.gy - 0.5);
  return world2screen(x, y);
}
function hitDesk(cx, cy, desk) {
  const s = deskScreen(desk);
  const zz = cam.zoom;
  return cx > s.x - 18*zz && cx < s.x + 18*zz && cy > s.y - 52*zz && cy < s.y + 8*zz;
}

// ── CLIQUE NO CANVAS (abrir modal) ────────────────────────
canvas.addEventListener("click", e => {
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) return;
  const r = canvas.getBoundingClientRect();
  const cx = e.clientX - r.left, cy = e.clientY - r.top;
  for (let i = 0; i < DESKS.length; i++) {
    if (!agentsData[i]) continue;
    if (hitDesk(cx, cy, DESKS[i])) { openModal(agentsData[i]); break; }
  }
});

// ── MINI CHART LATERAL ────────────────────────────────────
function drawMiniChart() {
  const W=miniCanvas.width, H=miniCanvas.height;
  miniCtx.clearRect(0,0,W,H);
  miniCtx.fillStyle="rgba(0,0,0,0.5)"; miniCtx.fillRect(0,0,W,H);
  
  const allVals=agentsData.flatMap(a=>(a.history||[]).map(h=>h.v));
  if (allVals.length<2) return;
  const minV=Math.min(...allVals,45), maxV=Math.max(...allVals,55);
  const range=maxV-minV||1, PAD=18, cw=W-PAD*2, ch=H-PAD*2;
  
  // Linha de aporte $50
  const baseY=H-PAD-((50-minV)/range)*ch;
  miniCtx.strokeStyle="#4285f440"; miniCtx.setLineDash([4,3]); miniCtx.lineWidth=1;
  miniCtx.beginPath(); miniCtx.moveTo(PAD,baseY); miniCtx.lineTo(W-PAD,baseY); miniCtx.stroke();
  miniCtx.setLineDash([]);
  miniCtx.fillStyle="#4285f4"; miniCtx.font="8px sans-serif";
  miniCtx.fillText("$50",2,baseY-2);
  
  // Top 3
  agentsData.slice(0,3).forEach((agent,idx)=>{
    const pts=agent.history||[];
    if(pts.length<2) return;
    const xStep=cw/Math.max(pts.length-1,1);
    const color=C.clothes[idx%C.clothes.length];
    miniCtx.strokeStyle=color; miniCtx.lineWidth=2.5; miniCtx.globalAlpha=0.9;
    miniCtx.beginPath();
    pts.forEach((p,i)=>{
      const px=PAD+i*xStep, py=H-PAD-((p.v-minV)/range)*ch;
      i===0?miniCtx.moveTo(px,py):miniCtx.lineTo(px,py);
    });
    miniCtx.stroke();
    
    if(pts.length>0){
      const last=pts[pts.length-1];
      const lx=PAD+(pts.length-1)*xStep, ly=H-PAD-((last.v-minV)/range)*ch;
      miniCtx.fillStyle=color; miniCtx.font="9px sans-serif";
      miniCtx.fillText(agent.emoji,lx+3,ly+4);
    }
  });
  miniCtx.globalAlpha=1;
}

// ── RANKING ───────────────────────────────────────────────
function el(tag, cls, text) {
  const n=document.createElement(tag);
  if (cls) n.className=cls;
  if (text != null) n.textContent=text;
  return n;
}
function updateRanking() {
  const list=document.getElementById("ranking-list");
  const empty=document.getElementById("ranking-empty");
  list.replaceChildren();
  const emptyOn = !agentsData.length;
  if (empty) empty.classList.toggle("hidden", !emptyOn);
  if (emptyOn) return;
  agentsData.forEach((a,i)=>{
    const pnlC=a.pnl_pct>0?"up":a.pnl_pct<0?"dn":"nt";
    const barPct = Math.min(100, Math.max(0, ((a.value-50)/50)*100));
    const barCol = a.pnl_pct>=0 ? "#34a853" : "#ea4335";
    const reason = lastReason(a);

    let clsLeader = "";
    if(i===0) clsLeader=" leader";
    if(i===1) clsLeader=" silver";
    if(i===2) clsLeader=" bronze";
    const div=el("div", "rank-row"+clsLeader);
    div.appendChild(el("div","rank-pos", i+1));
    div.appendChild(el("div","rr-avatar", a.emoji||""));
    const info=el("div","rr-info");
    
    // Nome e estratégia na mesma linha
    const topWrap = el("div", "rr-top");
    topWrap.appendChild(el("div","rr-name", a.name||""));
    topWrap.appendChild(el("div","rr-strat-badge", strategyLabel(a)));
    info.appendChild(topWrap);
    
    info.appendChild(el("div","rr-meta", `Gen ${a.generation||1} · ${a.win_rate||0}% win · ${a.total_trades||0} trades`));
    if (reason) info.appendChild(el("div","rr-meta", reason));
    const barWrap=el("div","rr-bar-wrap");
    const bar=el("div","rr-bar");
    bar.style.width=barPct+"%";
    bar.style.background=barCol;
    barWrap.appendChild(bar);
    info.appendChild(barWrap);
    div.appendChild(info);
    const right=el("div","rr-right");
    right.appendChild(el("div","rr-val", "$"+Number(a.value||0).toFixed(2)));
    right.appendChild(el("div","rr-pnl "+pnlC, `${a.pnl_pct>=0?"+":""}${Number(a.pnl_pct||0).toFixed(1)}%`));
    div.appendChild(right);
    div.onclick=()=>openModal(a);
    list.appendChild(div);
  });
}

// ── GLOBAL STATS ──────────────────────────────────────────
function updateGlobalStats() {
  const totalTrades = agentsData.reduce((s,a)=>(a.total_trades||0)+s, 0);
  const totalFees = agentsData.reduce((s,a)=>(a.total_fees||0)+s, 0);
  const poolSize = agentsData.filter(a=>a.last_decision).length;
  
  document.getElementById("gs-trades").textContent = totalTrades;
  document.getElementById("gs-fees").textContent = "$"+totalFees.toFixed(2);
  document.getElementById("gs-pool").textContent = poolSize;
}

// ── FEED DE ATIVIDADE ─────────────────────────────────────
function setFeedEmpty() {
  const feed=document.getElementById("activity-feed");
  const empty=document.getElementById("feed-empty");
  if (empty) empty.classList.toggle("hidden", feed.children.length>0);
}
function addActivity(emoji, name, type, text, fee, extra) {
  const feed=document.getElementById("activity-feed");
  const div=el("div", `act-item ${type}`);
  const now=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  let pillClass = type;
  let pillText = type.toUpperCase();
  if (type==="ev") { pillClass="ev"; pillText="EVOLUÇÃO"; }

  const header=el("div","act-header");
  header.appendChild(el("span","act-agent", `${emoji||""} ${name||""}`));
  header.appendChild(el("span",`act-pill ${pillClass}`, pillText));
  div.appendChild(header);
  const detail=el("div","act-detail", text||"");
  if (fee>0) detail.appendChild(el("span","act-fee", ` fee $${Number(fee).toFixed(4)}`));
  div.appendChild(detail);
  if (extra && extra.strategy) {
    div.appendChild(el("div","act-strat", extra.strategy));
  }
  if (extra && extra.reason) {
    div.appendChild(el("span","act-reason", extra.reason));
  }
  div.appendChild(el("span","act-time", now));
  feed.insertBefore(div,feed.firstChild);
  while(feed.children.length>40) feed.removeChild(feed.lastChild);
  setFeedEmpty();
}

// ── TOPBAR ─────────────────────────────────────────────────
function updateTopbar() {
  document.getElementById("count-active").textContent=agentsData.filter(a=>a.status==="active").length;
  document.getElementById("count-gen").textContent=Math.max(...agentsData.map(a=>a.generation||1),1);
  document.getElementById("count-elim").textContent=elimCount;
}

// ── RENDER PRINCIPAL ──────────────────────────────────────
function renderOffice() {
  hoveredAgent = null;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  
  // Fundo gradiente
  const grad = ctx.createRadialGradient(canvas.width*0.4, canvas.height*0.2, 0, canvas.width*0.5, canvas.height*0.5, canvas.height);
  grad.addColorStop(0, "#1a237e");
  grad.addColorStop(1, "#0a0e1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  
  // Paredes de fundo
  for(let gx=0;gx<ROOM_W;gx++) drawWallBack(gx,0);
  for(let gy=0;gy<ROOM_H;gy++) drawWallLeft(0,gy);
  
  // Janelas
  drawWindow(4, 0, 4);
  drawWindow(12, 0, 3);
  
  // Piso (hexagonal colorido por zona)
  for(let gy=0;gy<ROOM_H;gy++) {
    for(let gx=0;gx<ROOM_W;gx++) {
      let fill = (gx+gy)%2===0 ? C.floor1 : C.floor2;
      // Zona de reunião com carpete azulado
      if (gx>=2 && gx<=6 && gy>=9 && gy<=12) {
        fill = "#e3f2fd";
      }
      // Zona lounge com carpete verde
      if (gx>=15 && gx<=18 && gy>=5 && gy<=9) {
        fill = "#e8f5e9";
      }
      drawTile(gx,gy,fill);
    }
  }
  
  // Decoração
  drawTVDashboard();
  drawWhiteboard();
  PLANTS.forEach(p=>drawPlant(p.gx,p.gy));
  drawMeetingTable();
  LOUNGE_SOFAS.forEach((sf,i)=>drawSofa(sf.gx,sf.gy,C.clothes[(i+5)%C.clothes.length]));
  
  // Ordenar objetos por profundidade ISO
  const sorted=[...DESKS].map((d,i)=>({...d,i})).sort((a,b)=>(a.gx+a.gy)-(b.gx+b.gy));
  
  sorted.forEach(({gx,gy,i})=>{
    const chairColor = C.clothes[i%C.clothes.length];
    drawChair(gx,gy,chairColor);
    drawDesk(gx,gy,i);
    if(agentsData[i]) drawHumanoid(gx-0.5,gy-0.5,agentsData[i],i);
  });
  
  time+=0.016;
  if (!hoveredAgent) tooltip.classList.remove("show");
}

// ── MODAL ─────────────────────────────────────────────────
const modal      = document.getElementById("agent-modal");
const modalChart = document.getElementById("modal-chart");
const mCtx       = modalChart.getContext("2d");
let   modalAgent = null;

function openModal(agent) {
  modalAgent = agent;
  modal.classList.add("open");
  fetch(`/api/agents/${agent.id}`)
    .then(r=>r.json())
    .then(d=>fillModal(d))
    .catch(()=>fillModal(agent));
}

function fillModal(a) {
  document.getElementById("modal-avatar").textContent = a.emoji;
  document.getElementById("modal-name").textContent  = `${a.name}`;
  
  const gen = a.generation||1;
  const genClass = gen===1?"g1":gen===2?"g2":gen===3?"g3":"g4";
  const klassEl = document.getElementById("modal-class");
  klassEl.replaceChildren();
  klassEl.appendChild(document.createTextNode((a.class||"")+" "));
  const badge=el("span","gen-badge "+genClass, "Gen "+gen);
  klassEl.appendChild(badge);
  klassEl.appendChild(document.createTextNode(" · "+(a.symbols||[]).join(", ")));
  
  const pnlPos = (a.pnl_pct||0)>=0;
  document.getElementById("ms-v").textContent = `$${(a.value||0).toFixed(2)}`;
  document.getElementById("ms-p").textContent = `${pnlPos?"+":""}${(a.pnl_pct||0).toFixed(2)}%`;
  document.getElementById("ms-p").closest(".mstat").className = "mstat "+(pnlPos?"up":"dn");
  document.getElementById("ms-w").textContent = `${a.win_rate||0}%`;
  document.getElementById("ms-f").textContent = `$${(a.total_fees||0).toFixed(4)}`;
  document.getElementById("ms-t").textContent = a.total_trades||0;
  document.getElementById("ms-g").textContent = `Gen ${gen}`;
  
  document.getElementById("s-strategy").textContent = strategyLabel(a);
  document.getElementById("s-desc").textContent  = a.strategy_desc  || "Regras técnicas (sem LLM).";
  document.getElementById("s-ml").textContent    = honestRules(a.ml_tech, "Indicadores e limiares em engine/strategy.py — não há modelo de ML no ciclo de trade.");
  document.getElementById("s-model").textContent = honestRules(a.ml_model, "Motor baseado em regras. Sem LLM no ciclo de trade.");
  const lastEl = document.getElementById("s-last");
  lastEl.textContent = lastReason(a) || "Ainda sem decisão neste ciclo.";
  
  const inds = document.getElementById("s-indicators"); inds.replaceChildren();
  (a.indicators||[]).forEach(ind=>{
    const tag=el("span","indicator-tag", ind);
    inds.appendChild(tag);
  });
  if (!(a.indicators||[]).length) {
    inds.appendChild(el("span","indicator-tag", "regras"));
  }

  const riskEl = document.getElementById("s-risk"); riskEl.replaceChildren();
  const r=a.risk||""; const cls=r.toLowerCase().includes("agress")?"high":r.toLowerCase().includes("conser")?"low":"medium";
  riskEl.appendChild(el("span","risk-badge "+cls, r||"Moderado"));

  const tbody=document.getElementById("trades-tbody"); tbody.replaceChildren();
  const noT=document.getElementById("no-trades");
  const trades=a.trades||[];
  if(trades.length===0){ noT.style.display="block"; }
  else {
    noT.style.display="none";
    trades.forEach(t=>{
      const pnl=Number(t.pnl)||0, fee=Number(t.fee_usd)||0;
      const ts=t.ts?new Date(t.ts).toLocaleTimeString("pt-BR"):"—";
      const tr=document.createElement("tr");
      const cells=[
        [ts, ""],
        [t.symbol||"", ""],
        [t.side||"", "side-"+(String(t.side||"").toLowerCase())],
        [Number(t.qty||0).toFixed(6), ""],
        ["$"+Number(t.price||0).toFixed(4), ""],
        [`${pnl>=0?"+":""}$${pnl.toFixed(4)}`, pnl>=0?"pnl-pos":"pnl-neg"],
        ["$"+fee.toFixed(4), "fee-val"],
      ];
      cells.forEach(([txt, clsName])=>{
        const td=document.createElement("td");
        if (clsName) td.className=clsName;
        td.textContent=txt;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  const ptbody=document.getElementById("pos-tbody"); ptbody.replaceChildren();
  const noP=document.getElementById("no-pos");
  const positions=a.positions||[];
  if(positions.length===0){ noP.style.display="block"; }
  else {
    noP.style.display="none";
    positions.forEach(p=>{
      const col=p.pnl_pct>=0?"#34a853":"#ea4335";
      const tr=document.createElement("tr");
      const vals=[p.symbol, p.qty, "$"+p.avg_price, "$"+p.cur_price,
        `${p.pnl_pct>=0?"+":""}${p.pnl_pct}%`, "$"+p.value_usd];
      vals.forEach((txt, i)=>{
        const td=document.createElement("td");
        td.textContent = txt == null ? "" : String(txt);
        if (i===4) td.style.color=col;
        tr.appendChild(td);
      });
      ptbody.appendChild(tr);
    });
  }
  
  drawModalChart(a.history||[], a.initial_balance||50);
  switchTab("overview");
}

function drawModalChart(history, initial) {
  modalChart.width  = modalChart.offsetWidth || 820;
  modalChart.height = 200;
  const W=modalChart.width, H=modalChart.height;
  mCtx.clearRect(0,0,W,H);
  mCtx.fillStyle="#0a0a1a"; mCtx.fillRect(0,0,W,H);
  
  if(history.length<2) {
    mCtx.fillStyle="#555"; mCtx.font="13px sans-serif"; mCtx.textAlign="center";
    mCtx.fillText("Aguardando dados...", W/2, H/2);
    return;
  }
  
  const vals=history.map(h=>h.v);
  const minV=Math.min(...vals,initial*0.8), maxV=Math.max(...vals,initial*1.15);
  const range=maxV-minV||1;
  const PAD=35, cw=W-PAD*2, ch=H-PAD*2;
  
  // Grade
  [0,25,50,75,100].forEach(pct=>{
    const v=minV+(range*pct/100);
    const py=H-PAD-((v-minV)/range)*ch;
    mCtx.strokeStyle="rgba(255,255,255,0.05)"; mCtx.lineWidth=1;
    mCtx.beginPath(); mCtx.moveTo(PAD,py); mCtx.lineTo(W-PAD,py); mCtx.stroke();
    mCtx.fillStyle="#555"; mCtx.font="9px sans-serif"; mCtx.textAlign="right";
    mCtx.fillText(`$${v.toFixed(1)}`,PAD-4,py+3);
  });
  
  // Linha de aporte
  const baseY=H-PAD-((initial-minV)/range)*ch;
  mCtx.strokeStyle="#4285f460"; mCtx.setLineDash([5,3]); mCtx.lineWidth=1.5;
  mCtx.beginPath(); mCtx.moveTo(PAD,baseY); mCtx.lineTo(W-PAD,baseY); mCtx.stroke();
  mCtx.setLineDash([]);
  mCtx.fillStyle="#4285f4"; mCtx.font="9px sans-serif"; mCtx.textAlign="left";
  mCtx.fillText(`$${initial} (aporte)`,PAD+4,baseY-4);
  
  // Área gradiente
  const lastVal=vals[vals.length-1];
  const color=lastVal>=initial?"#34a853":"#ea4335";
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
  mCtx.fillStyle=color; mCtx.font="bold 11px sans-serif"; mCtx.textAlign="left";
  mCtx.fillText(`$${lastVal.toFixed(2)}`,lx+8,ly+4);
}

// Tabs
document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.onclick=()=>switchTab(btn.dataset.tab);
});
function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  document.querySelectorAll(".tab-pane").forEach(p=>p.classList.toggle("active",p.id===`pane-${name}`));
  if(name==="overview"&&modalAgent) {
    setTimeout(()=>{
      if(modalChart.offsetWidth>0) {
        fetch(`/api/agents/${modalAgent.id}`).then(r=>r.json()).then(d=>{
          drawModalChart(d.history||[],d.initial_balance||50);
        }).catch(()=>{});
      }
    },50);
  }
}

document.getElementById("modal-close").onclick = ()=>modal.classList.remove("open");
modal.addEventListener("click",e=>{ if(e.target===modal) modal.classList.remove("open"); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    modal.classList.remove("open");
    closeMobilePanel();
  }
});

function isMobile() { return window.innerWidth <= 768; }
const rightPanel = document.getElementById("right-panel");
const panelToggle = document.getElementById("panel-toggle");
const panelScrim = document.getElementById("panel-scrim");
function closeMobilePanel() {
  rightPanel.classList.remove("open");
  panelScrim.classList.remove("show");
  panelToggle.setAttribute("aria-expanded", "false");
  panelToggle.textContent = "Painel";
}
function syncPanelToggle() {
  if (isMobile()) {
    panelToggle.classList.remove("desktop");
    rightPanel.classList.remove("collapsed");
    document.body.classList.remove("panel-collapsed");
    panelToggle.textContent = rightPanel.classList.contains("open") ? "Fechar" : "Painel";
  } else {
    panelToggle.classList.add("desktop");
    closeMobilePanel();
    panelToggle.textContent = rightPanel.classList.contains("collapsed") ? "Painel" : "Ocultar";
    document.body.classList.toggle("panel-collapsed", rightPanel.classList.contains("collapsed"));
  }
}
panelToggle.onclick = () => {
  if (isMobile()) {
    const open = !rightPanel.classList.contains("open");
    rightPanel.classList.toggle("open", open);
    panelScrim.classList.toggle("show", open);
    panelToggle.setAttribute("aria-expanded", String(open));
    panelToggle.textContent = open ? "Fechar" : "Painel";
  } else {
    rightPanel.classList.toggle("collapsed");
    document.body.classList.toggle("panel-collapsed", rightPanel.classList.contains("collapsed"));
    panelToggle.textContent = rightPanel.classList.contains("collapsed") ? "Painel" : "Ocultar";
    resizeCanvas();
  }
};
panelScrim.onclick = closeMobilePanel;
window.addEventListener("resize", () => { syncPanelToggle(); resizeCanvas(); });
syncPanelToggle();
setFeedEmpty();

// ── WEBSOCKET ─────────────────────────────────────────────
function onData(data) {
  if(!data) data = [];
  if(!data.length) {
    agentsData = [];
    updateRanking(); updateTopbar(); updateGlobalStats(); drawMiniChart();
    setFeedEmpty();
    return;
  }
  
  data.forEach(agent=>{
    if(agent.trades&&agent.trades[0]) {
      const t=agent.trades[0], key=`${agent.id}-${t.id}`;
      if(!activityLog.has(key)){
        activityLog.add(key);
        addActivity(agent.emoji,agent.name,t.side.toLowerCase(),
          `${t.symbol} @ $${Number(t.price).toFixed(4)}`,Number(t.fee_usd)||0,
          { strategy: strategyLabel(agent), reason: (agent.last_decision && agent.last_decision.reason) || "" });
      }
    }
    if((agent.generation||1)>1){
      const gk=`evo-${agent.id}`;
      if(!activityLog.has(gk)){
        activityLog.add(gk); elimCount++;
        addActivity(agent.emoji,agent.name,"ev",`🧬 Evoluiu para Gen ${agent.generation}`,0);
      }
    }
  });
  
  agentsData=data;
  updateRanking(); updateTopbar(); updateGlobalStats(); drawMiniChart();
  
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

function setWsStatus(kind, text) {
  const st=document.getElementById("status");
  st.textContent=text;
  st.className=kind;
  const wsEmpty=document.getElementById("feed-ws-empty");
  if (wsEmpty) wsEmpty.classList.toggle("hidden", kind==="ok");
}
function connect() {
  const proto=location.protocol==="https:"?"wss":"ws";
  const ws=new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen=()=>setWsStatus("ok","🟢 Conectado");
  ws.onmessage=e=>{ try{onData(JSON.parse(e.data));}catch(err){console.error(err);} };
  ws.onclose=()=>{ setWsStatus("bad","🔴 Reconectando..."); setTimeout(connect,3000); };
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

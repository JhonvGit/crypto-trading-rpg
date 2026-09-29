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
let cam  = { x: 0, y: -80, zoom: 0.9 };
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
  cam.zoom = Math.max(0.4, Math.min(2.2, cam.zoom - e.deltaY * 0.001));
}, { passive: false });

document.getElementById("btn-zi").onclick = () => cam.zoom = Math.min(2.2, cam.zoom + 0.12);
document.getElementById("btn-zo").onclick = () => cam.zoom = Math.max(0.4, cam.zoom - 0.12);
document.getElementById("btn-zr").onclick = () => { cam.x = 0; cam.y = -80; cam.zoom = 0.9; };

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
  clothes: ["#4285F4","#EA4335","#FBBC05","#34A853","#a855f7","#06b6d4","#f59e0b","#ec4899","#10b981","#6366f1"],
  skin: "#ffd1a3",
  hair: ["#1a1a1a","#4a2f1a","#6e3f1e","#8b5a2b","#d4af37"],
};

// ── LAYOUT SALA MAIOR 20x14 ──────────────────────────────
const ROOM_W = 20, ROOM_H = 14;

// 10 mesas: distribuídas em clusters
const DESKS = [
  {gx:3, gy:3},  {gx:5, gy:3},  {gx:7, gy:3},
  {gx:3, gy:6},  {gx:5, gy:6},
  {gx:10,gy:4},  {gx:12,gy:4},  {gx:14,gy:4},
  {gx:10,gy:8},  {gx:12,gy:8},
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
    const blink=Math.sin(time*4+idx)>0?1:0.3;
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
  const bobY = Math.sin(time*1.8+idx*1.3)*1.5;
  const {x,y}=iso(gx,gy), s=world2screen(x,y+bobY);
  const z=cam.zoom;
  const clothColor = C.clothes[idx%C.clothes.length];
  const skinColor = C.skin;
  const hairColor = C.hair[idx%C.hair.length];
  
  // Sombra
  ctx.fillStyle="rgba(0,0,0,0.15)";
  ctx.beginPath(); ctx.ellipse(s.x,s.y+3*z,10*z,4*z,0,0,Math.PI*2); ctx.fill();
  
  // Estado de animação
  let armAngle = Math.sin(time*2+idx)*0.2;
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
  const armL = Math.sin(time*2+idx)*6*z;
  const armR = Math.cos(time*2+idx)*6*z;
  
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
    const rsi = dec.rsi||0;
    const rsiCol = rsi<35?"#34a853":rsi>65?"#ea4335":"#fbbc05";
    indPills.push({text:`RSI ${rsi.toFixed(0)}`, col:rsiCol});
    
    if (dec.momentum) {
      const mCol = dec.momentum>=0?"#34a853":"#ea4335";
      indPills.push({text:`M${dec.momentum>=0?"+":""}${dec.momentum.toFixed(1)}%`, col:mCol});
    }
    if (dec.zscore) {
      indPills.push({text:`Z${dec.zscore.toFixed(1)}σ`, col:"#4285f4"});
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

// ── COR HELPER ────────────────────────────────────────────
function shadeColor(hex, p) {
  const n=parseInt(hex.slice(1),16);
  const r=Math.max(0,Math.min(255,(n>>16)+p));
  const g=Math.max(0,Math.min(255,((n>>8)&0xff)+p));
  const b=Math.max(0,Math.min(255,(n&0xff)+p));
  return `rgb(${r},${g},${b})`;
}

// ── CLIQUE NO CANVAS (abrir modal) ────────────────────────
canvas.addEventListener("click", e => {
  const r = canvas.getBoundingClientRect();
  const cx = e.clientX - r.left, cy = e.clientY - r.top;
  DESKS.forEach((desk, i) => {
    if (!agentsData[i]) return;
    const { x, y } = iso(desk.gx - 0.5, desk.gy - 0.5);
    const s = world2screen(x, y);
    const zz = cam.zoom;
    if (cx > s.x - 16*zz && cx < s.x + 16*zz && cy > s.y - 48*zz && cy < s.y + 4*zz) {
      openModal(agentsData[i]);
    }
  });
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
function updateRanking() {
  const el=document.getElementById("ranking-list"); el.innerHTML="";
  agentsData.forEach((a,i)=>{
    const pnlC=a.pnl_pct>0?"up":a.pnl_pct<0?"dn":"nt";
    const barPct = Math.min(100, Math.max(0, ((a.value-50)/50)*100));
    const barCol = a.pnl_pct>=0 ? "#34a853" : "#ea4335";
    
    const div=document.createElement("div");
    div.className="rank-row"+(i===0?" leader":"");
    div.innerHTML=`
      <div class="rr-avatar">${a.emoji}</div>
      <div class="rr-info">
        <div class="rr-name">${a.name}</div>
        <div class="rr-meta">Gen ${a.generation||1} · ${a.win_rate||0}% win · ${a.total_trades||0} trades</div>
        <div class="rr-bar-wrap"><div class="rr-bar" style="width:${barPct}%;background:${barCol}"></div></div>
      </div>
      <div class="rr-right">
        <div class="rr-val">$${a.value.toFixed(2)}</div>
        <div class="rr-pnl ${pnlC}">${a.pnl_pct>=0?"+":""}${a.pnl_pct.toFixed(1)}%</div>
      </div>
    `;
    div.onclick=()=>openModal(a);
    el.appendChild(div);
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
function addActivity(emoji, name, type, text, fee) {
  const feed=document.getElementById("activity-feed");
  const div=document.createElement("div"); div.className=`act-item ${type}`;
  const now=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const feeStr = fee>0?`<span class="act-fee"> fee $${fee.toFixed(4)}</span>`:"";
  
  let pillClass = type;
  let pillText = type.toUpperCase();
  if (type==="ev") { pillClass="ev"; pillText="EVOLUÇÃO"; }
  
  div.innerHTML=`
    <div class="act-header">
      <span class="act-agent">${emoji} ${name}</span>
      <span class="act-pill ${pillClass}">${pillText}</span>
    </div>
    <div class="act-detail">${text}${feeStr}</div>
    <span class="act-time">${now}</span>
  `;
  feed.insertBefore(div,feed.firstChild);
  while(feed.children.length>40) feed.removeChild(feed.lastChild);
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
  document.getElementById("modal-class").innerHTML = `${a.class} <span class="gen-badge ${genClass}">Gen ${gen}</span> · ${(a.symbols||[]).join(", ")}`;
  
  const pnlPos = (a.pnl_pct||0)>=0;
  document.getElementById("ms-v").textContent = `$${(a.value||0).toFixed(2)}`;
  document.getElementById("ms-p").textContent = `${pnlPos?"+":""}${(a.pnl_pct||0).toFixed(2)}%`;
  document.getElementById("ms-p").closest(".mstat").className = "mstat "+(pnlPos?"up":"dn");
  document.getElementById("ms-w").textContent = `${a.win_rate||0}%`;
  document.getElementById("ms-f").textContent = `$${(a.total_fees||0).toFixed(4)}`;
  document.getElementById("ms-t").textContent = a.total_trades||0;
  document.getElementById("ms-g").textContent = `Gen ${gen}`;
  
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
  
  const tbody=document.getElementById("trades-tbody"); tbody.innerHTML="";
  const noT=document.getElementById("no-trades");
  const trades=a.trades||[];
  if(trades.length===0){ noT.style.display="block"; }
  else {
    noT.style.display="none";
    trades.forEach(t=>{
      const pnl=Number(t.pnl)||0, fee=Number(t.fee)||0;
      const ts=t.ts?new Date(t.ts).toLocaleTimeString("pt-BR"):"—";
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
  
  const ptbody=document.getElementById("pos-tbody"); ptbody.innerHTML="";
  const noP=document.getElementById("no-pos");
  const positions=a.positions||[];
  if(positions.length===0){ noP.style.display="block"; }
  else {
    noP.style.display="none";
    positions.forEach(p=>{
      const col=p.pnl_pct>=0?"#34a853":"#ea4335";
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

// ── WEBSOCKET ─────────────────────────────────────────────
function onData(data) {
  if(!data||!data.length) return;
  
  data.forEach(agent=>{
    if(agent.trades&&agent.trades[0]) {
      const t=agent.trades[0], key=`${agent.id}-${t.id}`;
      if(!activityLog.has(key)){
        activityLog.add(key);
        addActivity(agent.emoji,agent.name,t.side.toLowerCase(),
          `${t.symbol} @ $${Number(t.price).toFixed(4)}`,Number(t.fee)||0);
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

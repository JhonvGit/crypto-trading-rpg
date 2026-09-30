/* ═══════════════════════════════════════════════════════════
   Trading Office — Luxury Single-Floor Engine & Mobile Ready
   ═══════════════════════════════════════════════════════════ */

const wrap       = document.getElementById("office-wrap");
const canvas     = document.getElementById("office-canvas");
const ctx        = canvas.getContext("2d");
const miniCanvas = document.getElementById("mini-chart");
const miniCtx    = miniCanvas.getContext("2d");
miniCanvas.width  = 300;
miniCanvas.height = 100;

function canvasWidth() { return canvas._cssWidth || canvas.clientWidth || canvas.width; }
function canvasHeight() { return canvas._cssHeight || canvas.clientHeight || canvas.height; }

function resizeCanvas() {
  const rect = wrap.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas._cssWidth = rect.width;
  canvas._cssHeight = rect.height;
  ctx.imageSmoothingEnabled = true;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ── CÂMERA & CONTROLES TOUCH ────────
const CAM_HOME = { x: -80, y: -40, zoom: 0.85 };
let cam  = { ...CAM_HOME };
let drag = { down: false, sx: 0, sy: 0, cx: 0, cy: 0 };
let mouse = { cx: -999, cy: -999 };
let initialPinchDist = null;
let initialZoom = null;

function handleStart(x, y) { drag.down=true; drag.sx=x; drag.sy=y; drag.cx=cam.x; drag.cy=cam.y; }
function handleMove(x, y) {
  if(drag.down) { cam.x = drag.cx+(x-drag.sx); cam.y = drag.cy+(y-drag.sy); }
  const r = canvas.getBoundingClientRect();
  mouse.cx = x - r.left; mouse.cy = y - r.top;
}
function handleEnd() { drag.down=false; initialPinchDist=null; }

canvas.addEventListener("mousedown", e => handleStart(e.clientX, e.clientY));
window.addEventListener("mouseup", handleEnd);
window.addEventListener("mousemove", e => handleMove(e.clientX, e.clientY));

// Mobile Touch (Drag + Zoom)
canvas.addEventListener("touchstart", e => {
    if (e.touches.length === 1) handleStart(e.touches[0].clientX, e.touches[0].clientY);
}, {passive:false});
window.addEventListener("touchend", handleEnd);
canvas.addEventListener("touchmove", e => {
   if (e.touches.length === 2) {
       e.preventDefault();
       const dx = e.touches[0].clientX - e.touches[1].clientX;
       const dy = e.touches[0].clientY - e.touches[1].clientY;
       const dist = Math.hypot(dx, dy);
       if (initialPinchDist == null) { initialPinchDist = dist; initialZoom = cam.zoom; }
       else { cam.zoom = Math.max(0.3, Math.min(2.5, initialZoom * (dist / initialPinchDist))); }
   } else if (e.touches.length === 1) {
       e.preventDefault();
       handleMove(e.touches[0].clientX, e.touches[0].clientY);
   }
}, {passive:false});

canvas.addEventListener("wheel", e => { e.preventDefault(); cam.zoom = Math.max(0.3, Math.min(2.5, cam.zoom-e.deltaY*0.002)); }, {passive:false});

document.getElementById("btn-zi").onclick = () => cam.zoom = Math.min(2.5, cam.zoom + 0.15);
document.getElementById("btn-zo").onclick = () => cam.zoom = Math.max(0.3, cam.zoom - 0.15);
document.getElementById("btn-zr").onclick = () => { cam.x=CAM_HOME.x; cam.y=CAM_HOME.y; cam.zoom=CAM_HOME.zoom; };

// ── ISOMETRIC & 3D ENGINE ────────
const TILE_W = 60, TILE_H = 30;
const WORLD_SCALE = 1.18;

function iso(gx, gy) {
  return { x: (gx - gy) * (TILE_W / 2) * WORLD_SCALE, y: (gx + gy) * (TILE_H / 2) * WORLD_SCALE };
}
function world2screen(wx, wy) {
  return {
    x: Math.round(canvasWidth() / 2 + cam.x + wx * cam.zoom),
    y: Math.round(canvasHeight() / 2 + cam.y + wy * cam.zoom)
  };
}
function shadeColor(hex, p) {
    let R = parseInt(hex.substring(1,3),16), G = parseInt(hex.substring(3,5),16), B = parseInt(hex.substring(5,7),16);
    R = parseInt(R * (100 + p) / 100); G = parseInt(G * (100 + p) / 100); B = parseInt(B * (100 + p) / 100);
    R=(R<255)?(R>0?R:0):255; G=(G<255)?(G>0?G:0):255; B=(B<255)?(B>0?B:0):255;
    const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
    const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
    const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
    return "#"+RR+GG+BB;
}

const C = {
  floorLight: "#cbd2dc", floorDark: "#aeb8c6", floorThick: "#697586",
  wood1: "#8d6b4d", wood2: "#604735", woodThick: "#2b211b",
  wallBack: "#273142", wallLeft: "#1c2636", // architectural graphite
  wallBrick: ["#303b4e", "#35445a", "#263244"], wallMortar: "#182231",
  deskTop: "#f1f5f9", deskLegs: "#596579", deskEdge: "#cbd5e1",
  marble: "#eef2f7", brass: "#b9985a", glass: "#8ed8e8",
  skin: ["#ffce9e", "#e6b07e", "#996b42", "#664021", "#4a2c13"],
  clothes: ["#3498db", "#e74c3c", "#f39c12", "#2ecc71", "#9b59b6", "#1abc9c", "#34495e"],
  hair: ["#2c3e50", "#3e2723", "#f1c40f", "#d35400"]
};

// Ampliado para UM único andar luxuoso
const ROOM_W = 18, ROOM_H = 15;

function getDeskConfig(idx) {
    // Organizado em 5 colunas x 3 linhas => até 15 agentes
    return {
        gx: 2 + (idx % 6) * 2.5,
        gy: 2 + Math.floor(idx / 6) * 3
    };
}

let time = 0;
let agentsData = [];
let avatarsMap = {};
let activityLog = new Set();
let elimCount = 0;
let hoveredAgent = null;

// ── AGENT AVATAR SYSTEM ────────
class AgentAvatar {
  constructor(agent, idx) {
    this.id = agent.id;
    this.idx = idx;
    const desk = getDeskConfig(idx);
    this.deskX = desk.gx;
    this.deskY = desk.gy;
    this.x = desk.gx;
    this.y = desk.gy;
    this.tx = this.x;
    this.ty = this.y;
    this.state = 'working';
    this.timer = Math.random() * 500;
    this.agent = agent;
    this.skin = C.skin[idx % C.skin.length];
    this.cloth = C.clothes[idx % C.clothes.length];
    this.hair = C.hair[idx % C.hair.length];
  }
  update(agentData) {
    this.agent = agentData;
    
    if (this.state === 'working' || this.state === 'resting') {
      this.timer--;
      if (this.agent.last_decision && this.state !== 'working' && Math.random() < 0.1) {
         this.state = 'walking';
         this.tx = this.deskX; this.ty = this.deskY; // Volta urgente pra mesa
      }
      
      if (this.timer <= 0) {
        if (this.state === 'working') {
           if (Math.random() < 0.25) { // Vai pro lounge (no fundo à direita)
             this.state = 'walking';
             this.tx = 12 + Math.random() * 4;
             this.ty = 11 + Math.random() * 2;
             this.timer = 500 + Math.random() * 400; 
           } else { this.timer = 200 + Math.random() * 400; }
        } else { // Retorna ao trabalho
           this.state = 'walking'; 
           this.tx = this.deskX; this.ty = this.deskY;
           this.timer = 400 + Math.random() * 600;
        }
      }
    } else if (this.state === 'walking') {
       const dx = this.tx - this.x, dy = this.ty - this.y;
       const dist = Math.hypot(dx, dy);
       if (dist > 0.08) {
           this.x += (dx / dist) * 0.045;
           this.y += (dy / dist) * 0.045;
       } else {
           this.x = this.tx; this.y = this.ty;
           this.state = (this.x === this.deskX && this.y === this.deskY) ? 'working' : 'resting';
       }
    }
  }
}

// ── VOXEL RENDER ENGINE ────────
function drawCuboid(s, dx, dy, w, d, h, top, left, right, thick=1, stroke="#222") {
  const z = cam.zoom;
  const xw = (w * TILE_W/2) * z, yw = (d * TILE_W/2) * z;
  const xh = (w * TILE_H/2) * z, yh = (d * TILE_H/2) * z;
  const hh = h * z, bx = s.x + dx*z, by = s.y + dy*z;

  ctx.lineWidth = thick; ctx.strokeStyle = stroke; ctx.lineJoin = "round";
  
  if (left) {
    ctx.fillStyle = left; ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx - xw, by - xh);
    ctx.lineTo(bx - xw, by - xh - hh); ctx.lineTo(bx, by - hh);
    ctx.closePath(); ctx.fill(); if(thick>0) ctx.stroke();
  }
  if (right) {
    ctx.fillStyle = right; ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx + yw, by - yh);
    ctx.lineTo(bx + yw, by - yh - hh); ctx.lineTo(bx, by - hh);
    ctx.closePath(); ctx.fill(); if(thick>0) ctx.stroke();
  }
  if (top) {
    ctx.fillStyle = top; ctx.beginPath();
    ctx.moveTo(bx, by - hh); ctx.lineTo(bx - xw, by - xh - hh);
    ctx.lineTo(bx - xw + yw, by - xh - yh - hh); ctx.lineTo(bx + yw, by - yh - hh);
    ctx.closePath(); ctx.fill(); if(thick>0) ctx.stroke();
  }
}

function drawFloorBlock(gx, gy, isLounge) {
    const {x,y} = iso(gx, gy), s = world2screen(x,y);
    const top = isLounge ? ((gx+gy)%2===0?C.wood1:C.wood2) : ((gx+gy)%2===0?C.floorLight:C.floorDark);
    const thick = isLounge ? C.woodThick : C.floorThick;
    drawCuboid(s, 0, 0, 1, 1, 8, top, thick, shadeColor(thick,-15), 1, "rgba(0,0,0,0.15)");
}

function drawSolidWall(gx, gy, dir) {
    const {x,y} = iso(gx, gy), s = world2screen(x,y);
    const z = cam.zoom, w = TILE_W/2 * z, h = TILE_H/2 * z, wh = 120 * z;
    const brick = C.wallBrick[(gx + gy + (dir === 'left' ? 1 : 0)) % C.wallBrick.length];
    ctx.lineWidth = 1.5; ctx.strokeStyle = C.wallMortar;
    ctx.beginPath();
    if (dir === 'left') {
        ctx.fillStyle = brick;
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x-w, s.y-h);
        ctx.lineTo(s.x-w, s.y-h-wh); ctx.lineTo(s.x, s.y-wh);
    } else {
        ctx.fillStyle = brick;
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x+w, s.y-h);
        ctx.lineTo(s.x+w, s.y-h-wh); ctx.lineTo(s.x, s.y-wh);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // fiadas de tijolos estilizadas
    ctx.save(); ctx.globalAlpha = 0.38; ctx.strokeStyle = C.wallMortar; ctx.lineWidth = Math.max(1, z);
    for (let row = 1; row < 6; row++) {
      const yy = s.y - row * (wh / 6);
      ctx.beginPath();
      if (dir === 'left') { ctx.moveTo(s.x, yy); ctx.lineTo(s.x-w, yy-h); }
      else { ctx.moveTo(s.x, yy); ctx.lineTo(s.x+w, yy-h); }
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = shadeColor(dir==='left'?C.wallLeft:C.wallBack, -20);
    ctx.beginPath();
    if(dir==='left') { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x-w, s.y-h); ctx.lineTo(s.x-w, s.y-h-12*z); ctx.lineTo(s.x, s.y-12*z); }
    else { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x+w, s.y-h); ctx.lineTo(s.x+w, s.y-h-12*z); ctx.lineTo(s.x, s.y-12*z); }
    ctx.fill();
    
    // Friso decorativo
    if ((gx+gy)%4===0) {
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        ctx.beginPath();
        if(dir==='left') { ctx.moveTo(s.x, s.y-40*z); ctx.lineTo(s.x-w, s.y-h-40*z); ctx.lineTo(s.x-w, s.y-h-45*z); ctx.lineTo(s.x, s.y-45*z); }
        else { ctx.moveTo(s.x, s.y-40*z); ctx.lineTo(s.x+w, s.y-h-40*z); ctx.lineTo(s.x+w, s.y-h-45*z); ctx.lineTo(s.x, s.y-45*z); }
        ctx.fill();
    }
}

function drawFancyDesk(gx, gy) {
    const {x,y} = iso(gx, gy), s = world2screen(x,y);
    const z = cam.zoom;
    // estação premium: madeira, alumínio escovado e vidro
    drawCuboid(s, -12, -4, 0.15, 0.15, 18, C.deskLegs, "#46556b", "#344155", 1);
    drawCuboid(s, 12, -4, 0.15, 0.15, 18, C.deskLegs, "#46556b", "#344155", 1);
    drawCuboid(s, 0, -6, 1.05, 0.68, 2.3, C.deskTop, "#aab6c6", "#8794a6", 1.5, "rgba(15,23,42,.75)");
    drawCuboid(s, -3, -9, 0.42, 0.12, 12, "#1c2636", "#101925", "#0a111c", 1, "#64748b");
    ctx.save(); ctx.shadowColor = "#60a5fa"; ctx.shadowBlur = 7*z; ctx.fillStyle = "#60a5fa";
    ctx.beginPath(); ctx.arc(s.x-3*z, s.y-22*z, 1.6*z, 0, Math.PI*2); ctx.fill(); ctx.restore();
}

function drawFeatureColumn(gx, gy) {
    const {x,y} = iso(gx, gy), s = world2screen(x,y);
    drawCuboid(s, 0, 0, 0.28, 0.28, 88, "#d6b878", "#9b7b45", "#71572f", 1, "#241d14");
}

function drawSmartAvatar(ava) {
    const {x,y} = iso(ava.x - 0.5, ava.y - 0.5);
    const isWalk = ava.state === 'walking';
    const bob = isWalk ? Math.abs(Math.sin(time*20+ava.idx)) * 4 * cam.zoom : 0;
    const s = world2screen(x, y - bob/cam.zoom);
    const z = cam.zoom;
    const isTyping = ava.agent.last_decision && ava.state === 'working';
    const typeB = isTyping ? (Math.sin(time*20+ava.idx)>0? 1.5 : 0) : 0;
    
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath(); ctx.ellipse(s.x, s.y+2*z + (bob), 14*z, 7*z, 0, 0, Math.PI*2); ctx.fill();

    drawCuboid(s, -6, -4, 0.35, 0.35, 13, ava.cloth, shadeColor(ava.cloth,-15), shadeColor(ava.cloth,-30), 1.2, "#111");
    // Arms
    const swing = isWalk ? Math.sin(time*15+ava.idx)*4 : 0;
    drawCuboid(s, -2, -5 + typeB, 0.14, 0.25, 9, ava.cloth, shadeColor(ava.cloth,-15), shadeColor(ava.cloth,-30), 1.2, "#111");
    drawCuboid(s, -10, -7 - typeB, 0.14, 0.25, 9, ava.cloth, shadeColor(ava.cloth,-15), shadeColor(ava.cloth,-30), 1.2, "#111");
    // Hands
    drawCuboid(s, -1, -4 + typeB + swing, 0.12, 0.12, 3, ava.skin, shadeColor(ava.skin,-15), shadeColor(ava.skin,-30), 1, "#111");
    drawCuboid(s, -9, -6 - typeB - swing, 0.12, 0.12, 3, ava.skin, shadeColor(ava.skin,-15), shadeColor(ava.skin,-30), 1, "#111");
    // Head Square
    drawCuboid(s, -6, -17, 0.45, 0.45, 10, ava.skin, shadeColor(ava.skin,-10), shadeColor(ava.skin,-20), 1.5, "#111");
    // Hair
    drawCuboid(s, -6, -27, 0.5, 0.5, 4, ava.hair, shadeColor(ava.hair,-10), shadeColor(ava.hair,-20), 1.5, "#111");
    drawCuboid(s, -11, -24, 0.15, 0.5, 5, ava.hair, shadeColor(ava.hair,-10), shadeColor(ava.hair,-20), 1.5, "#111");

    ctx.fillStyle = "#fff";
    const hx = s.x - 5*z, hy = s.y - 22*z;
    ctx.beginPath(); ctx.arc(hx - 2*z, hy, 1.5*z, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx - 7*z, hy - 2*z, 1.5*z, 0, 7); ctx.fill();
    
    const mood = ava.agent.pnl_pct >= 0 ? "#10b981" : "#f43f5e";
    ctx.fillStyle = mood;
    ctx.beginPath(); ctx.arc(hx - 2*z, hy, 0.8*z, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx - 7*z, hy - 2*z, 0.8*z, 0, 7); ctx.fill();
    
    drawDecisionBubble(s, z, ava);
    
    // Tabela clique adaptativa para celular (alvo expandido)
    if (Math.hypot(mouse.cx - s.x, mouse.cy - (s.y-20*z)) < 25*z) {
      hoveredAgent = ava.agent;
      if (typeof showTooltip === 'function') showTooltip(ava.agent);
    }
}

function drawDecisionBubble(s, z, ava) {
    const dec = ava.agent.last_decision;
    if (!dec || z < 0.5) return;
    const txt = `${dec.side==="BUY"?"▲":"▼"} ${dec.symbol}`;
    const floatY = (Math.sin(time*3+ava.idx)*3) * z;
    ctx.font = `bold ${5.5*z}px 'Plus Jakarta Sans', sans-serif`;
    const w = ctx.measureText(txt).width + 12*z, bx = s.x - w/2, by = s.y - 46*z + floatY;
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.strokeStyle = dec.side==="BUY" ? "#10b981" : "#f43f5e";
    ctx.lineWidth = 1.8; ctx.beginPath();
    ctx.roundRect(bx, by, w, 12*z, 4*z); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x-3*z, by+12*z); ctx.lineTo(s.x+3*z, by+12*z); ctx.lineTo(s.x, by+17*z); ctx.fill();
    
    ctx.fillStyle = ctx.strokeStyle;
    ctx.textAlign = "center"; ctx.fillText(txt, s.x, by + 8.5*z); ctx.textAlign = "left";
}

function drawLuxuryWindow(gx, gy, dir) {
  const {x,y} = iso(gx, gy), s = world2screen(x,y), z = cam.zoom;
  const w = 18*z, h = 34*z, ox = dir === 'left' ? -w*0.55 : w*0.55;
  ctx.save(); ctx.shadowColor = "#67e8f9"; ctx.shadowBlur = 10*z;
  ctx.fillStyle = "#102a45"; ctx.strokeStyle = C.brass; ctx.lineWidth = 2*z;
  ctx.fillRect(s.x+ox-w/2, s.y-82*z, w, h); ctx.strokeRect(s.x+ox-w/2, s.y-82*z, w, h);
  ctx.strokeStyle = "rgba(103,232,249,.8)"; ctx.lineWidth = 1*z;
  ctx.beginPath(); ctx.moveTo(s.x+ox, s.y-82*z); ctx.lineTo(s.x+ox, s.y-48*z); ctx.moveTo(s.x+ox-w/2, s.y-65*z); ctx.lineTo(s.x+ox+w/2, s.y-65*z); ctx.stroke();
  ctx.restore();
}

function drawPendantLamp(gx, gy) {
  const {x,y} = iso(gx, gy), s = world2screen(x,y), z = cam.zoom;
  ctx.save(); ctx.strokeStyle = C.brass; ctx.lineWidth = 1.5*z; ctx.beginPath(); ctx.moveTo(s.x, s.y-110*z); ctx.lineTo(s.x, s.y-82*z); ctx.stroke();
  ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 16*z; ctx.fillStyle = "#fff1a8"; ctx.beginPath(); ctx.arc(s.x, s.y-78*z, 5*z, 0, Math.PI*2); ctx.fill(); ctx.restore();
}

function drawSofa(gx, gy, col) {
    const {x,y} = iso(gx, gy), s = world2screen(x,y);
    drawCuboid(s, 0, 0, 0.8, 1.8, 5, col, shadeColor(col,-15), shadeColor(col,-30), 1.5, "#222");
    drawCuboid(s, -8, 5, 0.3, 1.8, 12, shadeColor(col,-5), shadeColor(col,-20), shadeColor(col,-35), 1.5, "#222");
}

function drawPlant(gx, gy) {
    const {x,y} = iso(gx, gy), s = world2screen(x,y);
    drawCuboid(s, 0, 0, 0.6, 0.6, 8, "#e2e8f0", "#cbd5e1", "#94a3b8", 1.5, "#555"); 
    drawCuboid(s, 0, -8, 0.8, 0.8, 8, "#10b981", "#059669", "#047857", 1.5, "#022c22"); 
}

// ── MEGA RENDERING LOOP ────────
function renderOffice() {
    hoveredAgent = null;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    
    // Background Radial Rico
    const bg = ctx.createRadialGradient(canvasWidth()/2, canvasHeight()/3, 0, canvasWidth()/2, canvasHeight()/2, canvasWidth());
    // plano de piso contínuo: visual de maquete premium, sem ruído agressivo
    const floor = ctx.createLinearGradient(0, 0, canvasWidth(), canvasHeight());
    floor.addColorStop(0, "#1c2636"); floor.addColorStop(0.48, "#111a29"); floor.addColorStop(1, "#080d16");
    bg.addColorStop(0, "#34445a"); bg.addColorStop(1, "#080d16");
    ctx.fillStyle = bg; ctx.fillRect(0,0,canvasWidth(), canvasHeight());
    // Luxo: halo de iluminação, vitrais e linhas arquitetônicas no piso
    ctx.save();
    ctx.globalAlpha = 0.18;
    const glow = ctx.createRadialGradient(canvasWidth()*0.52, canvasHeight()*0.28, 4, canvasWidth()*0.52, canvasHeight()*0.28, canvasWidth()*0.62);
    glow.addColorStop(0, "#67e8f9"); glow.addColorStop(0.35, "#6366f1"); glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, canvasWidth(), canvasHeight());
    ctx.globalAlpha = 0.12; ctx.strokeStyle = "#d4a84f"; ctx.lineWidth = 1;
    for (let i = -4; i < 9; i++) { ctx.beginPath(); ctx.moveTo(canvasWidth()*0.5 + i*70, 0); ctx.lineTo(canvasWidth()*0.5 + i*180, canvasHeight()); ctx.stroke(); }
    ctx.restore();
    
    agentsData.forEach((ag, i) => {
        if (!avatarsMap[ag.id]) avatarsMap[ag.id] = new AgentAvatar(ag, i);
        avatarsMap[ag.id].update(ag);
    });
    
    const drawQueue = [];
    
    for (let gx = 0; gx < ROOM_W; gx++) {
        drawQueue.push({ type: 'wallR', gx, gy: 0, z: Math.round((gx)*10) - 50 });
        if (gx % 4 === 1) drawQueue.push({ type: 'window', gx, gy: 0, dir: 'right', z: Math.round(gx*10) - 45 });
        if (gx % 5 === 2) drawQueue.push({ type: 'lamp', gx, gy: 1, z: Math.round(gx*10) + 2 });
        if (gx === 5 || gx === 12) drawQueue.push({ type: 'column', gx, gy: 0, z: Math.round(gx*10) + 4 });
    }
    for (let gy = 0; gy < ROOM_H; gy++) {
        drawQueue.push({ type: 'wallL', gx: 0, gy, z: Math.round((gy)*10) - 50 });
        if (gy % 4 === 1) drawQueue.push({ type: 'window', gx: 0, gy, dir: 'left', z: Math.round(gy*10) - 45 });
    }

    for (let gx = 0; gx < ROOM_W; gx++) {
        for (let gy = 0; gy < ROOM_H; gy++) {
            const isLounge = (gx >= 12 && gx <= 17 && gy >= 8 && gy <= 14);
            if (gx > 0 && gx < ROOM_W && gy > 0 && gy < ROOM_H) {
              drawQueue.push({ type: 'tile', gx, gy, isLounge, z: Math.round((gx+gy)*10) });
            }
        }
    }
    
    for (let i = 0; i < agentsData.length; i++) {
        const dc = getDeskConfig(i);
        drawQueue.push({ type: 'desk', gx: dc.gx, gy: dc.gy, z: Math.round((dc.gx+dc.gy)*10) + 5 });
    }
    
    const lz = Math.round((14+11)*10) + 6;
    drawQueue.push({ type: 'sofa', gx: 14, gy: 9, col: "#e74c3c", z: Math.round((14+9)*10) + 6 });
    drawQueue.push({ type: 'sofa', gx: 16, gy: 11, col: "#8e44ad", z: Math.round((16+11)*10) + 6 });
    drawQueue.push({ type: 'plant', gx: 13, gy: 13, z: Math.round((13+13)*10) + 6 });
    drawQueue.push({ type: 'plant', gx: 17, gy: 9, z: Math.round((17+9)*10) + 6 });
    
    Object.values(avatarsMap).forEach(ava => {
        drawQueue.push({ type: 'avatar', ava, z: Math.round((ava.x + ava.y)*10) + 15 });
    });
    
    drawQueue.sort((a,b) => a.z - b.z);
    
    for (const item of drawQueue) {
        if (item.type === 'tile') drawFloorBlock(item.gx, item.gy, item.isLounge);
        else if (item.type === 'wallR') drawSolidWall(item.gx, item.gy, 'right');
        else if (item.type === 'wallL') drawSolidWall(item.gx, item.gy, 'left');
        else if (item.type === 'window') drawLuxuryWindow(item.gx, item.gy, item.dir);
        else if (item.type === 'lamp') drawPendantLamp(item.gx, item.gy);
        else if (item.type === 'column') drawFeatureColumn(item.gx, item.gy);
        else if (item.type === 'desk') drawFancyDesk(item.gx, item.gy);
        else if (item.type === 'sofa') drawSofa(item.gx, item.gy, item.col);
        else if (item.type === 'plant') drawPlant(item.gx, item.gy);
        else if (item.type === 'avatar') drawSmartAvatar(item.ava);
    }
    
    time += 0.02;
    if (!hoveredAgent && typeof tooltip !== 'undefined') tooltip.classList.remove("show");
}

function deskScreen(idx) {
  const desk = getDeskConfig(idx);
  const { x, y } = iso(desk.gx - 0.5, desk.gy - 0.5); // Remove desk.floor arg
  return world2screen(x, y);
}
function hitDesk(cx, cy, idx) {
  const s = deskScreen(idx);
  const zz = cam.zoom;
  // Aumente a HitBox para celular
  return cx > s.x - 30*zz && cx < s.x + 30*zz && cy > s.y - 70*zz && cy < s.y + 20*zz;
}

canvas.addEventListener("click", e => {
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) return;
  const r = canvas.getBoundingClientRect();
  const cx = e.clientX - r.left, cy = e.clientY - r.top;
  for (let i = 0; i < agentsData.length; i++) {
    if (hitDesk(cx, cy, i)) { openModal(agentsData[i]); break; }
  }
});
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
function deskScreen(idx) {
  const desk = getDeskConfig(idx);
  const { x, y } = iso(desk.gx - 0.5, desk.gy - 0.5, desk.floor);
  return world2screen(x, y);
}
function hitDesk(cx, cy, idx) {
  const s = deskScreen(idx);
  const zz = cam.zoom;
  return cx > s.x - 22*zz && cx < s.x + 22*zz && cy > s.y - 65*zz && cy < s.y + 15*zz;
}

// ── CLIQUE NO CANVAS (abrir modal) ────────────────────────
canvas.addEventListener("click", e => {
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) return;
  const r = canvas.getBoundingClientRect();
  const cx = e.clientX - r.left, cy = e.clientY - r.top;
  for (let i = 0; i < agentsData.length; i++) {
    if (hitDesk(cx, cy, i)) { openModal(agentsData[i]); break; }
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
  const totalValue = agentsData.reduce((s,a)=>(a.value||0)+s, 0);
  const initialValue = agentsData.reduce((s,a)=>(a.initial_balance||50)+s, 0);
  const totalPnl = totalValue - initialValue;
  
  const valEl = document.getElementById("gs-value");
  if (valEl) valEl.textContent = "$"+totalValue.toFixed(2);
  
  const pnlEl = document.getElementById("gs-pnl");
  if (pnlEl) {
      pnlEl.textContent = `${totalPnl>=0?"+":""}$${totalPnl.toFixed(2)}`;
      pnlEl.style.color = totalPnl >= 0 ? "#10b981" : "#f43f5e";
  }
  
  const tradesEl = document.getElementById("gs-trades");
  if (tradesEl) tradesEl.textContent = totalTrades;
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


// ── MOBILE TABS LOGIC ────────
document.querySelectorAll('.panel-tab-btn').forEach(btn => {
    btn.onclick = () => {
        const target = btn.dataset.ptab;
        document.querySelectorAll('.panel-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.getElementById('sec-stats').style.display = (target === 'all') ? 'block' : 'none';
        document.getElementById('sec-chart').style.display = (target === 'all' || target === 'ranking') ? 'block' : 'none';
        document.getElementById('sec-ranking').style.display = (target === 'all' || target === 'ranking') ? 'block' : 'none';
        document.getElementById('sec-activity').style.display = (target === 'all' || target === 'activity') ? 'block' : 'none';
    };
});

const mBtnOffice = document.getElementById("m-btn-office");
const mBtnRank = document.getElementById("m-btn-rank");
const mBtnFeed = document.getElementById("m-btn-feed");

function activateMNav(btnId) {
    [mBtnOffice, mBtnRank, mBtnFeed].forEach(b => { if(b) b.classList.remove("active"); });
    const b = document.getElementById(btnId);
    if(b) b.classList.add("active");
}

if(mBtnOffice) mBtnOffice.onclick = () => { closeMobilePanel(); activateMNav('m-btn-office'); };
if(mBtnRank) mBtnRank.onclick = () => { 
    if(!rightPanel.classList.contains("open")) panelToggle.onclick(); 
    document.querySelector('.panel-tab-btn[data-ptab="ranking"]').click();
    activateMNav('m-btn-rank');
};
if(mBtnFeed) mBtnFeed.onclick = () => { 
    if(!rightPanel.classList.contains("open")) panelToggle.onclick(); 
    document.querySelector('.panel-tab-btn[data-ptab="activity"]').click();
    activateMNav('m-btn-feed');
};

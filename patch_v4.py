import re

with open("static/office.js", "r", encoding="utf-8") as f:
    js = f.read()

# Replace the drawing engine block
start_sig = "/* ═══════════════════════════════════════════════════════════\n   Trading Office — Smart Multi-Floor Engine"
end_sig = "function strategyLabel(agent)"

idx1 = js.find(start_sig)
idx2 = js.find(end_sig)

if idx1 == -1 or idx2 == -1:
    print("Could not find blocks")
    exit(1)

NEW_CODE = """/* ═══════════════════════════════════════════════════════════
   Trading Office — Luxury Single-Floor Engine & Mobile Ready
   ═══════════════════════════════════════════════════════════ */

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
  ctx.imageSmoothingEnabled = false;
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

function iso(gx, gy) {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) };
}
function world2screen(wx, wy) {
  return {
    x: Math.round(canvas.width / 2 + cam.x + wx * cam.zoom),
    y: Math.round(canvas.height / 2 + cam.y + wy * cam.zoom)
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
  floorLight: "#ecf0f1", floorDark: "#e1e6e8", floorThick: "#bdc3c7",
  wood1: "#8e5a3e", wood2: "#7a4c33", woodThick: "#4d2e1c",
  wallBack: "#d5dbdb", wallLeft: "#c2cacb", // Solid fancy walls
  deskTop: "#ffffff", deskLegs: "#95a5a6", deskEdge: "#ecf0f1",
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
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#999";
    ctx.beginPath();
    if (dir === 'left') {
        ctx.fillStyle = C.wallLeft;
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x-w, s.y-h);
        ctx.lineTo(s.x-w, s.y-h-wh); ctx.lineTo(s.x, s.y-wh);
    } else {
        ctx.fillStyle = C.wallBack;
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x+w, s.y-h);
        ctx.lineTo(s.x+w, s.y-h-wh); ctx.lineTo(s.x, s.y-wh);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    
    // Baseboard da parede
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
    // Mesa premium preta e branca
    drawCuboid(s, -12, -4, 0.15, 0.15, 18, C.deskLegs, "#7f8c8d", "#bdc3c7", 1);
    drawCuboid(s, 12, -4, 0.15, 0.15, 18, C.deskLegs, "#7f8c8d", "#bdc3c7", 1);
    drawCuboid(s, 0, -6, 0.9, 0.6, 2, C.deskTop, C.deskEdge, "#bdc3c7", 1.5, "#95a5a6");
    // Computador moderno
    drawCuboid(s, -3, -8, 0.2, 0.2, 2, "#444", "#333", "#222", 1);
    drawCuboid(s, -3, -10, 0.45, 0.1, 14, "#111", "#050505", shadeColor("#111", -20), 1, "#444");
    // Teclado rgb
    drawCuboid(s, 10, -6, 0.35, 0.15, 1, "#rrr", "#bbb", "#aaa", 0);
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
    const bg = ctx.createRadialGradient(canvas.width/2, canvas.height/3, 0, canvas.width/2, canvas.height/2, canvas.width);
    bg.addColorStop(0, "#2c3e50"); bg.addColorStop(1, "#0f172a");
    ctx.fillStyle = bg; ctx.fillRect(0,0,canvas.width, canvas.height);
    
    agentsData.forEach((ag, i) => {
        if (!avatarsMap[ag.id]) avatarsMap[ag.id] = new AgentAvatar(ag, i);
        avatarsMap[ag.id].update(ag);
    });
    
    const drawQueue = [];
    
    for (let gx = 0; gx < ROOM_W; gx++) {
        drawQueue.push({ type: 'wallR', gx, gy: 0, z: Math.round((gx)*10) - 50 });
    }
    for (let gy = 0; gy < ROOM_H; gy++) {
        drawQueue.push({ type: 'wallL', gx: 0, gy, z: Math.round((gy)*10) - 50 });
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
"""

final = NEW_CODE + js[idx2:]
with open("static/office.js", "w", encoding="utf-8") as f:
    f.write(final)

print("Make v4 Single Floor done")

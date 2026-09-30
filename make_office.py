import re

with open("static/office.js", "r", encoding="utf-8") as f:
    js = f.read()

# We need to extract the UI manipulation code (Modal, UI, WebSockets) and inject our own Canvas routines.
# Notice that the old file structure had:
# 1. Canvas/Event Listeners
# 2. Rendering functions
# 3. `function strategyLabel(...)` and onwards -> UI Logic, Tooltip, hit tests, Modal, WS.

part1_end = js.find("function strategyLabel")
if part1_end == -1:
    print("Error: Could not find function strategyLabel")
    exit(1)

ui_code = js[part1_end:]

# But we need to replace the tooltip hit test mechanic inside `ui_code`, or just do tooltip trigger inside our render.
# We also have to reconstruct `isMobile`, `updateRanking` etc which are perfectly fine.

NEW_CANVAS_ENGINE = """/* ═══════════════════════════════════════════════════════════
   Trading Office — Smart Multi-Floor Engine
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
  ctx.imageSmoothingEnabled = false; // Pixel art style
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ── CÂMERA ────────
const CAM_HOME = { x: -80, y: -40, zoom: 0.8 };
let cam  = { ...CAM_HOME };
let drag = { down: false, sx: 0, sy: 0, cx: 0, cy: 0 };
let mouse = { cx: -999, cy: -999 };

canvas.addEventListener("mousedown", e => { drag.down=true; drag.sx=e.clientX; drag.sy=e.clientY; drag.cx=cam.x; drag.cy=cam.y; });
window.addEventListener("mouseup",   () => drag.down=false);
window.addEventListener("mousemove", e => {
  if(drag.down) { cam.x = drag.cx+(e.clientX-drag.sx); cam.y = drag.cy+(e.clientY-drag.sy); }
  const r = canvas.getBoundingClientRect();
  mouse.cx = e.clientX-r.left; mouse.cy = e.clientY-r.top;
});
canvas.addEventListener("wheel", e => { e.preventDefault(); cam.zoom = Math.max(0.3, Math.min(2.5, cam.zoom-e.deltaY*0.001)); }, {passive:false});

document.getElementById("btn-zi").onclick = () => cam.zoom = Math.min(2.5, cam.zoom + 0.15);
document.getElementById("btn-zo").onclick = () => cam.zoom = Math.max(0.3, cam.zoom - 0.15);
document.getElementById("btn-zr").onclick = () => { cam.x=CAM_HOME.x; cam.y=CAM_HOME.y; cam.zoom=CAM_HOME.zoom; };

// ── ISOMETRIC & 3D ENGINE ────────
const TILE_W = 54, TILE_H = 27, FLOOR_DZ = 140;

function iso(gx, gy, floor=0) {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2) - (floor * FLOOR_DZ)
  };
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
  floorLight: "#f4f7f6", floorDark: "#e8edea", floorThick: "#c8d1ce",
  wood1: "#5c4033", wood2: "#4a3328", woodThick: "#2e1e17",
  glass: "rgba(220, 240, 255, 0.25)", glassEdge: "rgba(180, 210, 255, 0.4)",
  deskTop: "#1e293b", deskLegs: "#94a3b8", deskEdge: "#0f172a",
  skin: ["#ffce9e", "#e6b07e", "#996b42", "#664021", "#4a2c13"],
  clothes: ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#14b8a6", "#334155", "#f43f5e"],
  hair: ["#1e1e1e", "#3e2723", "#facc15", "#7f1d1d"]
};

const ROOM_W = 14, ROOM_H = 13;
const DESKS_PER_FLOOR = 10;

function getDeskConfig(idx) {
    const i = idx % DESKS_PER_FLOOR;
    return {
        gx: 2 + (i % 5) * 2,
        gy: 2 + Math.floor(i / 5) * 4,
        floor: Math.floor(idx / DESKS_PER_FLOOR)
    };
}

let time = 0;
let agentsData = [];
let avatarsMap = {}; // State machine per agent
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
    this.floor = desk.floor;
    this.x = desk.gx;
    this.y = desk.gy;
    this.tx = this.x;
    this.ty = this.y;
    this.state = 'working'; // working, walking, resting
    this.timer = Math.random() * 500;
    this.agent = agent;
    // Visuais
    this.skin = C.skin[idx % C.skin.length];
    this.cloth = C.clothes[idx % C.clothes.length];
    this.hair = C.hair[idx % C.hair.length];
  }
  update(agentData) {
    this.agent = agentData;
    const isLoungeArea = (x, y) => (x >= 2 && x <= 11 && y >= 10 && y <= 12);
    
    if (this.state === 'working' || this.state === 'resting') {
      this.timer--;
      // Interrupt to work heavily if recent trade
      if (this.agent.last_decision && this.state !== 'working' && Math.random() < 0.1) {
         this.state = 'walking';
         this.tx = this.deskX; this.ty = this.deskY;
      }
      
      if (this.timer <= 0) {
        if (this.state === 'working') {
           if (Math.random() < 0.25) {
             this.state = 'walking';
             this.tx = 2 + Math.random() * 9;
             this.ty = 10.5 + Math.random() * 1.5;
             this.timer = 500 + Math.random() * 400; 
           } else { this.timer = 200 + Math.random() * 400; }
        } else {
           this.state = 'walking'; // go back
           this.tx = this.deskX; this.ty = this.deskY;
           this.timer = 400 + Math.random() * 600;
        }
      }
    } else if (this.state === 'walking') {
       const dx = this.tx - this.x, dy = this.ty - this.y;
       const dist = Math.hypot(dx, dy);
       if (dist > 0.08) {
           this.x += (dx / dist) * 0.035;
           this.y += (dy / dist) * 0.035;
       } else {
           this.x = this.tx; this.y = this.ty;
           this.state = (this.x === this.deskX && this.y === this.deskY) ? 'working' : 'resting';
       }
    }
  }
}

// ── VOXEL RENDER ENGINE ────────
function drawCuboid(s, dx, dy, w, d, h, top, left, right, thick=1, stroke="#111") {
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

function drawFloorBlock(gx, gy, floor, isLounge) {
    const {x,y} = iso(gx, gy, floor), s = world2screen(x,y);
    const top = isLounge ? ((gx+gy)%2===0?C.wood1:C.wood2) : ((gx+gy)%2===0?C.floorLight:C.floorDark);
    const thick = isLounge ? C.woodThick : C.floorThick;
    drawCuboid(s, 0, 0, 1, 1, 6, top, thick, shadeColor(thick,-20), 0.5, "rgba(0,0,0,0.1)");
}

function drawGlassWall(gx, gy, floor, dir) {
    const {x,y} = iso(gx, gy, floor), s = world2screen(x,y);
    const z = cam.zoom, w = TILE_W/2 * z, h = TILE_H/2 * z, wh = 80 * z;
    ctx.fillStyle = C.glass; ctx.strokeStyle = C.glassEdge; ctx.lineWidth = 1;
    ctx.beginPath();
    if (dir === 'left') {
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x-w, s.y-h);
        ctx.lineTo(s.x-w, s.y-h-wh); ctx.lineTo(s.x, s.y-wh);
    } else { // right
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x+w, s.y-h);
        ctx.lineTo(s.x+w, s.y-h-wh); ctx.lineTo(s.x, s.y-wh);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
}

function drawFancyDesk(gx, gy, floor) {
    const {x,y} = iso(gx, gy, floor), s = world2screen(x,y);
    // Legs
    drawCuboid(s, -12, -4, 0.1, 0.1, 16, C.deskLegs, C.deskLegs, shadeColor(C.deskLegs,-20), 0.5);
    drawCuboid(s, 12, -4, 0.1, 0.1, 16, C.deskLegs, C.deskLegs, shadeColor(C.deskLegs,-20), 0.5);
    // Table
    drawCuboid(s, 0, -6, 0.85, 0.5, 2, C.deskTop, C.deskEdge, C.deskEdge, 1, "#111");
    // Screens (Dual monitors!)
    drawCuboid(s, -4, -8, 0.15, 0.15, 2, "#444", "#333", "#222"); // Base L
    drawCuboid(s, 5, -5, 0.15, 0.15, 2, "#444", "#333", "#222"); // Base R
    drawCuboid(s, -5, -10, 0.35, 0.05, 11, "#222", "#111", shadeColor("#111", -20));
    drawCuboid(s, 6, -7, 0.35, 0.05, 11, "#222", "#111", shadeColor("#111", -20));
}

function drawSmartAvatar(ava) {
    // Coordinate smoothing
    const {x,y} = iso(ava.x - 0.5, ava.y - 0.5, ava.floor);
    // Bobbing when walking
    const isWalk = ava.state === 'walking';
    const bob = isWalk ? Math.abs(Math.sin(time*20+ava.idx)) * 4 * cam.zoom : 0;
    const s = world2screen(x, y - bob/cam.zoom);
    const z = cam.zoom;
    
    // Type bounce
    const isTyping = ava.agent.last_decision && ava.state === 'working';
    const typeB = isTyping ? (Math.sin(time*20+ava.idx)>0? 1.5 : 0) : 0;
    
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath(); ctx.ellipse(s.x, s.y+4*z + (bob), 12*z, 6*z, 0, 0, Math.PI*2); ctx.fill();

    // Body Block
    drawCuboid(s, -6, -4, 0.3, 0.3, 11, ava.cloth, shadeColor(ava.cloth,-15), shadeColor(ava.cloth,-30), 1.2, "#0f172a");
    
    // Arms (swing if walking)
    const swing = isWalk ? Math.sin(time*15+ava.idx)*3 : 0;
    drawCuboid(s, -2, -5 + typeB, 0.12, 0.25, 7, ava.cloth, shadeColor(ava.cloth,-15), shadeColor(ava.cloth,-30), 1, "#0f172a");
    drawCuboid(s, -10, -7 - typeB, 0.12, 0.25, 7, ava.cloth, shadeColor(ava.cloth,-15), shadeColor(ava.cloth,-30), 1, "#0f172a");
    
    // Hands
    drawCuboid(s, -1, -4 + typeB + swing, 0.1, 0.1, 2, ava.skin, shadeColor(ava.skin,-15), shadeColor(ava.skin,-30), 1, "#0f172a");
    drawCuboid(s, -9, -6 - typeB - swing, 0.1, 0.1, 2, ava.skin, shadeColor(ava.skin,-15), shadeColor(ava.skin,-30), 1, "#0f172a");
    
    // Head Square
    drawCuboid(s, -6, -15, 0.4, 0.4, 9, ava.skin, shadeColor(ava.skin,-10), shadeColor(ava.skin,-20), 1.2, "#0f172a");
    
    // Hair
    drawCuboid(s, -6, -24, 0.45, 0.45, 3, ava.hair, shadeColor(ava.hair,-10), shadeColor(ava.hair,-20), 1.2, "#0f172a");
    drawCuboid(s, -11, -21, 0.15, 0.45, 4, ava.hair, shadeColor(ava.hair,-10), shadeColor(ava.hair,-20), 1.2, "#0f172a");

    // Face / Eyes mapping back to front side
    ctx.fillStyle = "#fff";
    const hx = s.x - 5*z, hy = s.y - 20*z;
    ctx.beginPath(); ctx.arc(hx - 2*z, hy, 1.2*z, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx - 7*z, hy - 2*z, 1.2*z, 0, 7); ctx.fill();
    
    const mood = ava.agent.pnl_pct >= 0 ? "#10b981" : "#f43f5e";
    ctx.fillStyle = mood;
    ctx.beginPath(); ctx.arc(hx - 2*z, hy, 0.7*z, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx - 7*z, hy - 2*z, 0.7*z, 0, 7); ctx.fill();
    
    // Status Bubble
    drawDecisionBubble(s, z, ava);
    
    // Hit test tooltip
    if (mouse.cx>s.x-14*z && mouse.cx<s.x+14*z && mouse.cy>s.y-35*z && mouse.cy<s.y) {
      hoveredAgent = ava.agent;
      if (typeof showTooltip === 'function') showTooltip(ava.agent);
    }
}

function drawDecisionBubble(s, z, ava) {
    const dec = ava.agent.last_decision;
    if (!dec || z < 0.6) return;
    const txt = `${dec.side==="BUY"?"▲":"▼"} ${dec.symbol}`;
    const floatY = (Math.sin(time*3+ava.idx)*3) * z;
    ctx.font = `bold ${5*z}px 'JetBrains Mono', monospace`;
    const w = ctx.measureText(txt).width + 10*z, bx = s.x - w/2, by = s.y - 42*z + floatY;
    
    ctx.fillStyle = "rgba(10, 15, 29, 0.9)";
    ctx.strokeStyle = dec.side==="BUY" ? "#10b981" : "#f43f5e";
    ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.roundRect(bx, by, w, 10*z, 3*z); ctx.fill(); ctx.stroke();
    
    // Pointer
    ctx.beginPath(); ctx.moveTo(s.x-2*z, by+10*z); ctx.lineTo(s.x+2*z, by+10*z); ctx.lineTo(s.x, by+14*z); ctx.fill();
    
    ctx.fillStyle = ctx.strokeStyle;
    ctx.textAlign = "center"; ctx.fillText(txt, s.x, by + 7.5*z); ctx.textAlign = "left";
}

function drawSofa(gx, gy, floor, col) {
    const {x,y} = iso(gx, gy, floor), s = world2screen(x,y);
    drawCuboid(s, 0, 0, 0.6, 1.4, 4, col, shadeColor(col,-15), shadeColor(col,-30), 1, "#111");
    // Backrest
    drawCuboid(s, -6, 4, 0.3, 1.4, 10, shadeColor(col,-5), shadeColor(col,-20), shadeColor(col,-35), 1, "#111");
}

function drawPlant(gx, gy, floor) {
    const {x,y} = iso(gx, gy, floor), s = world2screen(x,y);
    drawCuboid(s, 0, 0, 0.5, 0.5, 6, "#e2e8f0", "#cbd5e1", "#94a3b8"); // vase
    drawCuboid(s, 0, -6, 0.6, 0.6, 6, "#10b981", "#059669", "#047857", 1, "#022c22"); // leaves
}

// ── MEGA RENDERING LOOP ────────
function renderOffice() {
    hoveredAgent = null;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    
    // Rich gradient background (Night City tint)
    const bgGrad = ctx.createLinearGradient(0,0, 0, canvas.height);
    bgGrad.addColorStop(0, "#080c10"); bgGrad.addColorStop(1, "#131a28");
    ctx.fillStyle = bgGrad; ctx.fillRect(0,0,canvas.width, canvas.height);
    
    // Manage Avatars lifecycle
    agentsData.forEach((ag, i) => {
        if (!avatarsMap[ag.id]) avatarsMap[ag.id] = new AgentAvatar(ag, i);
        avatarsMap[ag.id].update(ag);
    });
    
    const floorsConfigured = Math.max(1, Math.ceil(agentsData.length / DESKS_PER_FLOOR));
    const drawQueue = [];
    
    for (let f = 0; f < floorsConfigured; f++) {
        const floorBaseZ = f * 10000;
        
        // Draw Glass Back Walls (Left e Right)
        for (let gx = 0; gx < ROOM_W; gx++) {
            drawQueue.push({ type: 'glass', side: 'right', gx, gy: 0, floor: f, z: Math.round((gx+0)*10) + floorBaseZ - 50 });
        }
        for (let gy = 0; gy < ROOM_H; gy++) {
            drawQueue.push({ type: 'glass', side: 'left', gx: 0, gy, floor: f, z: Math.round((0+gy)*10) + floorBaseZ - 50 });
        }
    
        for (let gx = 0; gx < ROOM_W; gx++) {
            for (let gy = 0; gy < ROOM_H; gy++) {
                const isLounge = (gx >= 2 && gx <= 11 && gy >= 10 && gy <= 12);
                if (gx > 0 && gx < ROOM_W && gy > 0 && gy < ROOM_H) {
                  drawQueue.push({ type: 'tile', gx, gy, floor: f, isLounge, z: Math.round((gx+gy)*10) + floorBaseZ });
                }
            }
        }
        
        // Desks
        for (let i = 0; i < DESKS_PER_FLOOR; i++) {
           const idx = f * DESKS_PER_FLOOR + i;
           if (idx < agentsData.length) {
               const dc = getDeskConfig(idx);
               drawQueue.push({ type: 'desk', gx: dc.gx, gy: dc.gy, floor: f, z: Math.round((dc.gx+dc.gy)*10) + floorBaseZ + 5 });
           }
        }
        
        // Lounge Furniture
        drawQueue.push({ type: 'sofa', gx: 4, gy: 11, col: "#334155", floor: f, z: Math.round((4+11)*10) + floorBaseZ + 6 });
        drawQueue.push({ type: 'sofa', gx: 9, gy: 11, col: "#6366f1", floor: f, z: Math.round((9+11)*10) + floorBaseZ + 6 });
        drawQueue.push({ type: 'plant', gx: 2, gy: 10, floor: f, z: Math.round((2+10)*10) + floorBaseZ + 6 });
        drawQueue.push({ type: 'plant', gx: 11, gy: 10, floor: f, z: Math.round((11+10)*10) + floorBaseZ + 6 });
        // Glass railing front
        for (let gx=1; gx<ROOM_W; gx++) {
            drawQueue.push({ type: 'glass', side: 'right', gx, gy: ROOM_H-1, floor: f, z: Math.round((gx+ROOM_H-1)*10) + floorBaseZ + 100 });
        }
    }
    
    // Add Avatar objects
    Object.values(avatarsMap).forEach(ava => {
        drawQueue.push({ type: 'avatar', ava, z: Math.round((ava.x + ava.y)*10) + ava.floor * 10000 + 15 });
    });
    
    drawQueue.sort((a,b) => a.z - b.z);
    
    for (const item of drawQueue) {
        if (item.type === 'tile') drawFloorBlock(item.gx, item.gy, item.floor, item.isLounge);
        else if (item.type === 'glass') drawGlassWall(item.gx, item.gy, item.floor, item.side);
        else if (item.type === 'desk') drawFancyDesk(item.gx, item.gy, item.floor);
        else if (item.type === 'sofa') drawSofa(item.gx, item.gy, item.floor, item.col);
        else if (item.type === 'plant') drawPlant(item.gx, item.gy, item.floor);
        else if (item.type === 'avatar') drawSmartAvatar(item.ava);
    }
    
    time += 0.02;
    if (!hoveredAgent && typeof tooltip !== 'undefined') tooltip.classList.remove("show");
}

"""

combined = NEW_CANVAS_ENGINE + "\n" + ui_code

with open("static/office.js", "w", encoding="utf-8") as f:
    f.write(combined)
    
print("Patch V3 OK")

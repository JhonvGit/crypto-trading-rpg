import re

with open("static/office.js", "r", encoding="utf-8") as f:
    content = f.read()

# Locate // ── PROJEÇÃO ISO 
start_str = "// ── PROJEÇÃO ISO ──────────────────────────────────────────"
end_str = "function strategyLabel(agent)"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + """
// ── ESTILO HABBO / RETRO VOXEL ─────────────────────────────
const TILE_W = 60, TILE_H = 30, WALL_H = 100;
ctx.imageSmoothingEnabled = false;

function iso(gx, gy) { return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) }; }
function world2screen(wx, wy) {
  return { x: Math.round(canvas.width / 2 + cam.x + wx * cam.zoom), y: Math.round(canvas.height / 2 + cam.y + wy * cam.zoom) };
}

const C = {
  floor1: "#6d9bab", floor2: "#7caebd", floorBlock: "#406877",
  floorWood1: "#c08a54", floorWood2: "#a87747",
  wall: "#dfe3e0", wallShade: "#c0c4c1", wallDark: "#949996",
  desk: "#935c38", deskEdge: "#5c3319",
  clothes: ["#2d7bd1","#d13a2d","#e6a722","#2ca344","#712da6","#2d2d2d","#e0e0e0"],
  skin: ["#ffce9e", "#e6b07e", "#996b42", "#664021"],
  hair: ["#1a1a1a","#4a2f1a","#d4af37","#8a2626"]
};

const ROOM_W = 16, ROOM_H = 12;
const DESKS = [
  {gx:2, gy:2}, {gx:4, gy:2}, {gx:6, gy:2}, {gx:8, gy:2},
  {gx:2, gy:5}, {gx:4, gy:5}, {gx:6, gy:5}, {gx:8, gy:5},
  {gx:2, gy:8}, {gx:4, gy:8}, {gx:6, gy:8}, {gx:8, gy:8},
  {gx:12, gy:5}, {gx:12, gy:8},
];

let agentsData = [];
let activityLog = new Set();
let elimCount = 0;
let hoveredAgent = null;
let time = 0;

function drawCuboid(s, dx, dy, w, d, h, top, left, right, outline = "#000") {
  const z = cam.zoom;
  const xw = (w * TILE_W/2) * z, yw = (d * TILE_W/2) * z;
  const xh = (w * TILE_H/2) * z, yh = (d * TILE_H/2) * z;
  const hh = h * z;
  const bx = s.x + dx*z, by = s.y + dy*z;

  ctx.lineWidth = 1.5; ctx.strokeStyle = outline; ctx.lineJoin = "round";

  ctx.fillStyle = left; ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(bx - xw, by - xh);
  ctx.lineTo(bx - xw, by - xh - hh); ctx.lineTo(bx, by - hh);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.fillStyle = right; ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(bx + yw, by - yh);
  ctx.lineTo(bx + yw, by - yh - hh); ctx.lineTo(bx, by - hh);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  
  ctx.fillStyle = top; ctx.beginPath();
  ctx.moveTo(bx, by - hh); ctx.lineTo(bx - xw, by - xh - hh);
  ctx.lineTo(bx - xw + yw, by - xh - yh - hh); ctx.lineTo(bx + yw, by - yh - hh);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

function drawTileBlock(gx, gy, fillTop, fillSide) {
  const {x,y} = iso(gx, gy), s = world2screen(x,y);
  drawCuboid(s, 0, 0, 1, 1, 8, fillTop, fillSide, shadeColor(fillSide,-30));
}

function drawWallBack(gx, gy) {
  const {x,y} = iso(gx, gy), s = world2screen(x,y);
  const z = cam.zoom, w = TILE_W/2 * z, h = TILE_H/2 * z, wh = WALL_H * z;
  ctx.fillStyle = C.wall; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(s.x-w, s.y); ctx.lineTo(s.x, s.y-h);
  ctx.lineTo(s.x, s.y-h-wh); ctx.lineTo(s.x-w, s.y-wh);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.wallDark; ctx.beginPath(); ctx.moveTo(s.x-w, s.y); ctx.lineTo(s.x, s.y-h);
  ctx.lineTo(s.x, s.y-h-8*z); ctx.lineTo(s.x-w, s.y-8*z);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

function drawWallLeft(gx, gy) {
  const {x,y} = iso(gx, gy), s = world2screen(x,y);
  const z = cam.zoom, w = TILE_W/2 * z, h = TILE_H/2 * z, wh = WALL_H * z;
  ctx.fillStyle = C.wallShade; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(s.x, s.y+h); ctx.lineTo(s.x-w, s.y);
  ctx.lineTo(s.x-w, s.y-wh); ctx.lineTo(s.x, s.y+h-wh);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = shadeColor(C.wallDark, -20); ctx.beginPath(); ctx.moveTo(s.x, s.y+h); ctx.lineTo(s.x-w, s.y);
  ctx.lineTo(s.x-w, s.y-8*z); ctx.lineTo(s.x, s.y+h-8*z);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

function drawDesk(gx, gy, idx) {
  const {x,y} = iso(gx, gy), s = world2screen(x,y);
  const z = cam.zoom;
  const leg = C.deskEdge;
  drawCuboid(s, -12, -4, 0.15, 0.15, 18, leg, leg, leg);
  drawCuboid(s, 12, -4, 0.15, 0.15, 18, leg, leg, leg);
  drawCuboid(s, -2, -10, 0.15, 0.15, 18, leg, leg, leg);
  drawCuboid(s, 0, -6, 0.8, 0.6, 3, C.desk, C.deskEdge, C.deskEdge);
  
  const monC = "#e6e6db", monFace = "#2d2d2a";
  drawCuboid(s, -2, -8, 0.2, 0.2, 2, "#999", "#888", "#777");
  drawCuboid(s, -2, -10, 0.4, 0.35, 12, monC, monFace, shadeColor(monC,-20));
  
  const agent = agentsData[idx];
  if(agent) {
    const glCol = agent.pnl_pct >= 0 ? "#10B981" : "#F43F5E";
    ctx.fillStyle = (Math.sin(time*2+idx)>0) ? glCol : shadeColor(glCol,-50);
    ctx.beginPath();
    const wx = (0.4 * TILE_W/2) * z, hy = (0.4 * TILE_H/2) * z, by = s.y - 12*z;
    ctx.moveTo(s.x-2*z-2, by); ctx.lineTo(s.x-2*z - wx + 2, by - hy);
    ctx.lineTo(s.x-2*z - wx + 2, by - hy - 9*z); ctx.lineTo(s.x-2*z-2, by - 9*z);
    ctx.closePath(); ctx.fill();
    drawCuboid(s, 10, -6, 0.3, 0.15, 1, "#ddd", "#ccc", "#aaa");
  }
}

function drawHumanoid(gx, gy, agent, idx) {
  const bob = (Math.sin(time * 3 + idx) > 0) ? -1 : 0;
  const isTyping = agent.last_decision != null;
  const typeBob = isTyping ? (Math.sin(time*15+idx)>0? 1.5 : 0) : 0;
  
  let {x,y} = iso(gx - 0.4, gy - 0.4);
  const s = world2screen(x, y + bob);
  const z = cam.zoom;
  
  const skin = C.skin[idx % C.skin.length], cloth = C.clothes[idx % C.clothes.length], hair = C.hair[idx % C.hair.length];
  
  drawCuboid(s, -6, -2, 0.3, 0.3, 10, "#333", "#222", "#111"); 
  drawCuboid(s, -6, -3, 0.4, 0.4, 2, cloth, shadeColor(cloth,-20), shadeColor(cloth,-40)); 
  drawCuboid(s, -6, -6, 0.35, 0.35, 11, cloth, shadeColor(cloth,-10), shadeColor(cloth,-20));
  
  drawCuboid(s, -1, -6 + typeBob, 0.15, 0.3, 8, cloth, shadeColor(cloth,-10), shadeColor(cloth,-20));
  drawCuboid(s, -11, -8 - typeBob, 0.15, 0.3, 8, cloth, shadeColor(cloth,-10), shadeColor(cloth,-20));
  drawCuboid(s, 0, -5 + typeBob, 0.12, 0.15, 2, skin, skin, shadeColor(skin,-20));
  drawCuboid(s, -10, -7 - typeBob, 0.12, 0.15, 2, skin, skin, shadeColor(skin,-20));

  drawCuboid(s, -6, -18, 0.45, 0.45, 9, skin, shadeColor(skin,-5), shadeColor(skin,-15));
  drawCuboid(s, -6, -27, 0.5, 0.5, 3, hair, shadeColor(hair,-10), shadeColor(hair,-20));
  drawCuboid(s, -11, -24, 0.15, 0.5, 4, hair, shadeColor(hair,-10), shadeColor(hair,-20));
  
  ctx.fillStyle = "#fff";
  const hx = s.x - 6*z, hy = s.y - 23*z;
  ctx.beginPath(); ctx.arc(hx - 2*z, hy, 1.5*z, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(hx - 8*z, hy - 3*z, 1.5*z, 0, 7); ctx.fill();
  
  const mood = agent.pnl_pct >= 0 ? "#10B981" : "#F43F5E";
  ctx.fillStyle = mood;
  ctx.beginPath(); ctx.arc(hx - 2*z, hy, 0.8*z, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(hx - 8*z, hy - 3*z, 0.8*z, 0, 7); ctx.fill();
  
  ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.beginPath();
  if (agent.pnl_pct >= 5) { ctx.moveTo(hx - 3*z, hy + 3*z); ctx.lineTo(hx - 7*z, hy + 1*z); }
  else if (agent.pnl_pct <= -5) { ctx.moveTo(hx - 3*z, hy + 2*z); ctx.lineTo(hx - 7*z, hy + 4*z); }
  else { ctx.moveTo(hx - 3*z, hy + 3*z); }
  ctx.stroke();

  drawDecisionBubble(s, z, agent, idx);
  
  // Hit test para o tooltip adaptado para Habbo (área mais retangular em cima do boneco)
  if (mouse.cx>s.x-15*z && mouse.cx<s.x+15*z && mouse.cy>s.y-35*z && mouse.cy<s.y) {
    hoveredAgent = agent;
    showTooltip(agent);
  }
}

function drawDecisionBubble(s, z, agent, idx) {
  if (z < 0.6) return;
  const dec = agent.last_decision;
  if (!dec) return;
  let txt = `${dec.side==="BUY"?"▲":"▼"} ${dec.symbol}`;
  const floatY = (Math.sin(time*2+idx)*4) * z;
  ctx.font = `bold ${5*z}px 'JetBrains Mono', monospace`;
  const w = ctx.measureText(txt).width + 12*z;
  const bx = s.x - w/2, by = s.y - 45*z + floatY;
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.beginPath();
  ctx.rect(bx, by, w, 10*z); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s.x-2*z, by+10*z); ctx.lineTo(s.x+2*z, by+10*z); ctx.lineTo(s.x, by+14*z);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = dec.side==="BUY" ? "#10B981" : "#F43F5E";
  ctx.textAlign = "center"; ctx.fillText(txt, s.x, by + 7*z); ctx.textAlign = "left";
}

function drawDecor() {
  const z = cam.zoom, {x, y} = iso(5, 0), s = world2screen(x,y);
  drawCuboid(s, 0, -40, 4, 0.4, 25, "#222", "#111", "#080808");
  ctx.fillStyle = "#0c1813"; ctx.beginPath();
  const wx = (3.8 * TILE_W/2) * z, hy = (3.8 * TILE_H/2) * z, by = s.y - 42*z;
  ctx.moveTo(s.x-2*z, by); ctx.lineTo(s.x-2*z - wx, by - hy);
  ctx.lineTo(s.x-2*z - wx, by - hy - 21*z); ctx.lineTo(s.x-2*z, by - 21*z); ctx.fill();
  ctx.fillStyle = "#10B981"; ctx.font = `bold ${6*z}px 'JetBrains Mono', monospace`;
  ctx.fillText("CRYPTO TRADING RPG", s.x - wx + 10*z, by - hy - 8*z);
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

"""
    new_content += content[end_idx:]
    
    # We must also replace renderOffice at the end. It's safe to do this via regex.
    render_office_regex = re.compile(r"function renderOffice.*?if \(!hoveredAgent.*?\}", re.DOTALL)
    
    better_render = """function renderOffice() {
  hoveredAgent = null;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  
  ctx.fillStyle = "#1a1e24";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  
  for(let gx=0; gx<ROOM_W; gx++) drawWallBack(gx,0);
  for(let gy=0; gy<ROOM_H; gy++) drawWallLeft(0,gy);
  
  for(let gy=0; gy<ROOM_H; gy++) {
    for(let gx=0; gx<ROOM_W; gx++) {
      const isLounge = (gx>=11 && gx<=14 && gy>=4 && gy<=9);
      let fillTop = (gx+gy)%2 === 0 ? C.floor1 : C.floor2;
      if (isLounge) fillTop = (gx+gy)%2===0 ? C.floorWood1 : C.floorWood2;
      drawTileBlock(gx, gy, fillTop, C.floorBlock);
    }
  }
  
  drawDecor();
  
  const sorted = [...DESKS].map((d,i)=>({...d,i})).sort((a,b)=>(a.gx+a.gy)-(b.gx+b.gy));
  sorted.forEach(({gx, gy, i})=>{
    drawDesk(gx, gy, i);
    if(agentsData[i]) drawHumanoid(gx, gy, agentsData[i], i);
  });
  
  time += 0.02;
  if (!hoveredAgent && typeof tooltip !== 'undefined') tooltip.classList.remove("show");
}"""
    final_content = render_office_regex.sub(better_render, new_content)

    with open("static/office.js", "w", encoding="utf-8") as f:
        f.write(final_content)
    print("Patch V2 OK")
else:
    print("Tags não encontradas!")

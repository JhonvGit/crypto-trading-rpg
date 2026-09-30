import { Application, Container, Graphics } from 'https://cdn.jsdelivr.net/npm/pixi.js@8.14.0/dist/pixi.mjs';

const host = document.querySelector('#office-wrap');
if (host) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pixi-luxury-canvas';
  canvas.setAttribute('aria-label', 'Cenário isométrico premium');
  host.insertBefore(canvas, host.firstChild);
  const app = new Application();
  await app.init({ canvas, resizeTo: host, background: 0x080d16, antialias: true, autoDensity: true, resolution: Math.min(devicePixelRatio || 1, 2) });
  const world = new Container();
  const g = new Graphics();
  world.addChild(g); app.stage.addChild(world);
  const W = 72, H = 36;
  const iso = (x, y) => ({ x: host.clientWidth / 2 + (x-y)*W/2, y: 110 + (x+y)*H/2 });
  const diamond = (p, color) => { g.poly([p.x,p.y-H/2,p.x+W/2,p.y,p.x,p.y+H/2,p.x-W/2,p.y]); g.fill(color); };
  const cuboid = (p, color, height=70) => { g.rect(p.x-5,p.y-height,10,height); g.fill(color); };
  const draw = () => {
    g.clear();
    const cols=16, rows=12;
    for(let x=0;x<cols;x++) for(let y=0;y<rows;y++) diamond(iso(x,y), (x+y)%2 ? 0x1b2738 : 0x202f43);
    for(let x=0;x<cols;x++) { const p=iso(x,0); cuboid(p,0x34445a,116); if(x%4===1){g.rect(p.x-19,p.y-96,38,32);g.fill({color:0x8ed8e8,alpha:.34});g.stroke({color:0xc7a664,width:2});} }
    for(let y=0;y<rows;y++) cuboid(iso(0,y),0x1c2636,116);
    [4,11].forEach(x=>cuboid(iso(x,0),0xd6b878,88));
    for(let i=0;i<12;i++){const p=iso(2+(i%6)*2,2+Math.floor(i/6)*3);g.roundRect(p.x-25,p.y-15,50,11,3);g.fill(0xf1f5f9);g.rect(p.x-18,p.y-4,4,16);g.rect(p.x+14,p.y-4,4,16);g.fill(0x596579);g.roundRect(p.x-9,p.y-30,18,15,2);g.fill(0x0b1220);g.circle(p.x+7,p.y-24,2);g.fill(i%2?0x60a5fa:0x34d399);}
    world.y=Math.max(0,(host.clientHeight-620)/2);
  };
  draw(); window.addEventListener('resize',draw,{passive:true});
}

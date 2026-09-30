import { Application, Container, Graphics } from 'pixi.js';

export type LuxurySceneOptions = {
  element: HTMLElement;
  columns?: number;
  rows?: number;
};

const TILE_W = 72;
const TILE_H = 36;
const COLORS = {
  floorA: 0x1b2738,
  floorB: 0x202f43,
  stone: 0x34445a,
  stoneDark: 0x1a2636,
  brass: 0xc7a664,
  glass: 0x8ed8e8,
  wood: 0x7a5d42,
  green: 0x34d399,
};

const iso = (x: number, y: number, originX: number, originY: number) => ({
  x: originX + (x - y) * TILE_W / 2,
  y: originY + (x + y) * TILE_H / 2,
});

function diamond(g: Graphics, x: number, y: number, fill: number, alpha = 1): void {
  g.poly([x, y - TILE_H / 2, x + TILE_W / 2, y, x, y + TILE_H / 2, x - TILE_W / 2, y]);
  g.fill({ color: fill, alpha });
}

function pillar(g: Graphics, x: number, y: number, height = 76): void {
  g.rect(x - 5, y - height, 10, height);
  g.fill(COLORS.brass);
  g.rect(x - 5, y - height, 4, height);
  g.fill(0xead49b);
}

function desk(g: Graphics, x: number, y: number): void {
  g.roundRect(x - 25, y - 15, 50, 11, 3);
  g.fill({ color: 0xf1f5f9, alpha: 0.95 });
  g.rect(x - 19, y - 4, 4, 16); g.rect(x + 15, y - 4, 4, 16);
  g.fill(COLORS.stone);
  g.roundRect(x - 9, y - 30, 18, 15, 2); g.fill(0x0b1220);
  g.circle(x + 7, y - 24, 2); g.fill(COLORS.green);
}

export async function createLuxuryScene(options: LuxurySceneOptions): Promise<Application> {
  const app = new Application();
  await app.init({
    resizeTo: options.element,
    background: 0x080d16,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  options.element.replaceChildren(app.canvas);
  app.canvas.className = 'pixi-luxury-canvas';

  const world = new Container();
  const graphics = new Graphics();
  world.addChild(graphics);
  app.stage.addChild(world);

  const draw = () => {
    graphics.clear();
    const width = options.element.clientWidth;
    const height = options.element.clientHeight;
    const cols = options.columns ?? 16;
    const rows = options.rows ?? 12;
    const originX = width / 2;
    const originY = Math.max(120, height * 0.22);

    for (let x = 0; x < cols; x += 1) {
      for (let y = 0; y < rows; y += 1) {
        const p = iso(x, y, originX, originY);
        diamond(graphics, p.x, p.y, (x + y) % 2 ? COLORS.floorA : COLORS.floorB);
      }
    }
    for (let x = 0; x < cols; x += 1) {
      const p = iso(x, 0, originX, originY);
      graphics.rect(p.x - 1, p.y - 116, 3, 116); graphics.fill(COLORS.stone);
      if (x % 4 === 1) { graphics.rect(p.x - 18, p.y - 96, 36, 32); graphics.fill({ color: COLORS.glass, alpha: 0.42 }); graphics.stroke({ color: COLORS.brass, width: 2 }); }
    }
    for (let y = 0; y < rows; y += 1) {
      const p = iso(0, y, originX, originY);
      graphics.rect(p.x - 1, p.y - 116, 3, 116); graphics.fill(COLORS.stoneDark);
    }
    [4, 11].forEach((x) => pillar(graphics, iso(x, 0, originX, originY).x, iso(x, 0, originX, originY).y));
    for (let i = 0; i < Math.min(12, cols - 2); i += 1) {
      const p = iso(2 + (i % 6) * 2, 2 + Math.floor(i / 6) * 3, originX, originY);
      desk(graphics, p.x, p.y);
    }
    world.position.set(0, Math.max(0, (height - 620) / 2));
  };

  draw();
  window.addEventListener('resize', draw, { passive: true });
  return app;
}

import { BUILDING_DEFS, MAP_SIZE, NODE_DEFS } from '../sim/content';
import { idx } from '../sim/map';
import type { Building, GameEvent, ResourceNode, Unit, World } from '../sim/types';
import type { Camera } from './iso';
import { clampCamera, screenToWorld, worldToScreen } from './iso';
import { drawBuilding, drawGhost, drawNode, drawProjectile, drawUnit } from './art';
import { FogRenderer, TerrainRenderer, terrainMiniColor } from './terrain';
import { ParticleSystem } from './particles';

export interface RendererState {
  selected: Set<number>;
  hoverTile: { x: number; y: number } | null;
  buildGhost: { type: Building['type']; x: number; y: number; valid: boolean } | null;
  selectionBox: { x1: number; y1: number; x2: number; y2: number } | null;
  attackMoveMode: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

type Drawable = { depth: number; draw: () => void };

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly minimap: HTMLCanvasElement;
  readonly minimapCtx: CanvasRenderingContext2D;
  readonly camera: Camera = { x: 0, y: 0, zoom: 1 };
  readonly particles = new ParticleSystem();
  readonly state: RendererState = {
    selected: new Set(),
    hoverTile: null,
    buildGhost: null,
    selectionBox: null,
    attackMoveMode: false,
    reducedMotion: false,
    highContrast: false,
  };
  private terrain: TerrainRenderer | null = null;
  private fog = new FogRenderer();
  private world: World | null = null;
  private dpr = 1;
  private lastMinimap = 0;
  private shake = 0;
  private smokeTimer = 0;
  width = 1280;
  height = 720;
  fps = 60;

  constructor(canvas: HTMLCanvasElement, minimap: HTMLCanvasElement) {
    this.canvas = canvas;
    this.minimap = minimap;
    this.ctx = canvas.getContext('2d')!;
    this.minimapCtx = minimap.getContext('2d')!;
    this.resize();
  }

  attach(world: World): void {
    this.world = world;
    this.terrain = new TerrainRenderer(world.map, world.seed);
    this.fog = new FogRenderer();
    this.particles.clear();
    this.state.selected.clear();
    this.state.hoverTile = null;
    this.state.buildGhost = null;
    this.state.selectionBox = null;
    const base = world.map.startTiles[0];
    this.focus(base.x + 1.5, base.y + 1.5);
    this.camera.zoom = 0.95;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(320, rect.width);
    this.height = Math.max(240, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.minimap.width = 192;
    this.minimap.height = 192;
    this.clamp();
  }

  private clamp(): void {
    const margin = 180;
    const minX = -(MAP_SIZE - 1) * 32 - margin;
    const maxX = (MAP_SIZE - 1) * 32 + margin;
    const minY = -margin;
    const maxY = (MAP_SIZE - 1) * 32 + margin;
    this.camera.x = Math.max(minX, Math.min(maxX, this.camera.x));
    this.camera.y = Math.max(minY, Math.min(maxY, this.camera.y));
  }

  focus(tileX: number, tileY: number): void {
    this.camera.x = (tileX - tileY) * 32;
    this.camera.y = (tileX + tileY) * 16;
    this.clamp();
  }

  pan(dx: number, dy: number): void {
    this.camera.x += dx / this.camera.zoom;
    this.camera.y += dy / this.camera.zoom;
    this.clamp();
  }

  zoomAt(clientX: number, clientY: number, factor: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const before = screenToWorld(this.camera, px, py, this.width, this.height);
    this.camera.zoom = Math.max(0.55, Math.min(1.6, this.camera.zoom * factor));
    const after = screenToWorld(this.camera, px, py, this.width, this.height);
    this.camera.x += (before.x - after.x) * 32;
    this.camera.y += (before.y - after.y) * 16;
    this.clamp();
  }

  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return screenToWorld(this.camera, clientX - rect.left, clientY - rect.top, rect.width, rect.height);
  }

  screenToTile(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return screenToWorld(this.camera, clientX - rect.left, clientY - rect.top, this.width, this.height);
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return worldToScreen(this.camera, x, y, this.width, this.height);
  }

  minimapToTile(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.minimap.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return { x: px * MAP_SIZE, y: py * MAP_SIZE };
  }

  handleEvents(events: GameEvent[]): void {
    this.particles.handleEvents(events, 0);
    for (const event of events) {
      if (event.type === 'underAttack' && event.kingdom === 0) this.shake = Math.max(this.shake, 4);
      if (event.type === 'death' && event.building === 'townCenter') this.shake = 8;
    }
  }

  render(world: World, alpha: number, time: number, dt: number): void {
    if (this.world !== world || !this.terrain) this.attach(world);
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const bg = ctx.createLinearGradient(0, 0, 0, this.height);
    bg.addColorStop(0, this.state.highContrast ? '#050806' : '#111711');
    bg.addColorStop(1, this.state.highContrast ? '#030504' : '#0a0e0a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.width, this.height);

    this.fog.rebuild(world.map, world.visible[0]!, world.explored[0]!);
    world.fogDirty = false;

    const shakeX = this.state.reducedMotion ? 0 : (Math.random() - 0.5) * this.shake;
    const shakeY = this.state.reducedMotion ? 0 : (Math.random() - 0.5) * this.shake;
    this.shake *= 0.86;

    ctx.save();
    ctx.translate(this.width / 2 + shakeX, this.height / 2 + shakeY);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    this.terrain!.draw(ctx, this.camera);
    this.terrain!.drawWater(ctx, this.camera, time);

    const drawables: Drawable[] = [];
    const view = this.viewBounds();
    for (const node of world.nodes) {
      if (!node.alive) continue;
      if (!this.inView(node.x, node.y, view, 3)) continue;
      if (world.explored[0]![idx(node.tileX, node.tileY)] !== 1) continue;
      const selected = this.state.selected.has(node.id);
      drawables.push({
        depth: node.x + node.y,
        draw: () => drawNode(ctx, node, time, selected),
      });
    }
    for (const building of world.buildings) {
      if (!building.alive) continue;
      if (!this.inView(building.x, building.y, view, 5)) continue;
      if (building.kingdom !== 0 && !this.anyTileVisible(world, building)) continue;
      const selected = this.state.selected.has(building.id);
      drawables.push({
        depth: building.x + building.y + (building.width + building.height) * 0.25,
        draw: () => drawBuilding(ctx, building, time, selected),
      });
    }
    for (const unit of world.units) {
      if (!unit.alive) continue;
      const ix = unit.prevX + (unit.x - unit.prevX) * alpha;
      const iy = unit.prevY + (unit.y - unit.prevY) * alpha;
      if (!this.inView(ix, iy, view, 2)) continue;
      if (unit.kingdom !== 0 && world.visible[0]![idx(Math.floor(unit.x), Math.floor(unit.y))] !== 1) continue;
      const selected = this.state.selected.has(unit.id);
      drawables.push({
        depth: ix + iy,
        draw: () => drawUnit(ctx, unit, ix, iy, time, selected),
      });
    }
    for (const projectile of world.projectiles) {
      if (!projectile.alive) continue;
      if (!this.inView(projectile.x, projectile.y, view, 2)) continue;
      if (projectile.kingdom !== 0 && world.visible[0]![idx(Math.floor(projectile.x), Math.floor(projectile.y))] !== 1) continue;
      drawables.push({
        depth: projectile.x + projectile.y + 0.2,
        draw: () => drawProjectile(ctx, projectile),
      });
    }
    drawables.sort((a, b) => a.depth - b.depth);
    for (const drawable of drawables) drawable.draw();

    // Fog sits over the world, then selection and feedback stay crisp.
    this.fog.draw(ctx, this.camera);

    if (this.state.buildGhost) {
      const ghost = this.state.buildGhost;
      const def = BUILDING_DEFS[ghost.type];
      const iso = { x: (ghost.x - ghost.y) * 32, y: (ghost.x + ghost.y) * 16 };
      drawGhost(ctx, iso.x, iso.y, def.width, def.height, ghost.valid);
    }

    if (this.state.hoverTile) {
      const t = this.state.hoverTile;
      const n = { x: (t.x - t.y) * 32, y: (t.x + t.y) * 16 };
      ctx.strokeStyle = 'rgba(243, 219, 143, 0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(n.x, n.y - 16);
      ctx.lineTo(n.x + 32, n.y);
      ctx.lineTo(n.x, n.y + 16);
      ctx.lineTo(n.x - 32, n.y);
      ctx.closePath();
      ctx.stroke();
    }

    this.particles.draw(ctx);
    ctx.restore();

    // Screen-space selection box.
    if (this.state.selectionBox) {
      const box = this.state.selectionBox;
      ctx.strokeStyle = 'rgba(243, 219, 143, 0.9)';
      ctx.fillStyle = 'rgba(243, 219, 143, 0.08)';
      ctx.lineWidth = 1;
      const x = Math.min(box.x1, box.x2);
      const y = Math.min(box.y1, box.y2);
      const w = Math.abs(box.x2 - box.x1);
      const h = Math.abs(box.y2 - box.y1);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }

    // Soft vignette and top haze.
    const vignette = ctx.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.35, this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, this.state.highContrast ? 'rgba(0,0,0,0.55)' : 'rgba(2,5,3,0.44)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.width, this.height);

    this.updateAmbient(world, dt);
    this.particles.update(dt);

    if (time - this.lastMinimap > 0.18) {
      this.lastMinimap = time;
      this.drawMinimap(world);
    }
  }

  private updateAmbient(world: World, dt: number): void {
    this.smokeTimer += dt;
    if (this.smokeTimer < 0.22) return;
    this.smokeTimer = 0;
    const view = this.viewBounds();
    this.particles.ambient(this.camera.x / 32, this.camera.y / 16, 30, dt, performance.now() / 1000);
    for (const b of world.buildings) {
      if (!b.alive || !b.complete) continue;
      if (b.type !== 'house' && b.type !== 'blacksmith' && b.type !== 'townCenter') continue;
      if (!this.inView(b.x, b.y, view, 10)) continue;
      if (world.visible[0]![idx(Math.floor(b.x), Math.floor(b.y))] !== 1) continue;
      if (Math.random() < 0.6) this.particles.smoke(b.x + 0.3, b.y - 1.2);
    }
  }

  private viewBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    const corners = [
      screenToWorld(this.camera, 0, 0, this.width, this.height),
      screenToWorld(this.camera, this.width, 0, this.width, this.height),
      screenToWorld(this.camera, 0, this.height, this.width, this.height),
      screenToWorld(this.camera, this.width, this.height, this.width, this.height),
    ];
    return {
      minX: Math.min(...corners.map((c) => c.x)) - 2,
      maxX: Math.max(...corners.map((c) => c.x)) + 2,
      minY: Math.min(...corners.map((c) => c.y)) - 2,
      maxY: Math.max(...corners.map((c) => c.y)) + 2,
    };
  }

  private inView(x: number, y: number, view: { minX: number; maxX: number; minY: number; maxY: number }, margin: number): boolean {
    return x > view.minX - margin && x < view.maxX + margin && y > view.minY - margin && y < view.maxY + margin;
  }

  private anyTileVisible(world: World, building: Building): boolean {
    for (let y = building.tileY; y < building.tileY + building.height; y += 1) {
      for (let x = building.tileX; x < building.tileX + building.width; x += 1) {
        if (world.visible[0]![idx(x, y)] === 1) return true;
      }
    }
    return false;
  }

  drawMinimap(world: World): void {
    const ctx = this.minimapCtx;
    const w = this.minimap.width;
    const h = this.minimap.height;
    const tile = w / MAP_SIZE;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#060a07';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < MAP_SIZE; y += 1) {
      for (let x = 0; x < MAP_SIZE; x += 1) {
        const i = idx(x, y);
        const explored = world.explored[0]![i] === 1;
        const visible = world.visible[0]![i] === 1;
        ctx.fillStyle = explored ? terrainMiniColor(world.map.terrain[i]!, x, y) : '#050806';
        ctx.fillRect(x * tile, y * tile, Math.ceil(tile), Math.ceil(tile));
        if (explored && !visible) {
          ctx.fillStyle = 'rgba(4, 8, 5, 0.58)';
          ctx.fillRect(x * tile, y * tile, Math.ceil(tile), Math.ceil(tile));
        }
      }
    }
    for (const node of world.nodes) {
      if (!node.alive) continue;
      if (world.explored[0]![idx(node.tileX, node.tileY)] !== 1) continue;
      ctx.fillStyle = node.node === 'tree' ? '#456d35' : node.node === 'gold' ? '#d3b347' : node.node === 'stone' ? '#9b988c' : '#a94b45';
      ctx.fillRect(node.tileX * tile, node.tileY * tile, Math.max(1, tile * 0.7), Math.max(1, tile * 0.7));
    }
    for (const building of world.buildings) {
      if (!building.alive) continue;
      if (building.kingdom !== 0 && !this.anyTileVisible(world, building)) continue;
      ctx.fillStyle = building.kingdom === 0 ? '#6da6ff' : '#e86b5c';
      ctx.fillRect(building.tileX * tile, building.tileY * tile, Math.max(2, building.width * tile), Math.max(2, building.height * tile));
    }
    for (const unit of world.units) {
      if (!unit.alive) continue;
      if (unit.kingdom !== 0 && world.visible[0]![idx(Math.floor(unit.x), Math.floor(unit.y))] !== 1) continue;
      ctx.fillStyle = unit.kingdom === 0 ? '#d4ecff' : '#ffd0c9';
      ctx.fillRect(unit.x * tile - 1, unit.y * tile - 1, 2.2, 2.2);
    }
    // Camera viewport.
    const corners = [
      screenToWorld(this.camera, 0, 0, this.width, this.height),
      screenToWorld(this.camera, this.width, 0, this.width, this.height),
      screenToWorld(this.camera, this.width, this.height, this.width, this.height),
      screenToWorld(this.camera, 0, this.height, this.width, this.height),
    ];
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(244, 224, 160, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    corners.forEach((c, i) => {
      const x = c.x * tile;
      const y = c.y * tile;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(202, 176, 104, 0.35)';
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  selectedEntities(world: World): (Unit | Building | ResourceNode)[] {
    const out: (Unit | Building | ResourceNode)[] = [];
    for (const id of this.state.selected) {
      const u = world.units.find((x) => x.id === id);
      if (u) {
        out.push(u);
        continue;
      }
      const b = world.buildings.find((x) => x.id === id);
      if (b) {
        out.push(b);
        continue;
      }
      const n = world.nodes.find((x) => x.id === id);
      if (n) out.push(n);
    }
    return out;
  }
}

void clampCamera;
void NODE_DEFS;

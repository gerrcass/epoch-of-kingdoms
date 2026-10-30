import { MAP_SIZE } from '../sim/content';
import type { GameMap } from '../sim/types';
import { idx } from '../sim/map';
import { TILE_H, TILE_W, type Camera } from './iso';

export const TERRAIN_CHUNK = 16;
export const CHUNK_W = TERRAIN_CHUNK * TILE_W;
export const CHUNK_H = TERRAIN_CHUNK * TILE_H * 2;

function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1274126177, seed + 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const GRASS = ['#5f7c40', '#668545', '#6b8a49', '#5a763c'];
const DIRT = ['#8c7953', '#947f57', '#836f4c'];
const FOREST = ['#435f36', '#48653a', '#3d5731'];

export function terrainMiniColor(terrain: number, x: number, y: number): string {
  if (terrain === 2) return hash2(x, y, 2) > 0.5 ? '#34677a' : '#2d5c6e';
  if (terrain === 4) return '#6d6b62';
  if (terrain === 3) return FOREST[Math.floor(hash2(x, y, 3) * FOREST.length)]!;
  if (terrain === 1) return DIRT[Math.floor(hash2(x, y, 1) * DIRT.length)]!;
  return GRASS[Math.floor(hash2(x, y, 0) * GRASS.length)]!;
}

function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw = TILE_W / 2, hh = TILE_H / 2): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
}

export class TerrainRenderer {
  private chunks = new Map<number, HTMLCanvasElement>();
  private map: GameMap;
  private seed: number;

  constructor(map: GameMap, seed: number) {
    this.map = map;
    this.seed = seed;
  }

  private getChunk(cx: number, cy: number): HTMLCanvasElement {
    const key = cy * 4 + cx;
    const cached = this.chunks.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = CHUNK_W;
    canvas.height = CHUNK_H;
    const ctx = canvas.getContext('2d')!;
    for (let ly = 0; ly < TERRAIN_CHUNK; ly += 1) {
      for (let lx = 0; lx < TERRAIN_CHUNK; lx += 1) {
        const tx = cx * TERRAIN_CHUNK + lx;
        const ty = cy * TERRAIN_CHUNK + ly;
        if (tx >= MAP_SIZE || ty >= MAP_SIZE) continue;
        const terrain = this.map.terrain[idx(tx, ty)]!;
        const px = CHUNK_W / 2 + (lx - ly) * (TILE_W / 2);
        const py = (lx + ly) * (TILE_H / 2) + TILE_H / 2;
        const n = hash2(tx, ty, this.seed);
        let base: string;
        if (terrain === 2) base = n > 0.5 ? '#2f5f72' : '#2b586a';
        else if (terrain === 4) base = n > 0.5 ? '#66645b' : '#5d5b53';
        else if (terrain === 3) base = FOREST[Math.floor(n * FOREST.length)]!;
        else if (terrain === 1) base = DIRT[Math.floor(n * DIRT.length)]!;
        else base = GRASS[Math.floor(n * GRASS.length)]!;
        diamond(ctx, px, py, TILE_W / 2 + 0.6, TILE_H / 2 + 0.6);
        ctx.fillStyle = base;
        ctx.fill();

        // Top-left lit edge, bottom-right shaded edge.
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - TILE_W / 2, py);
        ctx.lineTo(px, py - TILE_H / 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.09)';
        ctx.beginPath();
        ctx.moveTo(px + TILE_W / 2, py);
        ctx.lineTo(px, py + TILE_H / 2);
        ctx.stroke();

        if (terrain === 0) {
          for (let i = 0; i < 3; i += 1) {
            const hx = hash2(tx * 3 + i, ty * 5, this.seed);
            const hy = hash2(tx * 7, ty * 3 + i, this.seed + 1);
            const gx = px + (hx - 0.5) * 42;
            const gy = py + (hy - 0.5) * 12;
            ctx.strokeStyle = hx > 0.5 ? 'rgba(42,64,30,0.46)' : 'rgba(129,153,84,0.4)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(gx, gy + 2);
            ctx.quadraticCurveTo(gx + 1, gy - 1, gx - 1, gy - 4);
            ctx.stroke();
          }
          if (n > 0.86) {
            ctx.fillStyle = n > 0.93 ? '#e9d27a' : '#e4e7cf';
            ctx.beginPath();
            ctx.arc(px + (n - 0.9) * 120, py + 3, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (terrain === 1) {
          ctx.fillStyle = 'rgba(66,52,35,0.35)';
          for (let i = 0; i < 3; i += 1) {
            const hx = hash2(tx * 11 + i, ty * 13, this.seed);
            ctx.beginPath();
            ctx.arc(px + (hx - 0.5) * 34, py + (hash2(tx, ty * 7 + i, 3) - 0.5) * 12, 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (terrain === 2) {
          ctx.strokeStyle = 'rgba(157,208,208,0.18)';
          ctx.lineWidth = 1;
          for (let i = 0; i < 2; i += 1) {
            const wy = py - 4 + i * 6;
            ctx.beginPath();
            ctx.moveTo(px - 16, wy);
            ctx.quadraticCurveTo(px, wy - 2, px + 16, wy);
            ctx.stroke();
          }
        } else if (terrain === 3) {
          ctx.fillStyle = 'rgba(27,42,22,0.4)';
          ctx.beginPath();
          ctx.arc(px - 6, py + 2, 2.5, 0, Math.PI * 2);
          ctx.arc(px + 7, py - 3, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (terrain === 4) {
          ctx.strokeStyle = 'rgba(38,37,33,0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px - 9, py + 4);
          ctx.lineTo(px - 2, py - 4);
          ctx.lineTo(px + 5, py + 5);
          ctx.stroke();
        }
      }
    }
    this.chunks.set(key, canvas);
    return canvas;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (let cy = 0; cy < 4; cy += 1) {
      for (let cx = 0; cx < 4; cx += 1) {
        const chunk = this.getChunk(cx, cy);
        const x0 = (cx - cy) * (TERRAIN_CHUNK * TILE_W) / 2;
        const y0 = (cx + cy) * (TERRAIN_CHUNK * TILE_H) / 2;
        const left = (x0 - CHUNK_W / 2 - camera.x) * camera.zoom + window.innerWidth / 2;
        const top = (y0 - camera.y) * camera.zoom + window.innerHeight / 2;
        if (left > window.innerWidth + 40 || top > window.innerHeight + 40) continue;
        if (left + CHUNK_W * camera.zoom < -40 || top + CHUNK_H * camera.zoom < -40) continue;
        ctx.drawImage(chunk, x0 - CHUNK_W / 2, y0, CHUNK_W, CHUNK_H);
      }
    }
  }

  drawWater(ctx: CanvasRenderingContext2D, camera: Camera, time: number): void {
    const viewW = window.innerWidth / camera.zoom;
    const viewH = window.innerHeight / camera.zoom;
    const minX = Math.max(0, Math.floor((camera.x - viewW / 2) / 64) - 4);
    const maxX = Math.min(MAP_SIZE - 1, Math.ceil((camera.x + viewW / 2) / 64) + 4);
    for (let y = Math.max(0, Math.floor((camera.y - viewH) / 32)); y < MAP_SIZE; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (this.map.terrain[idx(x, y)] !== 2) continue;
        const iso = { x: (x - y) * 32, y: (x + y) * 16 };
        if (iso.x < camera.x - viewW || iso.x > camera.x + viewW) continue;
        if (iso.y < camera.y - viewH || iso.y > camera.y + viewH) continue;
        const phase = time * 0.9 + x * 0.7 + y * 1.3;
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.1 * Math.sin(phase);
        ctx.strokeStyle = '#b9e0da';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const px = iso.x + Math.sin(phase) * 7;
        const py = iso.y + Math.cos(phase * 0.7) * 3;
        ctx.moveTo(px - 11, py + 3);
        ctx.quadraticCurveTo(px, py - 2, px + 12, py + 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

export class FogRenderer {
  private chunks = new Map<number, HTMLCanvasElement>();
  private dirty = true;

  rebuild(map: GameMap, visible: Uint8Array, explored: Uint8Array): void {
    if (!this.dirty) return;
    for (let cy = 0; cy < 4; cy += 1) {
      for (let cx = 0; cx < 4; cx += 1) {
        const key = cy * 4 + cx;
        let canvas = this.chunks.get(key);
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.width = CHUNK_W;
          canvas.height = CHUNK_H;
          this.chunks.set(key, canvas);
        }
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, CHUNK_W, CHUNK_H);
        for (let ly = 0; ly < TERRAIN_CHUNK; ly += 1) {
          for (let lx = 0; lx < TERRAIN_CHUNK; lx += 1) {
            const tx = cx * TERRAIN_CHUNK + lx;
            const ty = cy * TERRAIN_CHUNK + ly;
            if (tx >= MAP_SIZE || ty >= MAP_SIZE) continue;
            const i = idx(tx, ty);
            if (visible[i] === 1) continue;
            const px = CHUNK_W / 2 + (lx - ly) * (TILE_W / 2);
            const py = (lx + ly) * (TILE_H / 2) + TILE_H / 2;
            diamond(ctx, px, py, TILE_W / 2 + 0.7, TILE_H / 2 + 0.7);
            ctx.fillStyle = explored[i] === 1 ? 'rgba(6,10,8,0.58)' : 'rgba(3,5,4,0.94)';
            ctx.fill();
          }
        }
      }
    }
    this.dirty = false;
  }

  markDirty(): void {
    this.dirty = true;
  }

  draw(ctx: CanvasRenderingContext2D, _camera: Camera): void {
    for (let cy = 0; cy < 4; cy += 1) {
      for (let cx = 0; cx < 4; cx += 1) {
        const canvas = this.chunks.get(cy * 4 + cx);
        if (!canvas) continue;
        const x0 = (cx - cy) * (TERRAIN_CHUNK * TILE_W) / 2;
        const y0 = (cx + cy) * (TERRAIN_CHUNK * TILE_H) / 2;
        ctx.drawImage(canvas, x0 - CHUNK_W / 2, y0, CHUNK_W, CHUNK_H);
      }
    }
  }
}

void TILE_W;

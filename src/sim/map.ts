import { MAP_SIZE, NODE_DEFS } from './content';
import { Rng } from './rng';
import type { GameMap, NodeKind, ResourceNode, Vec2 } from './types';

export const TERRAIN_GRASS = 0;
export const TERRAIN_DIRT = 1;
export const TERRAIN_WATER = 2;
export const TERRAIN_FOREST = 3;
export const TERRAIN_ROCK = 4;

export const MAP_N = MAP_SIZE;

export function idx(x: number, y: number): number {
  return y * MAP_N + x;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_N && y < MAP_N;
}

export function isWalkable(map: GameMap, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const i = idx(x, y);
  const t = map.terrain[i];
  if (t === TERRAIN_WATER || t === TERRAIN_ROCK) return false;
  return map.blocked[i] === 0;
}

export function isBlocked(map: GameMap, x: number, y: number): boolean {
  if (!inBounds(x, y)) return true;
  return map.blocked[idx(x, y)] !== 0;
}

export function isWalkableTerrain(map: GameMap, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const t = map.terrain[idx(x, y)];
  return t !== TERRAIN_WATER && t !== TERRAIN_ROCK;
}

function noise(x: number, y: number, seed: number, scale: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const h = (ix: number, iy: number) => {
    let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2246822519)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const a = h(x0, y0);
  const b = h(x0 + 1, y0);
  const c = h(x0, y0 + 1);
  const d = h(x0 + 1, y0 + 1);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

function fbm(x: number, y: number, seed: number): number {
  return noise(x, y, seed, 15) * 0.5 + noise(x, y, seed, 7) * 0.3 + noise(x, y, seed, 3.5) * 0.2;
}

const mirror = (p: Vec2): Vec2 => ({ x: MAP_N - 1 - p.x, y: MAP_N - 1 - p.y });

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function generateMap(seed: number): { map: GameMap; nodes: ResourceNode[] } {
  const rng = new Rng(seed ^ 0x51ed270b);
  const terrain = new Uint8Array(MAP_N * MAP_N);
  const baseA: Vec2 = { x: 7, y: 7 };
  const baseB: Vec2 = {
    x: MAP_N - 1 - baseA.x - 2,
    y: MAP_N - 1 - baseA.y - 2,
  };
  const laneAx = baseA.x + 1.5;
  const laneAy = baseA.y + 1.5;
  const laneBx = baseB.x + 1.5;
  const laneBy = baseB.y + 1.5;
  const center = (MAP_N - 1) / 2;

  for (let y = 0; y < MAP_N; y += 1) {
    for (let x = 0; x < MAP_N; x += 1) {
      const edge = Math.min(x, y, MAP_N - 1 - x, MAP_N - 1 - y);
      const n = fbm(x, y, seed);
      const dA = Math.hypot(x - laneAx, y - laneAy);
      const dB = Math.hypot(x - laneBx, y - laneBy);
      const clearing = dA < 7.5 || dB < 7.5;
      const lane = distanceToSegment(x, y, laneAx, laneAy, laneBx, laneBy) < 3.4;
      const lake = Math.hypot((x - center) / 8.5, (y - center) / 6.5) + (n - 0.5) * 0.5;

      let t = TERRAIN_GRASS;
      if (edge < 1) t = TERRAIN_ROCK;
      else if (clearing || lane) t = TERRAIN_GRASS;
      else if (lake < 1) t = TERRAIN_WATER;
      else if (n > 0.62) t = TERRAIN_FOREST;
      else if (n > 0.53) t = TERRAIN_DIRT;
      terrain[idx(x, y)] = t;
    }
  }

  // Rotational symmetry: copy the north-west half onto its mirror.
  for (let y = 0; y < MAP_N; y += 1) {
    for (let x = 0; x < MAP_N; x += 1) {
      if (x + y > MAP_N - 2) continue;
      const m = mirror({ x, y });
      terrain[idx(m.x, m.y)] = terrain[idx(x, y)];
    }
  }

  const blocked = new Uint8Array(MAP_N * MAP_N);
  for (let i = 0; i < blocked.length; i += 1) {
    if (terrain[i] === TERRAIN_WATER || terrain[i] === TERRAIN_ROCK) blocked[i] = 1;
  }

  const map: GameMap = {
    size: MAP_N,
    terrain,
    blocked,
    startTiles: [baseA, baseB],
  };

  const nodes: ResourceNode[] = [];
  let nodeId = 1;
  const used = new Set<number>();

  const put = (kind: NodeKind, x: number, y: number): boolean => {
    if (!inBounds(x, y)) return false;
    const i = idx(x, y);
    if (used.has(i)) return false;
    if (terrain[i] === TERRAIN_WATER || terrain[i] === TERRAIN_ROCK) return false;
    used.add(i);
    blocked[i] = 1;
    const def = NODE_DEFS[kind];
    nodes.push({
      id: nodeId++,
      kind: 'node',
      node: kind,
      tileX: x,
      tileY: y,
      x: x + 0.5,
      y: y + 0.5,
      amount: def.amount,
      maxAmount: def.amount,
      radius: def.radius,
      variant: Math.floor(rng.float() * 4),
      alive: true,
    });
    return true;
  };

  const putPair = (kind: NodeKind, p: Vec2): void => {
    put(kind, p.x, p.y);
    const m = mirror(p);
    put(kind, m.x, m.y);
  };

  // Home berries, sheep, gold, stone; mirrored for the rival.
  const home: [NodeKind, Vec2][] = [
    ['berry', { x: 3, y: 9 }],
    ['berry', { x: 4, y: 10 }],
    ['berry', { x: 5, y: 9 }],
    ['berry', { x: 3, y: 8 }],
    ['berry', { x: 6, y: 10 }],
    ['sheep', { x: 11, y: 5 }],
    ['sheep', { x: 12, y: 6 }],
    ['gold', { x: 14, y: 6 }],
    ['gold', { x: 15, y: 6 }],
    ['gold', { x: 14, y: 7 }],
    ['gold', { x: 15, y: 7 }],
    ['stone', { x: 4, y: 14 }],
    ['stone', { x: 5, y: 14 }],
    ['stone', { x: 4, y: 15 }],
  ];
  for (const [kind, p] of home) putPair(kind, p);

  // Contested centre.
  const centre: [NodeKind, Vec2][] = [
    ['gold', { x: 27, y: 36 }],
    ['gold', { x: 28, y: 36 }],
    ['gold', { x: 27, y: 37 }],
    ['stone', { x: 36, y: 27 }],
    ['stone', { x: 37, y: 27 }],
  ];
  for (const [kind, p] of centre) putPair(kind, p);

  // Forest tiles become trees, with a few gaps.
  for (let y = 2; y < MAP_N - 2; y += 1) {
    for (let x = 2; x < MAP_N - 2; x += 1) {
      if (terrain[idx(x, y)] !== TERRAIN_FOREST) continue;
      const dA = Math.hypot(x - laneAx, y - laneAy);
      const dB = Math.hypot(x - laneBx, y - laneBy);
      if (dA < 6.5 || dB < 6.5) continue;
      if (rng.float() < 0.2) continue;
      put('tree', x, y);
    }
  }

  // Guarantee a woodline within reach of each town centre.
  for (const [cx, cy] of [
    [laneAx, laneAy],
    [laneBx, laneBy],
  ]) {
    let placed = 0;
    for (let r = 6.5; r < 11 && placed < 26; r += 1) {
      for (let a = 0; a < Math.PI * 2 && placed < 26; a += Math.PI / 12) {
        const x = Math.round(cx + Math.cos(a) * r);
        const y = Math.round(cy + Math.sin(a) * r);
        if (put('tree', x, y)) placed += 1;
      }
    }
  }

  return { map, nodes };
}

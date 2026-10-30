import { inBounds, idx, isWalkable } from './map';
import type { GameMap, Vec2 } from './types';

const MAP_N = 64;

class MinHeap {
  private items: number[] = [];
  private scores: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, score: number): void {
    this.items.push(item);
    this.scores.push(score);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.scores[p]! <= this.scores[i]!) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.items[0]!;
    const lastItem = this.items.pop()!;
    const lastScore = this.scores.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.scores[0] = lastScore;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.items.length && this.scores[l]! < this.scores[smallest]!) smallest = l;
        if (r < this.items.length && this.scores[r]! < this.scores[smallest]!) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
    [this.scores[a], this.scores[b]] = [this.scores[b]!, this.scores[a]!];
  }
}

const NEIGHBOURS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

export function nearestWalkable(map: GameMap, x: number, y: number, maxRadius = 6): Vec2 | null {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (inBounds(tx, ty) && isWalkable(map, tx, ty)) return { x: tx + 0.5, y: ty + 0.5 };
  for (let r = 1; r <= maxRadius; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (inBounds(nx, ny) && isWalkable(map, nx, ny)) return { x: nx + 0.5, y: ny + 0.5 };
      }
    }
  }
  return null;
}

function lineClear(map: GameMap, ax: number, ay: number, bx: number, by: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return true;
  for (let i = 1; i <= steps; i += 1) {
    const x = Math.round(ax + (dx * i) / steps);
    const y = Math.round(ay + (dy * i) / steps);
    if (!isWalkable(map, x, y)) return false;
  }
  return true;
}

function smoothPath(map: GameMap, points: Vec2[]): Vec2[] {
  if (points.length <= 2) return points;
  const out: Vec2[] = [points[0]!];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let next = anchor + 1;
    for (let i = points.length - 1; i > anchor; i -= 1) {
      const a = points[anchor]!;
      const b = points[i]!;
      if (lineClear(map, Math.floor(a.x), Math.floor(a.y), Math.floor(b.x), Math.floor(b.y))) {
        next = i;
        break;
      }
    }
    out.push(points[next]!);
    anchor = next;
  }
  return out;
}

export function findPath(map: GameMap, sx: number, sy: number, tx: number, ty: number, maxNodes = 5000): Vec2[] | null {
  const start = nearestWalkable(map, sx, sy, 2);
  if (!start) return null;
  let goal = isWalkable(map, Math.floor(tx), Math.floor(ty))
    ? { x: Math.floor(tx), y: Math.floor(ty) }
    : null;
  if (!goal) {
    const near = nearestWalkable(map, tx, ty, 6);
    if (!near) return null;
    goal = { x: Math.floor(near.x), y: Math.floor(near.y) };
  }
  const sxi = Math.floor(start.x);
  const syi = Math.floor(start.y);
  if (sxi === goal.x && syi === goal.y) return [];

  const total = MAP_N * MAP_N;
  const g = new Float32Array(total).fill(Infinity);
  const came = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const heap = new MinHeap();
  const startIdx = idx(sxi, syi);
  const goalIdx = idx(goal.x, goal.y);
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - goal!.x);
    const dy = Math.abs(y - goal!.y);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  g[startIdx] = 0;
  heap.push(startIdx, h(sxi, syi));
  let expanded = 0;

  while (heap.size > 0) {
    const current = heap.pop();
    if (closed[current]) continue;
    closed[current] = 1;
    if (current === goalIdx) {
      const path: Vec2[] = [];
      let node = current;
      while (node !== -1) {
        path.push({ x: (node % MAP_N) + 0.5, y: Math.floor(node / MAP_N) + 0.5 });
        node = came[node]!;
      }
      path.reverse();
      return smoothPath(map, path);
    }
    expanded += 1;
    if (expanded > maxNodes) return null;
    const cx = current % MAP_N;
    const cy = Math.floor(current / MAP_N);
    for (const [dx, dy, cost] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkable(map, nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        if (!isWalkable(map, cx + dx, cy) || !isWalkable(map, cx, cy + dy)) continue;
      }
      const nIdx = idx(nx, ny);
      if (closed[nIdx]) continue;
      const tentative = g[current]! + cost;
      if (tentative + 1e-6 < g[nIdx]!) {
        g[nIdx] = tentative;
        came[nIdx] = current;
        heap.push(nIdx, tentative + h(nx, ny));
      }
    }
  }
  return null;
}

export function footprintBlocked(map: GameMap, tx: number, ty: number, w: number, h: number): boolean {
  for (let y = ty; y < ty + h; y += 1) {
    for (let x = tx; x < tx + w; x += 1) {
      if (!inBounds(x, y)) return true;
      if (!isWalkable(map, x, y)) return true;
    }
  }
  return false;
}

export function approachTile(
  map: GameMap,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  w: number,
  h: number,
  maxRadius = 5,
): Vec2 | null {
  const candidates: Vec2[] = [];
  for (let y = ty - 1; y <= ty + h; y += 1) {
    for (let x = tx - 1; x <= tx + w; x += 1) {
      const inside = x >= tx && x < tx + w && y >= ty && y < ty + h;
      if (inside) continue;
      if (inBounds(x, y) && isWalkable(map, x, y)) candidates.push({ x: x + 0.5, y: y + 0.5 });
    }
  }
  if (candidates.length === 0) {
    for (let r = 1; r <= maxRadius; r += 1) {
      for (let d = -r; d <= r; d += 1) {
        const points: [number, number][] = [
          [tx + d, ty - r],
          [tx + d, ty + h - 1 + r],
          [tx - r, ty + d],
          [tx + w - 1 + r, ty + d],
        ];
        for (const [x, y] of points) {
          if (inBounds(x, y) && isWalkable(map, x, y)) candidates.push({ x: x + 0.5, y: y + 0.5 });
        }
      }
      if (candidates.length > 0) break;
    }
  }
  let best: Vec2 | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = Math.hypot(c.x - sx, c.y - sy);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

export function approachNode(map: GameMap, sx: number, sy: number, tx: number, ty: number): Vec2 | null {
  const candidates: Vec2[] = [];
  for (let y = ty - 1; y <= ty + 1; y += 1) {
    for (let x = tx - 1; x <= tx + 1; x += 1) {
      if (x === tx && y === ty) continue;
      if (inBounds(x, y) && isWalkable(map, x, y)) candidates.push({ x: x + 0.5, y: y + 0.5 });
    }
  }
  let best: Vec2 | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(c.x - sx, c.y - sy);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

export function renderLineClear(map: GameMap, ax: number, ay: number, bx: number, by: number): boolean {
  return lineClear(map, Math.round(ax), Math.round(ay), Math.round(bx), Math.round(by));
}

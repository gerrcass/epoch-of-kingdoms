export const TILE_W = 64;
export const TILE_H = 32;
export const MAP_TILES = 64;

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface IsoPoint {
  x: number;
  y: number;
}

export function worldToIso(x: number, y: number): IsoPoint {
  return { x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) };
}

export function isoToWorld(x: number, y: number): IsoPoint {
  return {
    x: (x / (TILE_W / 2) + y / (TILE_H / 2)) / 2,
    y: (y / (TILE_H / 2) - x / (TILE_W / 2)) / 2,
  };
}

export function worldToScreen(camera: Camera, x: number, y: number, width: number, height: number): IsoPoint {
  const iso = worldToIso(x, y);
  return {
    x: (iso.x - camera.x) * camera.zoom + width / 2,
    y: (iso.y - camera.y) * camera.zoom + height / 2,
  };
}

export function screenToWorld(
  camera: Camera,
  sx: number,
  sy: number,
  width: number,
  height: number,
): IsoPoint {
  const ix = (sx - width / 2) / camera.zoom + camera.x;
  const iy = (sy - height / 2) / camera.zoom + camera.y;
  return isoToWorld(ix, iy);
}

export function focusCamera(camera: Camera, x: number, y: number): void {
  const iso = worldToIso(x, y);
  camera.x = iso.x;
  camera.y = iso.y;
}

export function clampCamera(camera: Camera, width: number, height: number): void {
  const margin = 240 / camera.zoom;
  const minX = -(MAP_TILES + 2) * (TILE_W / 2);
  const maxX = (MAP_TILES + 2) * (TILE_W / 2);
  const minY = -margin;
  const maxY = (MAP_TILES * 2 + 2) * (TILE_H / 2);
  camera.x = Math.max(minX, Math.min(maxX, camera.x));
  camera.y = Math.max(minY, Math.min(maxY, camera.y));
  void width;
  void height;
}

export function zoomCameraAt(
  camera: Camera,
  factor: number,
  sx: number,
  sy: number,
  width: number,
  height: number,
): void {
  const before = screenToWorld(camera, sx, sy, width, height);
  camera.zoom = Math.max(0.55, Math.min(1.6, camera.zoom * factor));
  const after = screenToWorld(camera, sx, sy, width, height);
  camera.x += (before.x - after.x) * (TILE_W / 2);
  camera.y += (before.y - after.y) * (TILE_H / 2);
  camera.x += (before.y - after.y) * (TILE_W / 2);
  camera.y -= (before.x - after.x) * (TILE_H / 2);
  clampCamera(camera, width, height);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function diamondPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, halfW = 32, halfH = 16): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
}

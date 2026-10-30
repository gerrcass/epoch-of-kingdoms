import { BUILDING_DEFS } from '../sim/content';
import { tileVisible, canPlaceBuilding, entityAt, unitsInBox } from '../sim/world';
import type { Building, BuildingKind, Command, Unit, World } from '../sim/types';
import type { Renderer } from '../render/renderer';
import type { Hud } from './hud';

export interface InputHost {
  getWorld(): World | null;
  getRenderer(): Renderer;
  getHud(): Hud;
  issue(command: Command): void;
  setSelection(ids: number[]): void;
  getSelection(): number[];
  getBuildMode(): BuildingKind | null;
  setBuildMode(mode: BuildingKind | null): void;
  setAttackMoveMode(active: boolean): void;
  isAttackMoveMode(): boolean;
  isPaused(): boolean;
  isOverlayOpen(): boolean;
  closeOverlay(): void;
  togglePause(): void;
  showHelp(): void;
  idleVillager(): void;
  centerTownCenter(): void;
}

export class Input {
  private host: InputHost;
  private canvas: HTMLCanvasElement;
  private minimap: HTMLCanvasElement;
  private keys = new Set<string>();
  private pointerX = 0;
  private pointerY = 0;
  private pointerInside = false;
  private dragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragCurrent = { x: 0, y: 0 };
  private shift = false;
  private lastClickAt = 0;
  private lastClickId = -1;
  private lastGroupTap = { group: -1, at: 0 };
  private groups: number[][] = [];

  constructor(host: InputHost) {
    this.host = host;
    this.canvas = document.getElementById('world') as HTMLCanvasElement;
    this.minimap = document.getElementById('minimap') as HTMLCanvasElement;
    this.bind();
  }

  private bind(): void {
    this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.canvas.addEventListener('pointerup', (event) => this.onPointerUp(event));
    this.canvas.addEventListener('pointerleave', () => {
      this.pointerInside = false;
      const renderer = this.host.getRenderer();
      renderer.state.hoverTile = null;
    });
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.host.getRenderer().zoomAt(event.clientX, event.clientY, event.deltaY > 0 ? 0.9 : 1.1);
    }, { passive: false });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.minimap.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.panFromMinimap(event.clientX, event.clientY);
      const move = (e: PointerEvent) => this.panFromMinimap(e.clientX, e.clientY);
      const up = () => {
        this.minimap.removeEventListener('pointermove', move);
        this.minimap.removeEventListener('pointerup', up);
      };
      this.minimap.addEventListener('pointermove', move);
      this.minimap.addEventListener('pointerup', up);
    });
    this.minimap.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.onKeyUp(event));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('resize', () => this.host.getRenderer().resize());
  }

  private canvasPoint(event: PointerEvent | WheelEvent): { x: number; y: number; rect: DOMRect } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, rect };
  }

  private onPointerMove(event: PointerEvent): void {
    const p = this.canvasPoint(event);
    this.pointerX = p.x;
    this.pointerY = p.y;
    this.pointerInside = true;
    const world = this.host.getWorld();
    if (!world) return;
    const renderer = this.host.getRenderer();
    const tile = renderer.screenToTile(event.clientX, event.clientY);
    renderer.state.hoverTile = { x: tile.x, y: tile.y };
    if (this.dragging) {
      this.dragCurrent = { x: p.x, y: p.y };
      renderer.state.selectionBox = {
        x1: this.dragStart.x,
        y1: this.dragStart.y,
        x2: this.dragCurrent.x,
        y2: this.dragCurrent.y,
      };
    }
    const mode = this.host.getBuildMode();
    if (mode) {
      const def = BUILDING_DEFS[mode];
      const tx = Math.round(tile.x - def.width / 2);
      const ty = Math.round(tile.y - def.height / 2);
      renderer.state.buildGhost = {
        type: mode,
        x: tx,
        y: ty,
        valid: canPlaceBuilding(world, 0, mode, tx, ty),
      };
    } else {
      renderer.state.buildGhost = null;
    }
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button === 2) {
      this.onRightClick(event);
      return;
    }
    if (event.button !== 0) return;
    const world = this.host.getWorld();
    if (!world || this.host.isOverlayOpen()) return;
    const p = this.canvasPoint(event);
    this.shift = event.shiftKey;
    const tile = this.host.getRenderer().screenToTile(event.clientX, event.clientY);
    const mode = this.host.getBuildMode();
    if (mode) {
      this.placeBuilding(mode, tile.x, tile.y, event.shiftKey);
      return;
    }
    if (this.host.isAttackMoveMode()) {
      this.host.setAttackMoveMode(false);
      this.host.getRenderer().state.attackMoveMode = false;
      this.canvas.classList.remove('attack-move');
      this.host.issue({ type: 'move', kingdom: 0, ids: this.host.getSelection(), x: tile.x, y: tile.y, attackMove: true });
      return;
    }
    this.dragging = true;
    this.dragStart = { x: p.x, y: p.y };
    this.dragCurrent = { x: p.x, y: p.y };
    this.host.getRenderer().state.selectionBox = null;
  }

  private onPointerUp(event: PointerEvent): void {
    if (event.button !== 0) return;
    if (!this.dragging) return;
    this.dragging = false;
    const renderer = this.host.getRenderer();
    const box = renderer.state.selectionBox;
    renderer.state.selectionBox = null;
    const world = this.host.getWorld();
    if (!world) return;
    const dx = this.dragCurrent.x - this.dragStart.x;
    const dy = this.dragCurrent.y - this.dragStart.y;
    if (box && Math.hypot(dx, dy) > 7) {
      const a = renderer.screenToWorld(this.dragStart.x, this.dragStart.y);
      const b = renderer.screenToWorld(this.dragCurrent.x, this.dragCurrent.y);
      const units = unitsInBox(world, 0, a.x, a.y, b.x, b.y);
      const ids = units.map((u) => u.id);
      if (this.shift) this.addSelection(ids);
      else this.host.setSelection(ids);
      return;
    }
    const point = renderer.screenToWorld(event.clientX, event.clientY);
    const target = entityAt(world, point.x, point.y, 0);
    if (!target) {
      if (!this.shift) this.host.setSelection([]);
      return;
    }
    const now = performance.now();
    if (this.lastClickId === target.id && now - this.lastClickAt < 320) {
      this.selectAllOfType(world, target);
      this.lastClickAt = 0;
      this.lastClickId = -1;
      return;
    }
    this.lastClickAt = now;
    this.lastClickId = target.id;
    if (this.shift) this.addSelection([target.id]);
    else this.host.setSelection([target.id]);
  }

  private selectAllOfType(world: World, target: Unit | Building | import('../sim/types').ResourceNode): void {
    if (target.kind !== 'unit') {
      this.host.setSelection([target.id]);
      return;
    }
    const renderer = this.host.getRenderer();
    const ids = world.units
      .filter((u) => u.alive && u.kingdom === 0 && u.type === target.type)
      .filter((u) => {
        const screen = renderer.worldToScreen(u.x, u.y);
        return screen.x >= 0 && screen.x <= renderer.width && screen.y >= 0 && screen.y <= renderer.height;
      })
      .map((u) => u.id);
    this.host.setSelection(ids.length ? ids : [target.id]);
  }

  private addSelection(ids: number[]): void {
    const current = new Set(this.host.getSelection());
    for (const id of ids) {
      if (current.has(id)) current.delete(id);
      else current.add(id);
    }
    this.host.setSelection([...current]);
  }

  private onRightClick(event: PointerEvent): void {
    event.preventDefault();
    if (this.host.isOverlayOpen()) return;
    const mode = this.host.getBuildMode();
    if (mode) {
      this.host.setBuildMode(null);
      return;
    }
    if (this.host.isAttackMoveMode()) {
      this.host.setAttackMoveMode(false);
      this.host.getRenderer().state.attackMoveMode = false;
      this.canvas.classList.remove('attack-move');
      return;
    }
    const world = this.host.getWorld();
    if (!world || this.host.isPaused()) return;
    const renderer = this.host.getRenderer();
    const point = renderer.screenToWorld(event.clientX, event.clientY);
    const selected = this.host.getSelection();
    const selectedUnits = selected
      .map((id) => world.units.find((u) => u.id === id && u.alive))
      .filter((u): u is Unit => u !== undefined && u.kingdom === 0);
    const selectedBuildings = selected
      .map((id) => world.buildings.find((b) => b.id === id && b.alive))
      .filter((b): b is Building => b !== undefined && b.kingdom === 0);
    const production = selectedBuildings.find((b) => BUILDING_DEFS[b.type].trains.length > 0 || b.type === 'townCenter');
    const target = this.enemyOrOwnAt(world, point.x, point.y);

    if (production && (!target || target.kind === 'node' || target.kingdom === 0)) {
      this.host.issue({ type: 'rally', kingdom: 0, buildingId: production.id, x: point.x, y: point.y });
      return;
    }
    if (selectedUnits.length === 0) return;

    if (target && target.kind === 'node') {
      const villagers = selectedUnits.filter((u) => u.type === 'villager');
      if (villagers.length) {
        this.host.issue({ type: 'gather', kingdom: 0, ids: villagers.map((u) => u.id), nodeId: target.id });
        return;
      }
    }
    if (target && target.kind === 'building' && target.type === 'farm' && target.kingdom === 0 && target.complete) {
      const villagers = selectedUnits.filter((u) => u.type === 'villager');
      if (villagers.length) {
        this.host.issue({ type: 'gather', kingdom: 0, ids: villagers.map((u) => u.id), nodeId: target.id });
        return;
      }
    }
    if (target && target.kind !== 'node' && target.kingdom !== 0) {
      const military = selectedUnits.filter((u) => u.type !== 'villager');
      if (military.length) {
        this.host.issue({ type: 'attack', kingdom: 0, ids: military.map((u) => u.id), targetId: target.id });
        return;
      }
    }
    if (target && target.kind === 'building' && target.kingdom === 0 && target.hp < target.maxHp) {
      const villagers = selectedUnits.filter((u) => u.type === 'villager');
      if (villagers.length) {
        this.host.issue({ type: 'repair', kingdom: 0, ids: villagers.map((u) => u.id), buildingId: target.id });
        return;
      }
    }
    this.host.issue({ type: 'move', kingdom: 0, ids: selectedUnits.map((u) => u.id), x: point.x, y: point.y });
  }

  private enemyOrOwnAt(world: World, x: number, y: number): Unit | Building | import('../sim/types').ResourceNode | null {
    const own = entityAt(world, x, y, 0);
    if (own) return own;
    for (const unit of world.units) {
      if (!unit.alive || unit.kingdom === 0) continue;
      if (!tileVisible(world, 0, unit.x, unit.y)) continue;
      if (Math.hypot(unit.x - x, unit.y - y) < unit.radius + 0.35) return unit;
    }
    for (const building of world.buildings) {
      if (!building.alive || building.kingdom === 0) continue;
      if (x >= building.tileX && x < building.tileX + building.width && y >= building.tileY && y < building.tileY + building.height) return building;
    }
    return null;
  }

  private placeBuilding(mode: BuildingKind, tx: number, ty: number, keepMode: boolean): void {
    const world = this.host.getWorld();
    if (!world) return;
    const def = BUILDING_DEFS[mode];
    const x = Math.round(tx - def.width / 2);
    const y = Math.round(ty - def.height / 2);
    if (canPlaceBuilding(world, 0, mode, x, y)) {
      const ids = this.host
        .getSelection()
        .map((id) => world.units.find((u) => u.id === id))
        .filter((u): u is Unit => u !== undefined && u.type === 'villager')
        .map((u) => u.id);
      if (ids.length) this.host.issue({ type: 'build', kingdom: 0, ids, building: mode, x, y });
    }
    if (!keepMode) this.host.setBuildMode(null);
  }

  private panFromMinimap(clientX: number, clientY: number): void {
    const renderer = this.host.getRenderer();
    const rect = this.minimap.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const x = Math.max(0, Math.min(63.9, (px / size) * 64));
    const y = Math.max(0, Math.min(63.9, (py / size) * 64));
    renderer.focus(x, y);
  }

  private onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const key = event.key.toLowerCase();
    if (this.host.isOverlayOpen()) {
      if (key === 'escape') {
        this.host.closeOverlay();
        event.preventDefault();
      } else if (key === 'p' && this.host.isPaused()) {
        this.host.togglePause();
        event.preventDefault();
      }
      return;
    }
    const control = event.ctrlKey || event.altKey;
    if (control && /^[1-9]$/.test(key)) {
      this.groups[Number(key) - 1] = [...this.host.getSelection()];
      event.preventDefault();
      return;
    }
    if (!control && /^[1-9]$/.test(key)) {
      const group = this.groups[Number(key) - 1];
      if (group) {
        const now = performance.now();
        const index = Number(key) - 1;
        if (this.lastGroupTap.group === index && now - this.lastGroupTap.at < 350) {
          this.centerOnSelection(group);
        } else {
          this.host.setSelection([...group]);
        }
        this.lastGroupTap = { group: index, at: now };
        event.preventDefault();
        return;
      }
    }
    if (key === 'escape') {
      if (this.host.isPaused()) this.host.togglePause();
      else if (this.host.isAttackMoveMode() || this.host.getBuildMode()) {
        this.host.setBuildMode(null);
        this.host.setAttackMoveMode(false);
        this.host.getRenderer().state.attackMoveMode = false;
        this.canvas.classList.remove('attack-move');
      } else {
        this.host.setSelection([]);
      }
      return;
    }
    if (key === ' ') {
      this.host.centerTownCenter();
      event.preventDefault();
      return;
    }
    if (key === 'p') {
      this.host.togglePause();
      return;
    }
    if (key === '.') {
      this.host.idleVillager();
      event.preventDefault();
      return;
    }
    if (key === 'f1' || key === '?') {
      this.host.showHelp();
      event.preventDefault();
      return;
    }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      this.keys.add(key);
      event.preventDefault();
      return;
    }
    if (!control && /^[a-z]$/.test(key)) {
      if (this.host.getHud().triggerHotkey(key)) {
        event.preventDefault();
      }
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.key.toLowerCase());
  }

  update(dt: number): void {
    const renderer = this.host.getRenderer();
    const speed = 640 * dt;
    if (this.keys.has('arrowup')) renderer.pan(0, -speed);
    if (this.keys.has('arrowdown')) renderer.pan(0, speed);
    if (this.keys.has('arrowleft')) renderer.pan(-speed, 0);
    if (this.keys.has('arrowright')) renderer.pan(speed, 0);
    if (!this.pointerInside) return;
    const edge = 14;
    if (this.pointerX < edge) renderer.pan(-speed, 0);
    else if (this.pointerX > renderer.width - edge) renderer.pan(speed, 0);
    if (this.pointerY < edge) renderer.pan(0, -speed);
    else if (this.pointerY > renderer.height - edge) renderer.pan(0, speed);
  }

  private centerOnSelection(ids: number[]): void {
    const world = this.host.getWorld();
    if (!world) return;
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (const id of ids) {
      const unit = world.units.find((u) => u.id === id);
      const building = world.buildings.find((b) => b.id === id);
      if (unit) {
        sx += unit.x;
        sy += unit.y;
        count += 1;
      } else if (building) {
        sx += building.x;
        sy += building.y;
        count += 1;
      }
    }
    if (count) this.host.getRenderer().focus(sx / count, sy / count);
  }
}

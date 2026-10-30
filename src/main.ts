import './style.css';
import { buildingsOf, canPlaceBuilding, createWorld, drainEvents, runTicks, spawnBuilding, spawnUnit, stateHash, unitsOf, updateFog } from './sim/world';
import type { CivilizationId, Command, Difficulty, GameEvent, MatchOptions, Unit, World } from './sim/types';
import { AudioEngine } from './audio/audio';
import { Renderer } from './render/renderer';
import { Hud, type MatchSettings, type PersistedSettings } from './ui/hud';
import { Input, type InputHost } from './ui/input';

const SPEEDS = [1, 1.5, 2];
const TICK = 1 / 30;

class Game implements InputHost {
  private renderer: Renderer;
  private hud: Hud;
  private input: Input;
  private audio = new AudioEngine();
  private world: World | null = null;
  private preview: World;
  private paused = false;
  private speed = 1;
  private accumulator = 0;
  private lastTime = 0;
  private started = false;
  private resultsShown = false;
  private currentSettings: MatchSettings = { playerCiv: 'aurelians', difficulty: 'normal', seed: 20261030 };
  private reducedMotion = false;

  constructor() {
    const canvas = document.getElementById('world') as HTMLCanvasElement;
    const minimap = document.getElementById('minimap') as HTMLCanvasElement;
    this.renderer = new Renderer(canvas, minimap);
    this.preview = this.makePreview();
    this.renderer.attach(this.preview);
    this.hud = new Hud(
      {
        onStart: (settings) => this.startMatch(settings),
        onPause: () => this.togglePause(),
        onResume: () => this.resume(),
        onRestart: () => this.restart(),
        onResign: () => this.resign(),
        onReturnToTitle: () => this.returnToTitle(),
        onHelp: () => this.showHelp(),
        onSpeed: () => this.cycleSpeed(),
        onMute: () => this.toggleMute(),
        onAction: (action) => this.handleAction(action),
        onSettings: (settings) => this.applySettings(settings),
      },
      this.loadSettings(),
    );
    this.reducedMotion = this.hud.settingsSnapshot.reducedMotion;
    this.renderer.state.reducedMotion = this.reducedMotion;
    this.renderer.state.highContrast = this.hud.settingsSnapshot.highContrast;
    this.audio.setMuted(this.hud.settingsSnapshot.muted);
    this.input = new Input(this);
    this.hud.setSpeedLabel('1×');
    this.exposeDebugApi();
    requestAnimationFrame((time) => this.frame(time));
  }

  private makePreview(): World {
    return createWorld({
      seed: 20261030,
      difficulty: 'normal',
      playerCiv: 'aurelians',
      aiCiv: 'nordveld',
      playerName: 'Aurelian Court',
      aiName: 'Nordveld Host',
    });
  }

  private frame(time: number): void {
    const dt = this.lastTime === 0 ? 0 : Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.input.update(dt);
    if (this.started && this.world && !this.paused && this.world.result === 'playing') {
      this.accumulator += dt * this.speed;
      let steps = 0;
      while (this.accumulator >= TICK && steps < 6) {
        runTicks(this.world, 1);
        this.accumulator -= TICK;
        steps += 1;
      }
      const events = drainEvents(this.world);
      if (events.length) {
        this.handleEvents(events);
      }
    }
    const renderWorld = this.started && this.world ? this.world : this.preview;
    const selected = this.world ? this.getSelectedEntities(this.world) : [];
    this.renderer.state.reducedMotion = this.reducedMotion;
    this.renderer.render(renderWorld, this.accumulator / TICK, time / 1000, dt);
    if (this.world) {
      this.hud.update(this.world, selected, this.paused, `${this.speed}×`);
      if (this.world.result !== 'playing' && !this.resultsShown) {
        this.resultsShown = true;
        this.audio.play(this.world.result === 'victory' ? 'victory' : 'defeat');
        this.hud.showResults(this.world);
      }
    }
    requestAnimationFrame((next) => this.frame(next));
  }

  private handleEvents(events: GameEvent[]): void {
    this.renderer.handleEvents(events);
    for (const event of events) {
      if (event.type === 'attack') {
        this.audio.play(event.ranged ? 'arrow' : 'sword');
      } else if (event.type === 'death') {
        this.audio.play('sword');
      } else if (event.type === 'trained' || event.type === 'built') {
        this.audio.play('ready');
      } else if (event.type === 'deposit') {
        this.audio.play('click');
      } else if (event.type === 'ageUp' && event.kingdom === 0) {
        this.audio.play('age');
        this.hud.notify(`Your kingdom enters the ${event.age === 1 ? 'Feudal' : 'Castle'} Age.`, 'good');
      } else if (event.type === 'research' && event.kingdom === 0) {
        this.audio.play('ready');
      } else if (event.type === 'underAttack' && event.kingdom === 0) {
        this.audio.play('error');
        this.hud.notify('Your lands are under attack.', 'warn');
      } else if (event.type === 'notEnough' && event.kingdom === 0) {
        this.audio.play('error');
        this.hud.toast(event.reason, 'warn');
      } else if (event.type === 'farmExhausted' && event.kingdom === 0) {
        this.hud.notify('A farm has been exhausted. Rebuild it to keep the food flowing.', 'warn');
      } else if (event.type === 'message' && event.kingdom === 0) {
        this.hud.notify(event.text);
      }
    }
  }

  private startMatch(settings: MatchSettings): void {
    const aiCiv = (['aurelians', 'nordveld', 'kaldari'] as const).find((c) => c !== settings.playerCiv) ?? 'nordveld';
    const playerName = settings.playerCiv === 'aurelians' ? 'Aurelian Court' : settings.playerCiv === 'nordveld' ? 'Nordveld Hold' : 'Kaldari Concord';
    const aiName = aiCiv === 'aurelians' ? 'Aurelian Court' : aiCiv === 'nordveld' ? 'Nordveld Hold' : 'Kaldari Concord';
    const options: MatchOptions = {
      seed: settings.seed >>> 0,
      difficulty: settings.difficulty,
      playerCiv: settings.playerCiv,
      aiCiv,
      playerName,
      aiName,
    };
    this.currentSettings = settings;
    this.world = createWorld(options);
    this.renderer.attach(this.world);
    this.renderer.state.reducedMotion = this.reducedMotion;
    this.hud.showGame(this.world);
    this.hud.setSpeedLabel('1×');
    this.hud.hideModal();
    this.started = true;
    this.paused = false;
    this.speed = 1;
    this.accumulator = 0;
    this.resultsShown = false;
    this.buildMode = null;
    this.hud.setBuildMode(null);
    this.canvasElement().classList.remove('building', 'attack-move');
    this.audio.init();
    this.audio.setMuted(this.hud.settingsSnapshot.muted);
    this.hud.notify('The chronicle opens. Gather, build, and take the enemy gates.', 'info');
  }

  private pause(): void {
    if (!this.started || !this.world || this.world.result !== 'playing') return;
    this.paused = true;
    this.hud.showPause();
  }

  private resume(): void {
    this.paused = false;
    this.hud.hideModal();
  }

  private restart(): void {
    const settings = this.currentSettings;
    this.hud.hideModal();
    this.startMatch(settings);
  }

  private resign(): void {
    if (!this.world) return;
    this.world.commands.push({ type: 'resign', kingdom: 0 });
    this.paused = false;
    this.hud.hideModal();
  }

  private returnToTitle(): void {
    this.started = false;
    this.paused = false;
    this.world = null;
    this.preview = this.makePreview();
    this.renderer.attach(this.preview);
    this.hud.showMenu();
  }

  showHelp(): void {
    this.hud.showHelp();
  }

  private cycleSpeed(): void {
    const index = SPEEDS.indexOf(this.speed);
    this.speed = SPEEDS[(index + 1) % SPEEDS.length] ?? 1;
    this.hud.setSpeedLabel(`${this.speed}×`);
    this.hud.toast(`Game speed ${this.speed}×`);
  }

  private toggleMute(): void {
    const muted = !this.hud.settingsSnapshot.muted;
    this.hud.setMuted(muted);
    this.audio.setMuted(muted);
    this.applySettings(this.hud.settingsSnapshot);
    this.hud.toast(muted ? 'Sound muted' : 'Sound on');
  }

  private applySettings(settings: PersistedSettings): void {
    this.reducedMotion = settings.reducedMotion;
    this.renderer.state.reducedMotion = settings.reducedMotion;
    this.renderer.state.highContrast = settings.highContrast;
    this.audio.setMuted(settings.muted);
    try {
      localStorage.setItem('epoch.settings', JSON.stringify(settings));
    } catch {
      // Storage may be unavailable in private browsing; preferences stay in memory.
    }
  }

  private loadSettings(): PersistedSettings {
    try {
      const raw = localStorage.getItem('epoch.settings');
      if (!raw) return { muted: false, reducedMotion: false, highContrast: false };
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      return {
        muted: Boolean(parsed.muted),
        reducedMotion: Boolean(parsed.reducedMotion),
        highContrast: Boolean(parsed.highContrast),
      };
    } catch {
      return { muted: false, reducedMotion: false, highContrast: false };
    }
  }

  private handleAction(action: import('./ui/hud').HudAction): void {
    const world = this.world;
    if (!world) return;
    const selected = this.getSelection();
    switch (action.type) {
      case 'build':
        this.setBuildMode(action.building);
        break;
      case 'train':
        this.issue({ type: 'train', kingdom: 0, buildingId: action.buildingId, unit: action.unit });
        break;
      case 'research':
        this.issue({ type: 'research', kingdom: 0, buildingId: action.buildingId, tech: action.tech });
        break;
      case 'ageUp':
        this.issue({ type: 'ageUp', kingdom: 0, buildingId: action.buildingId });
        break;
      case 'cancel':
        this.issue({ type: 'cancel', kingdom: 0, buildingId: action.buildingId, index: action.index });
        break;
      case 'cancelAge':
        this.issue({ type: 'cancelAge', kingdom: 0, buildingId: action.buildingId });
        break;
      case 'stance':
        this.issue({ type: 'stance', kingdom: 0, ids: selected, stance: action.stance });
        break;
      case 'order':
        if (action.order === 'attackMove') this.setAttackMoveMode(true);
        else this.issue({ type: action.order, kingdom: 0, ids: selected });
        break;
      case 'idle':
        this.idleVillager();
        break;
    }
  }

  getWorld(): World | null {
    return this.started ? this.world : null;
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  getHud(): Hud {
    return this.hud;
  }

  issue(command: Command): void {
    if (!this.world || this.world.result !== 'playing') return;
    this.world.commands.push(command);
    this.audio.play('command');
  }

  setSelection(ids: number[]): void {
    this.renderer.state.selected = new Set(ids);
    this.audio.play(ids.length ? 'select' : 'click');
  }

  getSelection(): number[] {
    return [...this.renderer.state.selected];
  }

  getBuildMode(): import('./sim/types').BuildingKind | null {
    return this.buildMode;
  }

  private buildMode: import('./sim/types').BuildingKind | null = null;

  setBuildMode(mode: import('./sim/types').BuildingKind | null): void {
    this.buildMode = mode;
    this.hud.setBuildMode(mode);
    if (mode) {
      this.renderer.state.attackMoveMode = false;
      this.canvasElement().classList.remove('attack-move');
      this.canvasElement().classList.add('building');
      this.hud.toast(`Placing ${mode === 'townCenter' ? 'Town Center' : mode}`);
    } else {
      this.renderer.state.buildGhost = null;
      this.canvasElement().classList.remove('building');
    }
  }

  setAttackMoveMode(active: boolean): void {
    this.renderer.state.attackMoveMode = active;
    this.canvasElement().classList.toggle('attack-move', active);
    if (active) {
      this.buildMode = null;
      this.hud.setBuildMode(null);
      this.hud.toast('Attack-move: choose a destination');
    }
  }

  isAttackMoveMode(): boolean {
    return this.renderer.state.attackMoveMode;
  }

  isPaused(): boolean {
    return this.paused;
  }

  isOverlayOpen(): boolean {
    return this.hud.isModalOpen || !document.getElementById('title-screen')?.classList.contains('hidden');
  }

  closeOverlay(): void {
    this.hud.closeModal();
  }

  togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  idleVillager(): void {
    if (!this.world) return;
    const villagers = unitsOf(this.world, 0).filter((unit) => unit.type === 'villager');
    const idle = villagers.filter((unit) => unit.order.type === 'idle');
    if (!idle.length) {
      this.hud.toast('Every villager is busy');
      return;
    }
    const next = idle[0]!;
    this.setSelection([next.id]);
    this.renderer.focus(next.x, next.y);
    this.hud.toast(`Villager ${next.id} selected`);
  }

  centerTownCenter(): void {
    if (!this.world) return;
    const tc = this.world.buildings.find((b) => b.kingdom === 0 && b.type === 'townCenter');
    if (tc) this.renderer.focus(tc.x, tc.y);
  }

  private getSelectedEntities(world: World): (Unit | import('./sim/types').Building)[] {
    const out: (Unit | import('./sim/types').Building)[] = [];
    for (const id of this.renderer.state.selected) {
      const unit = world.units.find((u) => u.id === id);
      if (unit) {
        out.push(unit);
        continue;
      }
      const building = world.buildings.find((b) => b.id === id);
      if (building) out.push(building);
    }
    return out;
  }

  private canvasElement(): HTMLCanvasElement {
    return document.getElementById('world') as HTMLCanvasElement;
  }

  private exposeDebugApi(): void {
    const game = this;
    (window as unknown as { __epoch: unknown }).__epoch = {
      start(seed = 20261030, difficulty: Difficulty = 'normal', civ: CivilizationId = 'aurelians') {
        game.startMatch({ seed, difficulty, playerCiv: civ });
        return { ok: true, seed, difficulty, civ };
      },
      state() {
        if (!game.world) return null;
        const w = game.world;
        const player = w.kingdoms[0];
        const ai = w.kingdoms[1];
        return {
          seed: w.seed,
          tick: w.tick,
          time: w.time,
          result: w.result,
          player: {
            stock: { ...player.stock },
            age: player.age,
            villagers: unitsOf(w, 0).filter((u) => u.type === 'villager').length,
            units: unitsOf(w, 0).length,
            buildings: buildingsOf(w, 0).length,
            idleVillagers: unitsOf(w, 0).filter((u) => u.type === 'villager' && u.order.type === 'idle').length,
          },
          ai: {
            villagers: unitsOf(w, 1).filter((u) => u.type === 'villager').length,
            units: unitsOf(w, 1).length,
            buildings: buildingsOf(w, 1).length,
            age: ai.age,
          },
          hash: stateHash(w),
        };
      },
      command(command: Command) {
        game.issue(command);
      },
      step(ticks = 1) {
        if (!game.world) return null;
        for (let i = 0; i < ticks; i += 1) runTicks(game.world, 1);
        const events = drainEvents(game.world);
        game.handleEvents(events);
        return game.world.tick;
      },
      fastForward(seconds = 10) {
        if (!game.world) return null;
        for (let i = 0; i < seconds * 30; i += 1) runTicks(game.world, 1);
        return game.world.tick;
      },
      selection(ids: number[]) {
        game.setSelection(ids);
      },
      villagers() {
        return game.world ? unitsOf(game.world, 0).filter((u) => u.type === 'villager').map((u) => ({ id: u.id, x: u.x, y: u.y, order: u.order.type })) : [];
      },
      nodes() {
        return game.world
          ? game.world.nodes.filter((n) => n.alive).map((n) => ({ id: n.id, node: n.node, x: n.x, y: n.y }))
          : [];
      },
      project(x: number, y: number) {
        return game.renderer.worldToScreen(x, y);
      },
      canPlace(type: import('./sim/types').BuildingKind, x: number, y: number) {
        return game.world ? canPlaceBuilding(game.world, 0, type, x, y) : false;
      },
      reveal() {
        if (!game.world) return;
        game.world.explored[0]!.fill(1);
        game.world.fogDirty = true;
      },
      showcase() {
        if (!game.world) return null;
        const w = game.world;
        game.paused = true;
        w.kingdoms[0].age = 2;
        w.kingdoms[0].stock = { food: 742, wood: 586, gold: 324, stone: 168 };
        w.kingdoms[0].stats.gathered = 4820;
        w.kingdoms[0].stats.trained = 23;
        w.tick = 30 * 418;
        w.time = 418;
        const desired: Array<[import('./sim/types').BuildingKind, number, number]> = [
          ['house', 4, 8],
          ['house', 11, 8],
          ['mill', 4, 11],
          ['lumberCamp', 12, 3],
          ['miningCamp', 13, 11],
          ['barracks', 11, 4],
          ['blacksmith', 3, 4],
          ['tower', 9, 12],
          ['farm', 4, 13],
          ['farm', 13, 8],
        ];
        for (const [type, x, y] of desired) {
          if (canPlaceBuilding(w, 0, type, x, y)) spawnBuilding(w, 0, type, x, y, true);
        }
        const tc = game.world.buildings.find((b) => b.kingdom === 0 && b.type === 'townCenter');
        const spots: Array<[import('./sim/types').UnitKind, number, number]> = [
          ['villager', 6.2, 11.4],
          ['villager', 6.9, 11.8],
          ['villager', 13.2, 12.2],
          ['villager', 12.4, 12.8],
          ['villager', 5.4, 8.6],
          ['villager', 6.1, 9.2],
          ['militia', 9.2, 12.3],
          ['militia', 9.8, 12.6],
          ['militia', 10.3, 12.1],
          ['archer', 8.4, 12.7],
          ['archer', 9.1, 13.1],
          ['knight', 10.3, 10.1],
        ];
        const soldiers: number[] = [];
        for (const [type, x, y] of spots) {
          const u = spawnUnit(w, 0, type, x, y);
          if (type !== 'villager') soldiers.push(u.id);
        }
        if (tc) updateFog(w);
        w.explored[0]!.fill(1);
        w.fogDirty = true;
        game.renderer.state.selected = new Set(soldiers.slice(0, 3));
        if (tc) game.renderer.focus(tc.x + 1.5, tc.y + 2.4);
        game.renderer.camera.zoom = 0.82;
        return { buildings: w.buildings.length, soldiers: soldiers.length, selected: soldiers.slice(0, 3) };
      },
      buildings() {
        return game.world ? buildingsOf(game.world, 0).map((b) => ({ id: b.id, type: b.type, x: b.tileX, y: b.tileY, complete: b.complete, queue: b.queue.length })) : [];
      },
      setPaused(paused: boolean) {
        game.paused = paused;
        if (paused) game.hud.showPause();
        else game.hud.hideModal();
      },
      setSpeed(speed: number) {
        game.speed = Math.max(0.5, Math.min(4, speed));
        game.hud.setSpeedLabel(`${game.speed}×`);
      },
      selectionIds() {
        return game.getSelection();
      },
      focus(x: number, y: number) {
        game.renderer.focus(x, y);
      },
      camera() {
        return { ...game.renderer.camera };
      },
      screenshotReady() {
        return Boolean(game.world);
      },
    };
  }
}

new Game();

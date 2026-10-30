import {
  AGE_COST,
  AGE_NAMES,
  BUILDING_DEFS,
  BUILDABLE_BY_VILLAGER,
  CIVS,
  DIFFICULTY_DEFS,
  RESOURCE_META,
  RESOURCES,
  TECH_DEFS,
  UNIT_DEFS,
  ageName,
  costOf,
  missingResource,
} from '../sim/content';
import type {
  Building,
  BuildingKind,
  CivilizationId,
  Difficulty,
  Stance,
  TechId,
  Unit,
  UnitKind,
  World,
} from '../sim/types';
import { populationCap, populationUsed, queuedPopulation, unitStats, villagersOf } from '../sim/world';
import { actionIcon, buildingIcon, resourceIcon, techIcon, unitIcon } from './icons';

export interface MatchSettings {
  playerCiv: CivilizationId;
  difficulty: Difficulty;
  seed: number;
}

export interface PersistedSettings {
  muted: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

export type HudAction =
  | { type: 'build'; building: BuildingKind }
  | { type: 'train'; unit: UnitKind; buildingId: number }
  | { type: 'research'; tech: TechId; buildingId: number }
  | { type: 'ageUp'; buildingId: number }
  | { type: 'cancel'; buildingId: number; index: number }
  | { type: 'cancelAge'; buildingId: number }
  | { type: 'order'; order: 'stop' | 'hold' | 'attackMove' }
  | { type: 'stance'; stance: Stance }
  | { type: 'idle' };

export interface HudCallbacks {
  onStart(settings: MatchSettings): void;
  onPause(): void;
  onResume(): void;
  onRestart(): void;
  onResign(): void;
  onReturnToTitle(): void;
  onHelp(): void;
  onSpeed(): void;
  onMute(): void;
  onAction(action: HudAction): void;
  onSettings(settings: PersistedSettings): void;
}

const BUILD_KEYS = ['Q', 'E', 'R', 'T', 'F', 'G', 'Z', 'C', 'V', 'B', 'N'];

interface CardButton {
  key: string;
  label: string;
  hotkey: string;
  icon: string;
  cost?: string;
  disabled?: boolean;
  reason?: string;
  tip?: string;
  action: HudAction;
  className?: string;
}

export class Hud {
  private root: HTMLElement;
  private titleEl: HTMLElement;
  private hudEl: HTMLElement;
  private modal: HTMLElement;
  private modalTitle: HTMLElement;
  private modalBody: HTMLElement;
  private tooltip: HTMLElement;
  private toastEl: HTMLElement;
  private callbacks: HudCallbacks;
  private selectedCiv: CivilizationId = 'aurelians';
  private selectedDifficulty: Difficulty = 'normal';
  private seed = 20261030;
  private settings: PersistedSettings = { muted: false, reducedMotion: false, highContrast: false };
  private world: World | null = null;
  private selected: (Unit | Building)[] = [];
  private cardKey = '';
  private cardButtons: CardButton[] = [];
  private buildMode: BuildingKind | null = null;
  private paused = false;
  private helpOpen = false;
  private objectivesCollapsed = false;
  private notificationTimers: number[] = [];
  private toastTimer = 0;
  private lastSelectionSignature = '';
  private lastCommandRefresh = 0;
  private speedLabel = '1×';
  private modalKind: 'pause' | 'results' | 'help' | 'settings' | null = null;

  constructor(callbacks: HudCallbacks, settings: PersistedSettings) {
    this.callbacks = callbacks;
    this.settings = { ...settings };
    this.root = document.getElementById('app')!;
    this.titleEl = document.getElementById('title-screen')!;
    this.hudEl = document.getElementById('hud')!;
    this.modal = document.getElementById('modal')!;
    this.modalTitle = document.getElementById('modal-title')!;
    this.modalBody = document.getElementById('modal-body')!;
    this.tooltip = document.getElementById('tooltip')!;
    this.toastEl = document.getElementById('toast')!;
    this.buildMenu();
    this.wireStaticControls();
    this.applySettings();
  }

  private q<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
  }

  private buildMenu(): void {
    const civList = this.q('civ-list');
    civList.innerHTML = '';
    for (const id of Object.keys(CIVS) as CivilizationId[]) {
      const civ = CIVS[id];
      const button = document.createElement('button');
      button.className = `civ-card${id === this.selectedCiv ? ' selected' : ''}`;
      button.style.setProperty('--accent', civ.accent);
      button.dataset.civ = id;
      button.innerHTML = `
        <span>
          <div class="civ-name">${civ.name}</div>
          <div class="civ-motto">${civ.title}</div>
          <div class="civ-bonus">${civ.bonus}</div>
          <div class="civ-desc">${civ.description}</div>
        </span>
        <span class="civ-mark">${id === this.selectedCiv ? '◆' : '◇'}</span>`;
      button.addEventListener('click', () => {
        this.selectedCiv = id;
        for (const el of civList.querySelectorAll<HTMLElement>('.civ-card')) {
          el.classList.toggle('selected', el.dataset.civ === id);
          const mark = el.querySelector('.civ-mark');
          if (mark) mark.textContent = el.dataset.civ === id ? '◆' : '◇';
        }
      });
      civList.appendChild(button);
    }

    const difficulty = this.q('difficulty-list');
    difficulty.innerHTML = '';
    for (const id of ['easy', 'normal', 'hard'] as Difficulty[]) {
      const def = DIFFICULTY_DEFS[id];
      const button = document.createElement('button');
      button.textContent = def.name;
      button.className = id === this.selectedDifficulty ? 'selected' : '';
      button.addEventListener('click', () => {
        this.selectedDifficulty = id;
        for (const el of difficulty.querySelectorAll('button')) el.classList.toggle('selected', el.textContent === def.name);
      });
      difficulty.appendChild(button);
    }

    const seedInput = this.q<HTMLInputElement>('seed-input');
    seedInput.value = String(this.seed);
    this.q('seed-random').addEventListener('click', () => {
      this.seed = Math.floor(Math.random() * 999999999);
      seedInput.value = String(this.seed);
    });
    this.q('start-button').addEventListener('click', () => {
      const parsed = Number.parseInt(seedInput.value.replace(/[^0-9]/g, ''), 10);
      this.seed = Number.isFinite(parsed) ? parsed : 20261030;
      this.callbacks.onStart({
        playerCiv: this.selectedCiv,
        difficulty: this.selectedDifficulty,
        seed: this.seed,
      });
    });
    this.q('title-help').addEventListener('click', () => this.callbacks.onHelp());
    this.q('title-settings').addEventListener('click', () => this.showSettings());
  }

  private wireStaticControls(): void {
    this.q('pause-button').addEventListener('click', () => this.callbacks.onPause());
    this.q('speed-button').addEventListener('click', () => this.callbacks.onSpeed());
    this.q('mute-button').addEventListener('click', () => this.callbacks.onMute());
    this.q('help-button').addEventListener('click', () => this.callbacks.onHelp());
    this.q('idle-button').addEventListener('click', () => this.callbacks.onAction({ type: 'idle' }));
    this.q('modal-close').addEventListener('click', () => this.closeModal());
    this.q('objectives-toggle').addEventListener('click', () => {
      this.objectivesCollapsed = !this.objectivesCollapsed;
      this.q('objectives').classList.toggle('collapsed', this.objectivesCollapsed);
      this.q('objectives-toggle').textContent = this.objectivesCollapsed ? '+' : '–';
    });
    this.q('command-grid').addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action-index]');
      if (!target) return;
      const index = Number(target.dataset.actionIndex);
      const button = this.cardButtons[index];
      if (!button || button.disabled) return;
      this.callbacks.onAction(button.action);
    });
    this.q('command-grid').addEventListener('mouseover', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action-index]');
      if (!target) return;
      const index = Number(target.dataset.actionIndex);
      const button = this.cardButtons[index];
      if (button) this.showTooltip(button, target);
    });
    this.q('command-grid').addEventListener('mouseout', () => this.hideTooltip());
    this.q('command-grid').addEventListener('focusin', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action-index]');
      if (!target) return;
      const button = this.cardButtons[Math.min(Number(target.dataset.actionIndex), this.cardButtons.length - 1)];
      if (button) this.showTooltip(button, target);
    });
    this.q('command-grid').addEventListener('focusout', () => this.hideTooltip());
    this.q('modal').addEventListener('click', (event) => {
      if (event.target === this.modal) this.closeModal();
    });
    document.getElementById('set-muted')?.addEventListener('change', (event) => {
      this.settings.muted = (event.target as HTMLInputElement).checked;
      this.callbacks.onSettings(this.settings);
      this.callbacks.onMute();
    });
    document.getElementById('set-motion')?.addEventListener('change', (event) => {
      this.settings.reducedMotion = (event.target as HTMLInputElement).checked;
      this.applySettings();
      this.callbacks.onSettings(this.settings);
    });
    document.getElementById('set-contrast')?.addEventListener('change', (event) => {
      this.settings.highContrast = (event.target as HTMLInputElement).checked;
      this.applySettings();
      this.callbacks.onSettings(this.settings);
    });
  }

  showMenu(): void {
    this.titleEl.classList.remove('hidden');
    this.hudEl.classList.add('hidden');
    this.hideModal();
  }

  showGame(world: World): void {
    this.world = world;
    this.titleEl.classList.add('hidden');
    this.hudEl.classList.remove('hidden');
    this.q('map-seed').textContent = `seed ${world.seed}`;
    this.cardKey = '';
    this.lastSelectionSignature = '';
  }

  hideGame(): void {
    this.hudEl.classList.add('hidden');
    this.titleEl.classList.remove('hidden');
  }

  setSpeedLabel(label: string): void {
    this.speedLabel = label;
    this.q('speed-button').textContent = label;
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.q('mute-button').textContent = muted ? '×' : '♪';
    const hiddenMute = document.getElementById('mute-check') as HTMLInputElement | null;
    if (hiddenMute) hiddenMute.checked = muted;
  }

  setBuildMode(mode: BuildingKind | null): void {
    this.buildMode = mode;
    if (mode) {
      this.q('command-context').textContent = `Place ${BUILDING_DEFS[mode].name}`;
      this.q('queue-summary').textContent = 'Left-click to place · Esc or right-click to cancel';
    } else {
      this.cardKey = '';
    }
  }

  togglePause(paused: boolean): void {
    this.paused = paused;
    this.q('pause-button').textContent = paused ? '▶' : '❚❚';
  }

  update(world: World, selected: (Unit | Building)[], paused: boolean, speed: string): void {
    this.world = world;
    this.paused = paused;
    this.speedLabel = speed;
    this.updateResources(world);
    this.updateClock(world);
    this.updateObjectives(world);
    this.updateSelection(world, selected);
    const signature = selected.map((e) => e.id).sort((a, b) => a - b).join(',') + `|${world.kingdoms[0].age}|${selected.map((e) => (e.kind === 'building' ? e.queue.length + (e.research ? 1 : 0) : 0)).join(',')}|${this.buildMode ?? ''}`;
    if (signature !== this.cardKey) {
      this.cardKey = signature;
      this.renderCommandCard(world, selected);
    } else {
      this.refreshCard(world);
    }
    this.updateQueue(world, selected);
    this.q('speed-button').textContent = speed;
    this.q('pause-button').textContent = paused ? '▶' : '❚❚';
    this.q('mute-button').textContent = this.settings.muted ? '×' : '♪';
    this.q('idle-count').textContent = `Idle villagers: ${villagersOf(world, 0).filter((v) => v.order.type === 'idle').length}`;
    void this.lastCommandRefresh;
  }

  private updateResources(world: World): void {
    const strip = this.q('resources');
    if (!strip.dataset.ready) {
      strip.dataset.ready = '1';
      strip.innerHTML = RESOURCES.map(
        (resource) =>
          `<div class="resource ${resource}" data-res="${resource}"><span class="icon">${resourceIcon(resource)}</span><span class="amount">0</span></div>`,
      ).join('');
    }
    const stock = world.kingdoms[0].stock;
    for (const resource of RESOURCES) {
      const el = strip.querySelector(`[data-res="${resource}"]`)!;
      const amount = el.querySelector('.amount')!;
      amount.textContent = String(Math.floor(stock[resource]));
      el.classList.toggle('warn', stock[resource] < 20);
    }
    const used = populationUsed(world, 0) + queuedPopulation(world, 0);
    const cap = populationCap(world, 0);
    this.q('age-label').textContent = ageName(world.kingdoms[0].age);
    this.q('pop-chip').innerHTML = `<span>POP</span><strong>${used}</strong><span style="opacity:.55">/ ${cap}</span>`;
    this.q('pop-chip').classList.toggle('capped', used >= cap);
  }

  private updateClock(world: World): void {
    const seconds = Math.floor(world.time);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    this.q('clock').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private updateObjectives(world: World): void {
    const villagers = villagersOf(world, 0).length;
    const houses = world.buildings.filter((b) => b.alive && b.kingdom === 0 && b.type === 'house' && b.complete).length;
    const age = world.kingdoms[0].age;
    const army = world.units.filter((u) => u.alive && u.kingdom === 0 && u.type !== 'villager').length;
    const enemyTC = world.buildings.filter((b) => b.alive && b.kingdom === 1 && b.type === 'townCenter').length;
    const steps = [
      { text: 'Gather your first resources', done: world.kingdoms[0].stats.gathered > 0, progress: '' },
      { text: 'Train five villagers', done: villagers >= 5, progress: `${Math.min(villagers, 5)}/5` },
      { text: 'Raise a House', done: houses > 0, progress: houses > 0 ? '' : '0/1' },
      { text: 'Reach the Feudal Age', done: age >= 1, progress: age >= 1 ? '' : `${Math.floor(world.kingdoms[0].stock.food)}/500 food` },
      { text: 'Field five soldiers', done: army >= 5, progress: `${Math.min(army, 5)}/5` },
      { text: 'Destroy the enemy Town Center', done: enemyTC === 0, progress: '' },
    ];
    const visible = steps.filter((step, index) => index < 4 || !step.done).slice(0, 5);
    this.q('objective-list').innerHTML = visible
      .map(
        (step) =>
          `<li class="${step.done ? 'done' : ''}"><span class="mark">${step.done ? '✓' : '·'}</span><span class="obj-text">${step.text}</span><span class="obj-progress">${step.progress}</span></li>`,
      )
      .join('');
  }

  private updateSelection(world: World, selected: (Unit | Building)[]): void {
    this.selected = selected;
    const title = this.q('selection-title');
    const count = this.q('selection-count');
    const body = this.q('selection-body');
    if (!selected.length) {
      title.textContent = 'No selection';
      count.textContent = '';
      body.innerHTML = `<p class="hint">Left-click a villager, soldier, or building. Drag to select a group.</p><p class="hint">Right-click to move, gather, attack, or set a rally point.</p><p class="hint">When your Town Center is selected, the command card trains new villagers.</p>`;
      return;
    }
    if (selected.length > 1) {
      title.textContent = 'War band';
      count.textContent = `${selected.length} selected`;
      const groups = new Map<string, number>();
      for (const entity of selected) {
        const key = entity.kind === 'unit' ? entity.type : entity.type;
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
      const chips = [...groups.entries()]
        .map(([key, n]) => {
          const icon = key in UNIT_DEFS ? unitIcon(key as UnitKind) : buildingIcon(key as BuildingKind);
          return `<span class="group-chip"><span style="display:inline-flex;width:14px;height:14px">${icon}</span>${key in UNIT_DEFS ? UNIT_DEFS[key as UnitKind].name : BUILDING_DEFS[key as BuildingKind].name} ×${n}</span>`;
        })
        .join('');
      const quantities = selected
        .filter((e) => e.kind === 'unit')
        .reduce(
          (acc, unit) => {
            if (unit.kind === 'unit') acc.hp += unit.hp / unit.maxHp;
            return acc;
          },
          { hp: 0 },
        );
      const hpRatio = quantities.hp / Math.max(1, selected.filter((e) => e.kind === 'unit').length);
      body.innerHTML = `<div class="group-list">${chips}</div>
        <div class="hp-row"><div class="hp-track"><div class="hp-fill ${hpRatio < 0.35 ? 'critical' : hpRatio < 0.7 ? 'damaged' : ''}" style="width:${Math.round(hpRatio * 100)}%"></div></div><span class="hp-text">${Math.round(hpRatio * 100)}%</span></div>
        <div class="status-line"><span>Orders apply to the whole group.</span><strong>Right-click to move</strong></div>`;
      return;
    }

    const entity = selected[0]!;
    if (entity.kind === 'unit') {
      const def = UNIT_DEFS[entity.type];
      const stats = unitStats(world, entity);
      title.textContent = def.name;
      count.textContent = entity.kingdom === 0 ? 'Your unit' : 'Enemy';
      const order = entity.order.type === 'gather' ? 'Gathering' : entity.order.type === 'build' ? 'Building' : entity.order.type === 'repair' ? 'Repairing' : entity.order.type === 'attack' ? 'Attacking' : entity.order.type === 'move' ? 'Moving' : entity.order.type === 'hold' ? 'Holding' : entity.path.length ? 'Moving' : 'Idle';
      const status = entity.carryKind
        ? `Carrying ${Math.floor(entity.carryAmount)} ${RESOURCE_META[entity.carryKind].name.toLowerCase()}`
        : entity.type === 'villager'
          ? 'Economy unit'
          : `Attack ${stats.attack} · Armour ${stats.meleeArmor}/${stats.pierceArmor}`;
      const stance = entity.stance === 'aggressive' ? 'Aggressive' : entity.stance === 'defensive' ? 'Defensive' : 'Stand ground';
      body.innerHTML = `
        <div class="selection-identity">
          <div class="selection-icon">${unitIcon(entity.type)}</div>
          <div><div class="selection-name">${def.name}</div><div class="selection-sub">${entity.kingdom === 0 ? 'Aurelian levy' : 'Enemy'}</div></div>
        </div>
        <div class="hp-row"><div class="hp-track"><div class="hp-fill ${entity.hp / entity.maxHp < 0.3 ? 'critical' : entity.hp / entity.maxHp < 0.65 ? 'damaged' : ''}" style="width:${Math.round((entity.hp / entity.maxHp) * 100)}%"></div></div><span class="hp-text">${Math.ceil(entity.hp)} / ${entity.maxHp}</span></div>
        <div class="status-line"><span>${status}</span><strong>${order}</strong></div>
        <div class="status-line"><span>Stance: ${stance}</span><span>${entity.type === 'villager' ? 'Right-click a resource' : `Range ${stats.range.toFixed(1)}`}</span></div>`;
    } else {
      const def = BUILDING_DEFS[entity.type];
      const hpRatio = entity.hp / entity.maxHp;
      title.textContent = def.name;
      count.textContent = entity.kingdom === 0 ? 'Your building' : 'Enemy';
      const status = !entity.complete
        ? `Under construction — ${Math.round(entity.progress * 100)}%`
        : entity.queue.length
          ? `Training ${UNIT_DEFS[entity.queue[0]!.unit].name}`
          : entity.research
            ? `Researching ${TECH_DEFS[entity.research.tech].name}`
            : entity.ageResearch
              ? `Advancing to ${AGE_NAMES[entity.ageResearch.age]}`
              : 'Idle';
      const detail = entity.type === 'farm' ? `Farm food ${Math.floor(entity.farmFood)} / 300` : entity.rally ? 'Rally point set' : 'No rally point';
      body.innerHTML = `
        <div class="selection-identity">
          <div class="selection-icon">${buildingIcon(entity.type)}</div>
          <div><div class="selection-name">${def.name}</div><div class="selection-sub">${entity.kingdom === 0 ? 'Your settlement' : 'Enemy structure'}</div></div>
        </div>
        <div class="hp-row"><div class="hp-track"><div class="hp-fill ${hpRatio < 0.3 ? 'critical' : hpRatio < 0.65 ? 'damaged' : ''}" style="width:${Math.round(hpRatio * 100)}%"></div></div><span class="hp-text">${Math.ceil(entity.hp)} / ${entity.maxHp}</span></div>
        <div class="status-line"><span>${detail}</span><strong>${status}</strong></div>
        ${entity.queue.length ? `<div class="queue-chips">${entity.queue.map((item) => `<span class="queue-chip" title="${UNIT_DEFS[item.unit].name}">${unitIcon(item.unit)}</span>`).join('')}</div>` : ''}`;
    }
  }

  private renderCommandCard(world: World, selected: (Unit | Building)[]): void {
    const buttons = this.computeButtons(world, selected);
    this.cardButtons = buttons;
    const context = this.buildMode
      ? `Place ${BUILDING_DEFS[this.buildMode].name}`
      : selected.length === 0
        ? 'Commands'
        : selected[0]!.kind === 'unit'
          ? selected[0]!.type === 'villager'
            ? 'Villager orders'
            : 'Army orders'
          : BUILDING_DEFS[selected[0]!.type].name;
    this.q('command-context').textContent = context;
    this.q('queue-summary').textContent = this.buildMode
      ? 'Left-click to place · Esc or right-click to cancel'
      : this.queueSummary(world, selected);
    this.q('command-grid').innerHTML = buttons.length
      ? buttons
          .map(
            (button, index) =>
              `<button class="cmd ${button.className ?? ''}" data-action-index="${index}" ${button.disabled ? 'disabled' : ''} title="${button.reason ?? button.tip ?? button.label}">
                <span class="hotkey">${button.hotkey}</span>
                <span class="cmd-icon">${button.icon}</span>
                <span class="cmd-text"><span class="cmd-name">${button.label}</span><span class="cmd-cost">${button.cost ?? ''}</span></span>
              </button>`,
          )
          .join('')
      : `<p class="command-hint">${selected.length ? 'No orders for this selection.' : 'Select a villager to build and gather, a soldier to fight, or the Town Center to train villagers.'}</p>`;
  }

  private refreshCard(world: World): void {
    const now = performance.now();
    if (now - this.lastCommandRefresh < 180) return;
    this.lastCommandRefresh = now;
    const next = this.computeButtons(world, this.selected);
    const previous = this.cardButtons;
    const sameShape =
      next.length === previous.length &&
      next.every((button, index) => button.label === previous[index]!.label && button.hotkey === previous[index]!.hotkey);
    this.cardButtons = next;
    if (sameShape) {
      const elements = this.q('command-grid').querySelectorAll<HTMLButtonElement>('.cmd');
      next.forEach((button, index) => {
        const el = elements[index];
        if (!el) return;
        el.disabled = Boolean(button.disabled);
        el.className = `cmd ${button.className ?? ''}`;
        el.title = (button.reason ?? button.tip ?? button.label).replace(/"/g, '');
        const cost = el.querySelector<HTMLElement>('.cmd-cost');
        if (cost) cost.textContent = button.cost ?? '';
      });
      return;
    }
    this.q('command-grid').innerHTML = next
      .map(
        (button, index) =>
          `<button class="cmd ${button.className ?? ''}" data-action-index="${index}" ${button.disabled ? 'disabled' : ''} title="${(button.reason ?? button.tip ?? button.label).replace(/"/g, '')}">
            <span class="hotkey">${button.hotkey}</span>
            <span class="cmd-icon">${button.icon}</span>
            <span class="cmd-text"><span class="cmd-name">${button.label}</span><span class="cmd-cost">${button.cost ?? ''}</span></span>
          </button>`,
      )
      .join('');
  }

  private computeButtons(world: World, selected: (Unit | Building)[]): CardButton[] {
    const buttons: CardButton[] = [];
    const stock = world.kingdoms[0].stock;
    const age = world.kingdoms[0].age;
    const units = selected.filter((e): e is Unit => e.kind === 'unit');
    const buildings = selected.filter((e): e is Building => e.kind === 'building');
    const villagers = units.filter((u) => u.type === 'villager');
    const military = units.filter((u) => u.type !== 'villager');
    const ownedBuildings = buildings.filter((b) => b.kingdom === 0);

    const add = (
      label: string,
      hotkey: string,
      icon: string,
      action: HudAction,
      cost?: string,
      disabled = false,
      reason?: string,
      tip?: string,
      className?: string,
    ) => {
      buttons.push({ key: `${label}-${buttons.length}`, label, hotkey, icon, action, cost, disabled, reason, tip, className });
    };

    if (villagers.length > 0) {
      const options = BUILDABLE_BY_VILLAGER.filter((kind) => BUILDING_DEFS[kind].age <= age);
      options.forEach((kind, index) => {
        const def = BUILDING_DEFS[kind];
        const missing = missingResource(stock, def.cost);
        add(
          def.name,
          BUILD_KEYS[index] ?? String(index + 1),
          buildingIcon(kind),
          { type: 'build', building: kind },
          costOf(def.cost),
          Boolean(missing),
          missing ? `Not enough ${RESOURCE_META[missing].name.toLowerCase()}` : `Build ${def.name} — ${def.description}`,
          def.description,
        );
      });
      add('Stop', 'X', actionIcon('stop'), { type: 'order', order: 'stop' }, undefined, false, undefined, 'Stop the selected villagers.');
      const actionMove = buildings.find((b) => b.complete && b.kingdom === 0 && b.type === 'townCenter');
      if (actionMove) {
        add('Rally', 'V', actionIcon('rally'), { type: 'order', order: 'stop' }, undefined, true, 'Right-click the ground with a production building selected.', 'Rally points are set by right-clicking the ground while a production building is selected.');
      }
      return buttons;
    }

    if (military.length > 0) {
      add('Attack-move', 'Q', actionIcon('attackMove'), { type: 'order', order: 'attackMove' }, undefined, false, undefined, 'Move to a point, engaging enemies on the way.');
      add('Stop', 'E', actionIcon('stop'), { type: 'order', order: 'stop' });
      add('Hold', 'R', actionIcon('hold'), { type: 'order', order: 'hold' });
      add('Aggressive', 'Z', actionIcon('aggressive'), { type: 'stance', stance: 'aggressive' }, undefined, false, undefined, 'Chase enemies within a wide radius.');
      add('Defensive', 'X', actionIcon('defensive'), { type: 'stance', stance: 'defensive' }, undefined, false, undefined, 'Engage only near the unit’s post.');
      add('Stand ground', 'C', actionIcon('standGround'), { type: 'stance', stance: 'standGround' }, undefined, false, undefined, 'Never leave the current position.');
      return buttons;
    }

    const production = ownedBuildings.find((b) => b.complete && (BUILDING_DEFS[b.type].trains.length > 0 || BUILDING_DEFS[b.type].researches.length > 0 || b.type === 'townCenter'));
    if (production) {
      const def = BUILDING_DEFS[production.type];
      if (production.type === 'townCenter') {
        const missing = missingResource(stock, UNIT_DEFS.villager.cost);
        add('Villager', 'Q', unitIcon('villager'), { type: 'train', unit: 'villager', buildingId: production.id }, costOf(UNIT_DEFS.villager.cost), Boolean(missing) || populationUsed(world, 0) + queuedPopulation(world, 0) >= populationCap(world, 0), missing ? `Not enough ${RESOURCE_META[missing].name.toLowerCase()}` : 'Population cap reached — build a House', 'Train a villager to gather and build.');
        if (age < 2) {
          const next = (age + 1) as 1 | 2;
          const cost = AGE_COST[next];
          const missingAge = missingResource(stock, cost.cost);
          add(
            `Advance: ${AGE_NAMES[next]}`,
            'E',
            actionIcon('age'),
            { type: 'ageUp', buildingId: production.id },
            costOf(cost.cost),
            Boolean(missingAge) || Boolean(production.ageResearch),
            production.ageResearch ? 'Already advancing' : missingAge ? `Not enough ${RESOURCE_META[missingAge].name.toLowerCase()}` : undefined,
            next === 1 ? 'Unlocks archers, cavalry, and the Watch Tower.' : 'Unlocks Knights and Battering Rams.',
          );
        }
        for (const tech of def.researches) {
          const t = TECH_DEFS[tech];
          if (world.kingdoms[0].techs.includes(tech)) continue;
          const missingTech = missingResource(stock, t.cost);
          add(t.name, tech === 'loom' ? 'R' : 'T', techIcon(tech), { type: 'research', tech, buildingId: production.id }, costOf(t.cost), Boolean(missingTech) || Boolean(production.research), production.research ? 'Research in progress' : missingTech ? `Not enough ${RESOURCE_META[missingTech].name.toLowerCase()}` : undefined, t.description);
        }
      } else {
        def.trains.forEach((unit, index) => {
          const u = UNIT_DEFS[unit];
          if (u.age > age) return;
          const missing = missingResource(stock, u.cost);
          const popBlocked = populationUsed(world, 0) + queuedPopulation(world, 0) + u.pop > populationCap(world, 0);
          add(
            u.name,
            ['Q', 'E', 'R'][index] ?? String(index + 1),
            unitIcon(unit),
            { type: 'train', unit, buildingId: production.id },
            costOf(u.cost),
            Boolean(missing) || popBlocked,
            missing ? `Not enough ${RESOURCE_META[missing].name.toLowerCase()}` : popBlocked ? 'Population cap reached' : undefined,
            u.description,
          );
        });
        def.researches.forEach((tech, index) => {
          const t = TECH_DEFS[tech];
          if (t.age > age || world.kingdoms[0].techs.includes(tech)) return;
          const missing = missingResource(stock, t.cost);
          add(t.name, ['Q', 'E', 'R'][index] ?? String(index + 1), techIcon(tech), { type: 'research', tech, buildingId: production.id }, costOf(t.cost), Boolean(missing) || Boolean(production.research), missing ? `Not enough ${RESOURCE_META[missing].name.toLowerCase()}` : production.research ? 'Research in progress' : undefined, t.description);
        });
      }
      if (production.queue.length > 0) {
        add('Cancel', 'X', actionIcon('cancel'), { type: 'cancel', buildingId: production.id, index: production.queue.length - 1 }, undefined, false, undefined, 'Cancel the last queued unit (full refund).');
      }
      if (production.ageResearch) {
        add('Cancel age', 'C', actionIcon('cancelAge'), { type: 'cancelAge', buildingId: production.id }, undefined, false, undefined, 'Cancel the age advance for a partial refund.');
      }
      return buttons;
    }

    if (ownedBuildings.length > 0) {
      const building = ownedBuildings[0]!;
      if (building.type === 'farm' && building.farmFood <= 0) {
        add('Rebuild farm', 'Q', buildingIcon('farm'), { type: 'order', order: 'stop' }, undefined, true, 'Select a villager and build a new farm.', 'A spent farm must be replaced.');
      }
      return buttons;
    }
    return buttons;
  }

  private queueSummary(world: World, selected: (Unit | Building)[]): string {
    const building = selected.find((e): e is Building => e.kind === 'building');
    if (!building) return '';
    if (building.ageResearch) return `${AGE_NAMES[building.ageResearch.age]} in ${Math.ceil(building.ageResearch.remaining)}s`;
    if (building.research) return `${TECH_DEFS[building.research.tech].name} in ${Math.ceil(building.research.remaining)}s`;
    if (building.queue.length) return `${building.queue.length} in queue`;
    if (!building.complete) return `${Math.round(building.progress * 100)}% built`;
    return '';
  }

  private updateQueue(world: World, selected: (Unit | Building)[]): void {
    const building = selected.find((e): e is Building => e.kind === 'building' && e.kingdom === 0);
    const el = this.q('queue-list');
    if (!building || (!building.queue.length && !building.research && !building.ageResearch)) {
      el.innerHTML = '';
      return;
    }
    const items: string[] = [];
    if (building.ageResearch) {
      const pct = Math.round((1 - building.ageResearch.remaining / building.ageResearch.total) * 100);
      items.push(`<span class="queue-item">${actionIcon('age')} ${AGE_NAMES[building.ageResearch.age]} <span class="bar"><i style="width:${pct}%"></i></span> ${Math.ceil(building.ageResearch.remaining)}s</span>`);
    }
    if (building.research) {
      const pct = Math.round((1 - building.research.remaining / building.research.total) * 100);
      items.push(`<span class="queue-item">${techIcon(building.research.tech)} ${TECH_DEFS[building.research.tech].name} <span class="bar"><i style="width:${pct}%"></i></span> ${Math.ceil(building.research.remaining)}s</span>`);
    }
    building.queue.forEach((item, index) => {
      const pct = Math.round((1 - item.remaining / item.total) * 100);
      items.push(
        `<button class="queue-item" data-cancel-index="${index}" title="Cancel — full refund">${unitIcon(item.unit)} ${UNIT_DEFS[item.unit].name} <span class="bar"><i style="width:${pct}%"></i></span> ${Math.ceil(item.remaining)}s ×</button>`,
      );
    });
    el.innerHTML = items.join('');
    void world;
    for (const button of el.querySelectorAll<HTMLElement>('[data-cancel-index]')) {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.cancelIndex);
        this.callbacks.onAction({ type: 'cancel', buildingId: building.id, index });
      });
    }
  }

  notify(text: string, kind: 'info' | 'warn' | 'good' = 'info'): void {
    const container = this.q('notifications');
    const el = document.createElement('div');
    el.className = `notification ${kind}`;
    el.innerHTML = `<span class="n-icon">${kind === 'warn' ? '!' : kind === 'good' ? '✓' : '◆'}</span><span>${text}</span>`;
    container.appendChild(el);
    while (container.children.length > 4) container.firstElementChild?.remove();
    const timer = window.setTimeout(() => {
      el.style.opacity = '0';
      window.setTimeout(() => el.remove(), 250);
    }, 4800);
    this.notificationTimers.push(timer);
  }

  toast(text: string, kind: 'info' | 'warn' = 'info'): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    this.toastEl.classList.toggle('warn', kind === 'warn');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), 2400);
  }

  triggerHotkey(key: string): boolean {
    const normalized = key.toUpperCase();
    const index = this.cardButtons.findIndex((button) => button.hotkey === normalized && !button.disabled);
    if (index < 0) return false;
    this.callbacks.onAction(this.cardButtons[index]!.action);
    return true;
  }

  showPause(): void {
    this.paused = true;
    this.showModal(
      'Paused',
      `<p class="muted">The kingdom waits for your word.</p>
       <div class="modal-actions">
         <button class="primary-button" id="resume-button">Return to the map</button>
         <button class="text-button" id="pause-help">Controls</button>
         <button class="text-button" id="pause-restart">Restart match</button>
         <button class="text-button danger" id="resign-button">Resign</button>
       </div>
       <div class="settings-row">
         <label><input type="checkbox" id="set-muted" ${this.settings.muted ? 'checked' : ''} /> Mute sound</label>
         <label><input type="checkbox" id="set-motion" ${this.settings.reducedMotion ? 'checked' : ''} /> Reduce motion</label>
         <label><input type="checkbox" id="set-contrast" ${this.settings.highContrast ? 'checked' : ''} /> High contrast</label>
       </div>
       <p class="setting-note">Keys: P pause · F1 controls · Esc cancel · Space centre · . idle villager</p>`,
      'pause',
    );
    this.q('resume-button').addEventListener('click', () => this.callbacks.onResume());
    this.q('pause-help').addEventListener('click', () => this.callbacks.onHelp());
    this.q('pause-restart').addEventListener('click', () => this.callbacks.onRestart());
    this.q('resign-button').addEventListener('click', () => this.callbacks.onResign());
    this.bindSettingsInputs();
  }

  showHelp(): void {
    this.helpOpen = true;
    this.showModal(
      'Controls',
      `<div class="help-grid">
        <div>
          <h3>Camera</h3>
          <p><kbd>Arrow keys</kbd> pan · screen edge pans</p>
          <p><kbd>Wheel</kbd> zoom · drag a box to select</p>
          <p><kbd>Space</kbd> centre on Town Center</p>
          <h3>Selection</h3>
          <p><kbd>Left click</kbd> select · drag box-select</p>
          <p><kbd>Shift</kbd> add · double-click select type</p>
          <p><kbd>Ctrl</kbd>/<kbd>Alt</kbd>+<kbd>1–9</kbd> control groups</p>
        </div>
        <div>
          <h3>Commands</h3>
          <p><kbd>Right click</kbd> context command</p>
          <p><kbd>Q</kbd> attack-move · <kbd>E</kbd> stop · <kbd>R</kbd> hold</p>
          <p><kbd>.</kbd> next idle villager</p>
          <p><kbd>P</kbd> pause · <kbd>F1</kbd> controls</p>
          <h3>Economy</h3>
          <p>Villagers carry 10. Return loads to a matching drop-off.</p>
          <p>Houses raise population. Farms feed a growing court.</p>
        </div>
        <div>
          <h3>The match</h3>
          <p>Destroy the enemy Town Center. Lose yours or resign and the match ends.</p>
          <p>Spears beat cavalry, skirmishers beat archers, rams break buildings.</p>
          <p>Scout with cavalry. Fog hides what you have not seen.</p>
          <h3>Victory</h3>
          <p>The fortunes of a kingdom are decided in one field, one hour.</p>
        </div>
      </div>`,
      'help',
    );
  }

  showResults(world: World): void {
    const victory = world.result === 'victory';
    const seconds = Math.floor(world.time);
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const player = world.kingdoms[0];
    this.showModal(
      victory ? 'Victory' : 'Defeat',
      `<p class="muted">${victory ? 'The enemy Town Center has fallen. The Verdant Marches are yours.' : 'Your Town Center is lost. The chronicle closes on this reign.'}</p>
       <div class="result-stats">
         <div class="result-stat"><span>Time</span><strong>${time}</strong></div>
         <div class="result-stat"><span>Resources gathered</span><strong>${Math.floor(player.stats.gathered)}</strong></div>
         <div class="result-stat"><span>Soldiers trained</span><strong>${player.stats.trained}</strong></div>
         <div class="result-stat"><span>Enemies slain</span><strong>${player.stats.kills}</strong></div>
         <div class="result-stat"><span>Buildings razed</span><strong>${player.stats.buildingsDestroyed}</strong></div>
         <div class="result-stat"><span>Seed</span><strong>${world.seed}</strong></div>
       </div>
       <div class="modal-actions" style="justify-content:center">
         <button class="primary-button" id="rematch-button">Play again</button>
         <button class="text-button" id="title-button">Return to title</button>
       </div>
       <p class="seed-note">Same seed + same commands = the same match.</p>`,
      'results',
    );
    this.q('rematch-button').addEventListener('click', () => this.callbacks.onRestart());
    this.q('title-button').addEventListener('click', () => this.callbacks.onReturnToTitle());
  }

  showSettings(): void {
    this.showModal(
      'Settings',
      `<p class="muted">Preferences are stored in this browser.</p>
       <div class="settings-row">
         <label><input type="checkbox" id="set-muted" ${this.settings.muted ? 'checked' : ''} /> Mute sound</label>
         <label><input type="checkbox" id="set-motion" ${this.settings.reducedMotion ? 'checked' : ''} /> Reduce motion</label>
         <label><input type="checkbox" id="set-contrast" ${this.settings.highContrast ? 'checked' : ''} /> High contrast</label>
       </div>
       <p class="setting-note">The game runs entirely in your browser. This build uses a static, original soundtrack synthesized in the page.</p>`,
      'settings',
    );
    this.bindSettingsInputs();
  }

  private bindSettingsInputs(): void {
    document.getElementById('set-muted')?.addEventListener('change', (event) => {
      this.settings.muted = (event.target as HTMLInputElement).checked;
      this.setMuted(this.settings.muted);
      this.callbacks.onSettings(this.settings);
    });
    document.getElementById('set-motion')?.addEventListener('change', (event) => {
      this.settings.reducedMotion = (event.target as HTMLInputElement).checked;
      this.applySettings();
      this.callbacks.onSettings(this.settings);
    });
    document.getElementById('set-contrast')?.addEventListener('change', (event) => {
      this.settings.highContrast = (event.target as HTMLInputElement).checked;
      this.applySettings();
      this.callbacks.onSettings(this.settings);
    });
  }

  private applySettings(): void {
    document.body.classList.toggle('reduced-motion', this.settings.reducedMotion);
    document.body.classList.toggle('high-contrast', this.settings.highContrast);
    const hiddenMute = document.getElementById('mute-check') as HTMLInputElement | null;
    if (hiddenMute) hiddenMute.checked = this.settings.muted;
    const hiddenMotion = document.getElementById('motion-check') as HTMLInputElement | null;
    if (hiddenMotion) hiddenMotion.checked = this.settings.reducedMotion;
    const hiddenContrast = document.getElementById('contrast-check') as HTMLInputElement | null;
    if (hiddenContrast) hiddenContrast.checked = this.settings.highContrast;
    this.q('mute-button').textContent = this.settings.muted ? '×' : '♪';
  }

  private showModal(title: string, body: string, kind: 'pause' | 'results' | 'help' | 'settings'): void {
    this.modalKind = kind;
    this.modalTitle.textContent = title;
    this.modalBody.innerHTML = body;
    this.modal.classList.remove('hidden');
    this.modal.classList.toggle('locked', kind === 'results');
  }

  closeModal(): void {
    if (this.modalKind === 'results') return;
    if (this.modalKind === 'pause') {
      this.callbacks.onResume();
      return;
    }
    this.hideModal();
  }

  hideModal(): void {
    this.modal.classList.add('hidden');
    this.modal.classList.remove('locked');
    this.modalKind = null;
    this.helpOpen = false;
  }

  get isModalOpen(): boolean {
    return !this.modal.classList.contains('hidden');
  }

  private showTooltip(button: CardButton, target: HTMLElement): void {
    const rect = target.getBoundingClientRect();
    const title = button.reason && button.disabled ? `${button.label} — unavailable` : button.label;
    const parts: string[] = [`<b>${title}</b>`];
    if (button.tip) parts.push(button.tip);
    if (button.cost) parts.push(`<span class="tip-cost">${button.cost}</span>`);
    if (button.disabled && button.reason) parts.push(`<span class="tip-disabled">${button.reason}</span>`);
    this.tooltip.innerHTML = parts.join('');
    this.tooltip.classList.remove('hidden');
    const tipRect = this.tooltip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(8, Math.min(window.innerWidth - tipRect.width - 8, left));
    let top = rect.top - tipRect.height - 8;
    if (top < 8) top = rect.bottom + 8;
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  private hideTooltip(): void {
    this.tooltip.classList.add('hidden');
  }

  get settingsSnapshot(): PersistedSettings {
    return { ...this.settings };
  }
}

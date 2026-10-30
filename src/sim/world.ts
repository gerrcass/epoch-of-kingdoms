import {
  AGE_COST,
  BUILDING_DEFS,
  CARRY_CAPACITY,
  CIVS,
  DIFFICULTY_DEFS,
  FARM_FOOD,
  GATHER_RATE,
  MAP_SIZE,
  MAX_POPULATION,
  NODE_DEFS,
  START_RESOURCES,
  TECH_DEFS,
  UNIT_DEFS,
  canAfford,
  isArcher,
  isCavalry,
  isInfantry,
  missingResource,
  pay,
  refund,
} from './content';
import { planAI } from './ai';
import { generateMap, idx, inBounds, isWalkable } from './map';
import { approachNode, approachTile, findPath, footprintBlocked, nearestWalkable } from './pathfinding';
import { mulberry32 } from './rng';
import type {
  Age,
  Building,
  BuildingKind,
  Command,
  GameEvent,
  GameMap,
  Kingdom,
  KingdomId,
  MatchOptions,
  Projectile,
  ResourceKind,
  ResourceNode,
  TechId,
  Unit,
  UnitKind,
  Vec2,
  World,
} from './types';

const N = MAP_SIZE;
const DT = 1 / 30;
const WORK_RANGE = 1.15;
const AGGRO_BONUS = 2;

export function createWorld(options: MatchOptions): World {
  const seed = options.seed >>> 0;
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const { map, nodes } = generateMap(seed);
  for (const node of nodes) node.alive = true;
  const nextEntityId = nodes.reduce((max, node) => Math.max(max, node.id), 0) + 1;
  const firstEntityId = nodes.reduce((max, node) => Math.max(max, node.id), 0) + 1;

  const world: World = {
    seed,
    tick: 0,
    time: 0,
    rng,
    map,
    kingdoms: [makeKingdom(0, options.playerCiv, options.playerName), makeKingdom(1, options.aiCiv, options.aiName)],
    units: [],
    buildings: [],
    nodes,
    projectiles: [],
    nextId: firstEntityId,
    commands: [],
    events: [],
    visible: [new Uint8Array(N * N), new Uint8Array(N * N)],
    explored: [new Uint8Array(N * N), new Uint8Array(N * N)],
    result: 'playing',
    resultTick: -1,
    options,
    ai: [null, createAiStateFor(options.difficulty)],
    fogDirty: true,
    tickMs: 0,
  };

  const startA = map.startTiles[0];
  const startB = map.startTiles[1];
  spawnBuilding(world, 0, 'townCenter', startA.x, startA.y, true);
  spawnBuilding(world, 1, 'townCenter', startB.x, startB.y, true);

  const spots: [number, number][] = [
    [-1.4, 2.6],
    [2.6, 2.6],
    [3.4, -1.2],
  ];
  for (const [dx, dy] of spots) {
    const a = nearestWalkable(map, startA.x + 1.5 + dx, startA.y + 1.5 + dy, 4);
    if (a) spawnUnit(world, 0, 'villager', a.x, a.y);
    const b = nearestWalkable(map, startB.x + 1.5 - dx, startB.y + 1.5 - dy, 4);
    if (b) spawnUnit(world, 1, 'villager', b.x, b.y);
  }

  updateFog(world);
  return world;
}

function makeKingdom(id: KingdomId, civ: Kingdom['civ'], name: string): Kingdom {
  return {
    id,
    name,
    civ,
    color: id === 0 ? '#4a7fd4' : '#b7443d',
    stock: { ...START_RESOURCES },
    age: 0,
    techs: [],
    stats: { gathered: 0, kills: 0, buildingsDestroyed: 0, trained: 0, lost: 0 },
  };
}

function createAiStateFor(difficulty: 'easy' | 'normal' | 'hard') {
  const preset = DIFFICULTY_DEFS[difficulty];
  return {
    nextThinkTick: 30,
    phase: 0,
    nextAttackTick: preset.attackDelay * 30,
    attacking: false,
    lastBuildCheck: 0,
    targetVillagers: preset.targetVillagers,
    targetArmy: preset.targetArmy,
    gatherMultiplier: preset.gatherMultiplier,
    lastAttackSentTick: -1,
  };
}

export function spawnUnit(world: World, kingdom: KingdomId, type: UnitKind, x: number, y: number): Unit {
  const def = UNIT_DEFS[type];
  const maxHp = def.hp + (type === 'villager' && world.kingdoms[kingdom].techs.includes('loom') ? 15 : 0);
  const unit: Unit = {
    id: world.nextId++,
    kind: 'unit',
    kingdom,
    type,
    x,
    y,
    prevX: x,
    prevY: y,
    hp: maxHp,
    maxHp,
    radius: def.radius,
    direction: 0,
    order: { type: 'idle' },
    stance: 'aggressive',
    path: [],
    pathIndex: 0,
    cooldown: 0,
    targetId: null,
    attackMove: false,
    carryKind: null,
    carryAmount: 0,
    workingTicks: 0,
    stuckTicks: 0,
    repathAt: 0,
    lastX: x,
    lastY: y,
    homeX: x,
    homeY: y,
    alive: true,
  };
  world.units.push(unit);
  world.kingdoms[kingdom].stats.trained += 1;
  return unit;
}

export function spawnBuilding(
  world: World,
  kingdom: KingdomId,
  type: BuildingKind,
  tileX: number,
  tileY: number,
  complete: boolean,
): Building {
  const def = BUILDING_DEFS[type];
  const building: Building = {
    id: world.nextId++,
    kind: 'building',
    kingdom,
    type,
    tileX,
    tileY,
    width: def.width,
    height: def.height,
    x: tileX + def.width / 2,
    y: tileY + def.height / 2,
    hp: complete ? def.hp : Math.max(1, Math.floor(def.hp * 0.1)),
    maxHp: def.hp,
    complete,
    progress: complete ? 1 : 0,
    buildTime: def.buildTime,
    queue: [],
    research: null,
    ageResearch: null,
    rally: null,
    farmFood: type === 'farm' ? FARM_FOOD : 0,
    attackCooldown: 0,
    lastDamageTick: -100,
    alive: true,
  };
  world.buildings.push(building);
  setFootprint(world, building, 1);
  return building;
}

function setFootprint(world: World, building: Building, value: number): void {
  for (let y = building.tileY; y < building.tileY + building.height; y += 1) {
    for (let x = building.tileX; x < building.tileX + building.width; x += 1) {
      if (inBounds(x, y)) world.map.blocked[idx(x, y)] = value;
    }
  }
}

export function unitById(world: World, id: number | null | undefined): Unit | null {
  if (id == null) return null;
  return world.units.find((u) => u.id === id && u.alive) ?? null;
}

export function buildingById(world: World, id: number | null | undefined): Building | null {
  if (id == null) return null;
  return world.buildings.find((b) => b.id === id && b.alive) ?? null;
}

export function nodeById(world: World, id: number | null | undefined): ResourceNode | null {
  if (id == null) return null;
  return world.nodes.find((n) => n.id === id && n.alive && n.amount > 0) ?? null;
}

export function entityById(world: World, id: number | null | undefined): Unit | Building | ResourceNode | null {
  return unitById(world, id) ?? buildingById(world, id) ?? nodeById(world, id);
}

export function unitsOf(world: World, kingdom: KingdomId): Unit[] {
  return world.units.filter((u) => u.kingdom === kingdom && u.alive);
}

export function buildingsOf(world: World, kingdom: KingdomId): Building[] {
  return world.buildings.filter((b) => b.kingdom === kingdom && b.alive);
}

export function militaryOf(world: World, kingdom: KingdomId): Unit[] {
  return unitsOf(world, kingdom).filter((u) => u.type !== 'villager');
}

export function villagersOf(world: World, kingdom: KingdomId): Unit[] {
  return unitsOf(world, kingdom).filter((u) => u.type === 'villager');
}

export function townCentersOf(world: World, kingdom: KingdomId): Building[] {
  return buildingsOf(world, kingdom).filter((b) => b.type === 'townCenter');
}

export function populationUsed(world: World, kingdom: KingdomId): number {
  return unitsOf(world, kingdom).reduce((sum, u) => sum + UNIT_DEFS[u.type].pop, 0);
}

export function populationOf(world: World, kingdom: KingdomId): number {
  return populationUsed(world, kingdom);
}

export function populationCap(world: World, kingdom: KingdomId): number {
  let cap = 0;
  for (const b of buildingsOf(world, kingdom)) {
    if (b.complete) cap += BUILDING_DEFS[b.type].popProvided;
  }
  return Math.min(MAX_POPULATION, cap);
}

export function queuedPopulation(world: World, kingdom: KingdomId): number {
  let queued = 0;
  for (const b of buildingsOf(world, kingdom)) {
    for (const item of b.queue) queued += UNIT_DEFS[item.unit].pop;
  }
  return queued;
}

export function unitStats(
  world: World,
  unit: Unit,
): { attack: number; meleeArmor: number; pierceArmor: number; range: number; speed: number; cooldown: number } {
  const def = UNIT_DEFS[unit.type];
  const k = world.kingdoms[unit.kingdom];
  let attack = def.attack;
  let meleeArmor = def.armorMelee;
  let pierceArmor = def.armorPierce;
  let range = def.range;
  let speed = def.speed;
  if (isInfantry(unit.type)) {
    if (k.techs.includes('forging')) attack += 1;
    if (k.techs.includes('scaleMail')) {
      meleeArmor += 1;
      pierceArmor += 1;
    }
    if (k.civ === 'nordveld') attack += 1;
  }
  if (isArcher(unit.type) && k.civ === 'kaldari') range += 1;
  if (unit.type === 'villager' && k.techs.includes('wheelbarrow')) speed *= 1.1;
  return { attack, meleeArmor, pierceArmor, range, speed, cooldown: def.cooldown };
}

export function gatherRateFor(world: World, unit: Unit, resource: ResourceKind, fromFarm: boolean): number {
  const k = world.kingdoms[unit.kingdom];
  let rate = GATHER_RATE[resource];
  if (resource === 'wood' && k.techs.includes('doubleBitAxe')) rate *= 1.2;
  if (fromFarm && k.civ === 'aurelians') rate *= 1.15;
  if (unit.kingdom === 1) {
    const ai = world.ai[1];
    if (ai) rate *= ai.gatherMultiplier;
  }
  return rate;
}

export function distanceToEntity(x: number, y: number, entity: Unit | Building | ResourceNode): number {
  if (entity.kind === 'building') {
    const cx = Math.max(entity.tileX, Math.min(x, entity.tileX + entity.width));
    const cy = Math.max(entity.tileY, Math.min(y, entity.tileY + entity.height));
    return Math.hypot(x - cx, y - cy);
  }
  return Math.max(0, Math.hypot(x - entity.x, y - entity.y) - entity.radius);
}

export function nearestNode(
  world: World,
  x: number,
  y: number,
  kinds: ResourceNode['node'][] = ['tree', 'gold', 'stone', 'berry', 'sheep'],
  maxDist = 42,
): ResourceNode | null {
  let best: ResourceNode | null = null;
  let bestDist = maxDist;
  for (const node of world.nodes) {
    if (!node.alive || node.amount <= 0) continue;
    if (!kinds.includes(node.node)) continue;
    if (!hasWalkableNeighbour(world.map, node.tileX, node.tileY)) continue;
    const d = Math.hypot(node.x - x, node.y - y);
    if (d < bestDist) {
      best = node;
      bestDist = d;
    }
  }
  return best;
}

function hasWalkableNeighbour(map: GameMap, tx: number, ty: number): boolean {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      if (isWalkable(map, tx + dx, ty + dy)) return true;
    }
  }
  return false;
}

export function nearestDropoff(
  world: World,
  kingdom: KingdomId,
  resource: ResourceKind,
  x: number,
  y: number,
): Building | null {
  let best: Building | null = null;
  let bestDist = Infinity;
  for (const b of buildingsOf(world, kingdom)) {
    if (!b.complete || !BUILDING_DEFS[b.type].dropOff.includes(resource)) continue;
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}

export function nearestEnemyUnit(
  world: World,
  kingdom: KingdomId,
  x: number,
  y: number,
  radius: number,
): Unit | null {
  let best: Unit | null = null;
  let bestDist = radius;
  for (const other of world.units) {
    if (!other.alive || other.kingdom === kingdom) continue;
    if (!tileVisible(world, kingdom, other.x, other.y)) continue;
    const d = Math.hypot(other.x - x, other.y - y);
    if (d < bestDist) {
      best = other;
      bestDist = d;
    }
  }
  return best;
}

export function canPlaceBuilding(
  world: World,
  kingdom: KingdomId,
  type: BuildingKind,
  tileX: number,
  tileY: number,
): boolean {
  const def = BUILDING_DEFS[type];
  if (def.age > world.kingdoms[kingdom].age) return false;
  if (tileX < 1 || tileY < 1 || tileX + def.width > N - 1 || tileY + def.height > N - 1) return false;
  if (footprintBlocked(world.map, tileX, tileY, def.width, def.height)) return false;
  const explored = world.explored[kingdom]!;
  for (let y = tileY; y < tileY + def.height; y += 1) {
    for (let x = tileX; x < tileX + def.width; x += 1) {
      if (explored[idx(x, y)] !== 1) return false;
    }
  }
  for (let y = tileY; y < tileY + def.height; y += 1) {
    for (let x = tileX; x < tileX + def.width; x += 1) {
      if (world.explored[kingdom]![idx(x, y)] !== 1) return false;
    }
  }
  for (const node of world.nodes) {
    if (!node.alive) continue;
    if (
      node.tileX >= tileX &&
      node.tileX < tileX + def.width &&
      node.tileY >= tileY &&
      node.tileY < tileY + def.height
    ) {
      return false;
    }
  }
  for (const unit of world.units) {
    if (!unit.alive) continue;
    if (
      unit.x >= tileX &&
      unit.x < tileX + def.width &&
      unit.y >= tileY &&
      unit.y < tileY + def.height
    ) {
      return false;
    }
  }
  return true;
}

export function tileVisible(world: World, kingdom: KingdomId, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (!inBounds(tx, ty)) return false;
  return world.visible[kingdom]![idx(tx, ty)] === 1;
}

export function updateFog(world: World): void {
  for (let k = 0; k < 2; k += 1) {
    const visible = world.visible[k]!;
    const explored = world.explored[k]!;
    visible.fill(0);
    const reveal = (x: number, y: number, radius: number) => {
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      const r = Math.ceil(radius);
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const tx = cx + dx;
          const ty = cy + dy;
          if (!inBounds(tx, ty)) continue;
          visible[idx(tx, ty)] = 1;
          explored[idx(tx, ty)] = 1;
        }
      }
    };
    for (const unit of world.units) {
      if (unit.alive && unit.kingdom === k) reveal(unit.x, unit.y, UNIT_DEFS[unit.type].vision);
    }
    for (const building of world.buildings) {
      if (building.alive && building.kingdom === k) reveal(building.x, building.y, BUILDING_DEFS[building.type].vision);
    }
  }
  world.fogDirty = true;
}

export function eventDeaths(world: World): GameEvent[] {
  return world.events.filter((e) => e.type === 'death');
}

function setPath(world: World, unit: Unit, goal: Vec2 | null): void {
  if (!goal) {
    unit.path = [];
    unit.pathIndex = 0;
    return;
  }
  const path = findPath(world.map, unit.x, unit.y, goal.x, goal.y);
  unit.path = path ?? [];
  unit.pathIndex = unit.path.length > 1 && Math.hypot(unit.path[0]!.x - unit.x, unit.path[0]!.y - unit.y) < 0.8 ? 1 : 0;
  unit.stuckTicks = 0;
  unit.repathAt = world.tick + 15;
}

function moveTo(world: World, unit: Unit, x: number, y: number, attackMove = false): void {
  const goal = nearestWalkable(world.map, x, y, 6);
  unit.order = { type: 'move', x: goal?.x ?? x, y: goal?.y ?? y };
  unit.targetId = null;
  unit.attackMove = attackMove;
  unit.workingTicks = 0;
  setPath(world, unit, goal);
}

function entityApproach(world: World, unit: Unit, target: Unit | Building | ResourceNode): Vec2 | null {
  if (target.kind === 'building') {
    return approachTile(world.map, unit.x, unit.y, target.tileX, target.tileY, target.width, target.height);
  }
  if (target.kind === 'unit') {
    return approachNode(world.map, unit.x, unit.y, Math.floor(target.x), Math.floor(target.y));
  }
  return approachNode(world.map, unit.x, unit.y, target.tileX, target.tileY);
}

export function enqueueCommand(world: World, command: Command): void {
  world.commands.push(command);
}

export function applyCommands(world: World): void {
  const commands = world.commands;
  world.commands = [];
  for (const command of commands) applyCommand(world, command);
}

function ownUnits(world: World, kingdom: KingdomId, ids: number[]): Unit[] {
  const set = new Set(ids);
  return world.units.filter((u) => u.alive && u.kingdom === kingdom && set.has(u.id));
}

function ownBuilding(world: World, kingdom: KingdomId, id: number): Building | null {
  const b = buildingById(world, id);
  return b && b.kingdom === kingdom ? b : null;
}

function groupDestinations(units: Unit[], x: number, y: number): Vec2[] {
  const n = units.length;
  if (n <= 1) return [{ x, y }];
  const cols = Math.ceil(Math.sqrt(n));
  const spacing = 0.68;
  return units.map((_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rows = Math.ceil(n / cols);
    return {
      x: x + (col - (cols - 1) / 2) * spacing,
      y: y + (row - (rows - 1) / 2) * spacing,
    };
  });
}

function applyCommand(world: World, command: Command): void {
  if (world.result !== 'playing') return;
  const kingdom = world.kingdoms[command.kingdom];

  switch (command.type) {
    case 'resign': {
      world.result = command.kingdom === 0 ? 'defeat' : 'victory';
      world.resultTick = world.tick;
      world.events.push({ type: command.kingdom === 0 ? 'defeat' : 'victory', kingdom: (1 - command.kingdom) as KingdomId });
      return;
    }
    case 'move': {
      const units = ownUnits(world, command.kingdom, command.ids);
      if (!units.length) return;
      const dests = groupDestinations(units, command.x, command.y);
      units.forEach((unit, i) => moveTo(world, unit, dests[i]!.x, dests[i]!.y, Boolean(command.attackMove)));
      return;
    }
    case 'attack': {
      const target = entityById(world, command.targetId);
      if (!target || target.kind === 'node') return;
      if (target.kingdom === command.kingdom) return;
      for (const unit of ownUnits(world, command.kingdom, command.ids)) {
        if (unit.type === 'villager') continue;
        unit.order = { type: 'attack', targetId: target.id };
        unit.targetId = target.id;
        unit.attackMove = false;
        unit.workingTicks = 0;
        const approach = entityApproach(world, unit, target);
        setPath(world, unit, approach);
      }
      return;
    }
    case 'gather': {
      const target = entityById(world, command.nodeId);
      if (!target) return;
      if (target.kind === 'building' && (target.kingdom !== command.kingdom || !target.complete)) return;
      if (target.kind === 'building' && (target.kingdom !== command.kingdom || !target.complete || target.type !== 'farm')) return;
      for (const unit of ownUnits(world, command.kingdom, command.ids)) {
        if (unit.type !== 'villager') continue;
        unit.order = { type: 'gather', nodeId: target.id, returning: false };
        unit.targetId = null;
        unit.attackMove = false;
        unit.workingTicks = 0;
        if (unit.carryKind && unit.carryAmount > 0) {
          const tech = target.kind === 'node' ? NODE_DEFS[target.node].resource : 'food';
          if (tech !== unit.carryKind) {
            unit.order = { type: 'gather', nodeId: target.id, returning: true };
            const drop = nearestDropoff(world, unit.kingdom, unit.carryKind, unit.x, unit.y);
            if (drop) setPath(world, unit, entityApproach(world, unit, drop));
            continue;
          }
        }
        setPath(world, unit, entityApproach(world, unit, target));
      }
      return;
    }
    case 'build': {
      const def = BUILDING_DEFS[command.building];
      const existing = world.buildings.find(
        (b) => b.alive && !b.complete && b.kingdom === command.kingdom && b.type === command.building && b.tileX === command.x && b.tileY === command.y,
      );
      if (existing) {
        for (const unit of ownUnits(world, command.kingdom, command.ids).filter((u) => u.type === 'villager')) {
          unit.order = { type: 'build', buildingId: existing.id };
          unit.targetId = null;
          unit.attackMove = false;
          setPath(world, unit, entityApproach(world, unit, existing));
        }
        return;
      }
      if (def.age > kingdom.age) {
        world.events.push({ type: 'notEnough', kingdom: command.kingdom, reason: `${def.name} requires ${ageName(def.age)}` });
        return;
      }
      if (!canPlaceBuilding(world, command.kingdom, command.building, command.x, command.y)) {
        world.events.push({ type: 'notEnough', kingdom: command.kingdom, reason: 'Cannot build there' });
        return;
      }
      const builders = ownUnits(world, command.kingdom, command.ids).filter((u) => u.type === 'villager');
      if (!builders.length) return;
      if (!canAfford(kingdom.stock, def.cost)) {
        const missing = missingResource(kingdom.stock, def.cost) ?? undefined;
        world.events.push({ type: 'notEnough', kingdom: command.kingdom, resource: missing, reason: `Not enough ${missing ?? 'resources'}` });
        return;
      }
      pay(kingdom.stock, def.cost);
      const building = spawnBuilding(world, command.kingdom, command.building, command.x, command.y, false);
      world.events.push({ type: 'placed', x: building.x, y: building.y, building: command.building, kingdom: command.kingdom });
      for (const unit of builders) {
        unit.order = { type: 'build', buildingId: building.id };
        unit.targetId = null;
        unit.attackMove = false;
        setPath(world, unit, entityApproach(world, unit, building));
      }
      return;
    }
    case 'repair': {
      const building = ownBuilding(world, command.kingdom, command.buildingId);
      if (!building) return;
      for (const unit of ownUnits(world, command.kingdom, command.ids)) {
        if (unit.type !== 'villager') continue;
        unit.order = { type: 'repair', buildingId: building.id };
        unit.targetId = null;
        setPath(world, unit, entityApproach(world, unit, building));
      }
      return;
    }
    case 'train': {
      const building = ownBuilding(world, command.kingdom, command.buildingId);
      if (!building || !building.complete) return;
      if (!BUILDING_DEFS[building.type].trains.includes(command.unit)) return;
      const def = UNIT_DEFS[command.unit];
      if (def.age > kingdom.age) {
        world.events.push({ type: 'notEnough', kingdom: command.kingdom, reason: `${def.name} requires ${ageName(def.age)}` });
        return;
      }
      if (building.queue.length >= 5) return;
      if (!canAfford(kingdom.stock, def.cost)) {
        const missing = missingResource(kingdom.stock, def.cost) ?? undefined;
        world.events.push({ type: 'notEnough', kingdom: command.kingdom, resource: missing, reason: `Not enough ${missing ?? 'resources'}` });
        return;
      }
      const used = populationUsed(world, command.kingdom) + queuedPopulation(world, command.kingdom);
      if (used + def.pop > populationCap(world, command.kingdom)) {
        world.events.push({ type: 'notEnough', kingdom: command.kingdom, reason: 'Population limit — build a House' });
        return;
      }
      pay(kingdom.stock, def.cost);
      building.queue.push({ unit: command.unit, remaining: def.trainTime, total: def.trainTime });
      return;
    }
    case 'research': {
      const building = ownBuilding(world, command.kingdom, command.buildingId);
      if (!building || !building.complete) return;
      const tech = TECH_DEFS[command.tech];
      if (!tech.building.includes(building.type)) return;
      if (tech.age > kingdom.age) {
        world.events.push({ type: 'notEnough', kingdom: command.kingdom, reason: `${tech.name} requires ${ageName(tech.age)}` });
        return;
      }
      if (kingdom.techs.includes(command.tech)) return;
      if (building.research || building.ageResearch) return;
      if (!canAfford(kingdom.stock, tech.cost)) {
        const missing = missingResource(kingdom.stock, tech.cost) ?? undefined;
        world.events.push({ type: 'notEnough', kingdom: command.kingdom, resource: missing, reason: `Not enough ${missing ?? 'resources'}` });
        return;
      }
      pay(kingdom.stock, tech.cost);
      building.research = { tech: command.tech, remaining: tech.time, total: tech.time };
      return;
    }
    case 'ageUp': {
      const building = ownBuilding(world, command.kingdom, command.buildingId);
      if (!building || !building.complete || building.type !== 'townCenter') return;
      if (kingdom.age >= 2 || building.ageResearch) return;
      const next = (kingdom.age + 1) as 1 | 2;
      const cost = AGE_COST[next];
      if (!canAfford(kingdom.stock, cost.cost)) {
        const missing = missingResource(kingdom.stock, cost.cost) ?? undefined;
        world.events.push({ type: 'notEnough', kingdom: command.kingdom, resource: missing, reason: `Not enough ${missing ?? 'resources'}` });
        return;
      }
      pay(kingdom.stock, cost.cost);
      building.ageResearch = { age: next, remaining: cost.time, total: cost.time };
      return;
    }
    case 'cancel': {
      const building = ownBuilding(world, command.kingdom, command.buildingId);
      if (!building || !building.queue.length) return;
      const index = command.index ?? building.queue.length - 1;
      const item = building.queue[index];
      if (!item) return;
      refund(kingdom.stock, UNIT_DEFS[item.unit].cost, 1);
      building.queue.splice(index, 1);
      return;
    }
    case 'cancelAge': {
      const building = ownBuilding(world, command.kingdom, command.buildingId);
      if (!building || !building.ageResearch) return;
      refund(kingdom.stock, AGE_COST[building.ageResearch.age as 1 | 2].cost, 0.5);
      building.ageResearch = null;
      return;
    }
    case 'stop': {
      for (const unit of ownUnits(world, command.kingdom, command.ids)) {
        unit.order = { type: 'idle' };
        unit.path = [];
        unit.pathIndex = 0;
        unit.targetId = null;
        unit.attackMove = false;
      }
      return;
    }
    case 'hold': {
      for (const unit of ownUnits(world, command.kingdom, command.ids)) {
        unit.order = { type: 'hold' };
        unit.path = [];
        unit.pathIndex = 0;
        unit.targetId = null;
        unit.attackMove = false;
        unit.homeX = unit.x;
        unit.homeY = unit.y;
      }
      return;
    }
    case 'stance': {
      for (const unit of ownUnits(world, command.kingdom, command.ids)) unit.stance = command.stance;
      return;
    }
    case 'rally': {
      const building = ownBuilding(world, command.kingdom, command.buildingId);
      if (!building) return;
      building.rally = { x: command.x, y: command.y };
      return;
    }
  }
}

function updateProduction(world: World): void {
  for (const building of world.buildings) {
    if (!building.alive || !building.complete) continue;
    const kingdom = world.kingdoms[building.kingdom];

    if (building.queue.length > 0) {
      const item = building.queue[0]!;
      const def = UNIT_DEFS[item.unit];
      if (populationUsed(world, building.kingdom) + queuedPopulation(world, building.kingdom) <= populationCap(world, building.kingdom)) {
        item.remaining -= DT;
        if (item.remaining <= 0) {
          const spot = freeTileNear(world, building);
          const unit = spawnUnit(world, building.kingdom, item.unit, spot.x, spot.y);
          if (building.rally) {
            unit.order = { type: 'move', x: building.rally.x, y: building.rally.y };
            setPath(world, unit, building.rally);
          }
          building.queue.shift();
          world.events.push({ type: 'trained', x: spot.x, y: spot.y, unit: item.unit, kingdom: building.kingdom });
          void def;
        }
      }
    }

    if (building.research) {
      building.research.remaining -= DT;
      if (building.research.remaining <= 0) {
        const tech = building.research.tech;
        building.research = null;
        if (!kingdom.techs.includes(tech)) kingdom.techs.push(tech);
        if (tech === 'loom') {
          for (const unit of world.units) {
            if (unit.kingdom === building.kingdom && unit.type === 'villager') {
              unit.maxHp += 15;
              unit.hp += 15;
            }
          }
        }
        world.events.push({ type: 'research', kingdom: building.kingdom, tech });
      }
    }

    if (building.ageResearch) {
      building.ageResearch.remaining -= DT;
      if (building.ageResearch.remaining <= 0) {
        kingdom.age = building.ageResearch.age;
        building.ageResearch = null;
        world.events.push({ type: 'ageUp', kingdom: building.kingdom, age: kingdom.age });
      }
    }

  }
}

function freeTileNear(world: World, building: Building): Vec2 {
  for (let r = 1; r <= 5; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = building.tileX + Math.floor(building.width / 2) + dx;
        const y = building.tileY + Math.floor(building.height / 2) + dy;
        if (inBounds(x, y) && isWalkable(world.map, x, y)) return { x: x + 0.5, y: y + 0.5 };
      }
    }
  }
  return { x: building.x, y: building.y + 1 };
}

function updateVillagerWork(world: World): void {
  for (const unit of world.units) {
    if (!unit.alive || unit.type !== 'villager') continue;
    if (unit.order.type === 'build') updateBuilder(world, unit);
    else if (unit.order.type === 'gather') updateGather(world, unit);
    else if (unit.order.type === 'repair') updateRepair(world, unit);
  }
}

function updateGather(world: World, unit: Unit): void {
  if (unit.order.type !== 'gather') return;
  const target = entityById(world, unit.order.nodeId);
  if (!target || !target.alive) {
    if (unit.carryAmount > 0) {
      const drop = nearestDropoff(world, unit.kingdom, unit.carryKind ?? 'food', unit.x, unit.y);
      if (!drop) {
        unit.order = { type: 'idle' };
        return;
      }
      if (distanceToEntity(unit.x, unit.y, drop) <= WORK_RANGE) {
        const amount = unit.carryAmount;
        if (unit.carryKind) {
          world.kingdoms[unit.kingdom].stock[unit.carryKind] += amount;
          world.kingdoms[unit.kingdom].stats.gathered += amount;
          world.events.push({ type: 'deposit', x: drop.x, y: drop.y, resource: unit.carryKind, amount, kingdom: unit.kingdom });
        }
        unit.carryAmount = 0;
        unit.carryKind = null;
        unit.order = { type: 'idle' };
      } else {
        unit.order = { type: 'gather', nodeId: unit.order.nodeId, returning: true };
        if (unit.path.length === 0) setPath(world, unit, entityApproach(world, unit, drop));
      }
    } else {
      unit.order = { type: 'idle' };
    }
    return;
  }

  const isFarm = target.kind === 'building' && target.type === 'farm';
  const resource = target.kind === 'node' ? NODE_DEFS[target.node].resource : 'food';
  const remaining = target.kind === 'node' ? target.amount : isFarm ? (target as Building).farmFood : 0;

  if (!target || !target.alive) {
    if (unit.carryAmount > 0) {
      const drop = nearestDropoff(world, unit.kingdom, unit.carryKind ?? 'food', unit.x, unit.y);
      if (!drop) {
        unit.order = { type: 'idle' };
        return;
      }
      if (distanceToEntity(unit.x, unit.y, drop) <= WORK_RANGE) {
        const amount = unit.carryAmount;
        if (unit.carryKind) {
          world.kingdoms[unit.kingdom].stock[unit.carryKind] += amount;
          world.kingdoms[unit.kingdom].stats.gathered += amount;
          world.events.push({ type: 'deposit', x: drop.x, y: drop.y, resource: unit.carryKind, amount, kingdom: unit.kingdom });
        }
        unit.carryAmount = 0;
        unit.carryKind = null;
        unit.order = { type: 'idle' };
      } else {
        unit.order = { type: 'gather', nodeId: unit.order.nodeId, returning: true };
        if (unit.path.length === 0) setPath(world, unit, entityApproach(world, unit, drop));
      }
    } else {
      unit.order = { type: 'idle' };
    }
    return;
  }

  if (unit.order.returning) {
    if (unit.carryAmount <= 0) {
      unit.order = { type: 'gather', nodeId: target.id, returning: false };
      setPath(world, unit, entityApproach(world, unit, target));
      return;
    }
    const drop = nearestDropoff(world, unit.kingdom, unit.carryKind ?? resource, unit.x, unit.y);
    if (!drop) {
      unit.order = { type: 'idle' };
      return;
    }
    if (distanceToEntity(unit.x, unit.y, drop) <= WORK_RANGE) {
      const amount = unit.carryAmount;
      if (unit.carryKind) {
        world.kingdoms[unit.kingdom].stock[unit.carryKind] += amount;
        world.kingdoms[unit.kingdom].stats.gathered += amount;
        world.events.push({
          type: 'deposit',
          x: drop.x,
          y: drop.y,
          resource: unit.carryKind,
          amount,
          kingdom: unit.kingdom,
        });
      }
      unit.carryAmount = 0;
      unit.carryKind = null;
      unit.order = { type: 'gather', nodeId: target.id, returning: false };
      setPath(world, unit, entityApproach(world, unit, target));
    } else if (unit.path.length === 0) {
      setPath(world, unit, entityApproach(world, unit, drop));
    }
    return;
  }

  if (remaining <= 0) {
    if (unit.carryAmount > 0) {
      unit.order = { type: 'gather', nodeId: target.id, returning: true };
      const drop = nearestDropoff(world, unit.kingdom, unit.carryKind ?? resource, unit.x, unit.y);
      if (drop) setPath(world, unit, entityApproach(world, unit, drop));
    } else {
      unit.order = { type: 'idle' };
    }
    return;
  }

  if (unit.carryAmount >= CARRY_CAPACITY) {
    unit.order = { type: 'gather', nodeId: target.id, returning: true };
    const drop = nearestDropoff(world, unit.kingdom, unit.carryKind ?? resource, unit.x, unit.y);
    if (drop) setPath(world, unit, entityApproach(world, unit, drop));
    return;
  }

  const reach = target.kind === 'building' ? 1.3 : WORK_RANGE;
  if (distanceToEntity(unit.x, unit.y, target) > reach) {
    if (unit.path.length === 0) setPath(world, unit, entityApproach(world, unit, target));
    return;
  }

  unit.workingTicks += 1;
  unit.path = [];
  unit.pathIndex = 0;
  const rate = gatherRateFor(world, unit, resource, isFarm);
  const amount = Math.min(rate * DT, remaining, CARRY_CAPACITY - unit.carryAmount);
  if (amount <= 0) return;
  unit.carryKind = resource;
  unit.carryAmount += amount;
  if (target.kind === 'node') {
    target.amount -= amount;
    if (target.amount <= 0) {
      target.amount = 0;
      target.alive = false;
      world.events.push({ type: 'nodeDepleted', x: target.x, y: target.y, node: target.node });
    }
  } else if (isFarm) {
    (target as Building).farmFood -= amount;
    if ((target as Building).farmFood <= 0) {
      (target as Building).farmFood = 0;
      world.events.push({ type: 'farmExhausted', x: target.x, y: target.y, kingdom: unit.kingdom });
    }
  }
  if (unit.carryAmount >= CARRY_CAPACITY - 0.0001) {
    unit.order = { type: 'gather', nodeId: target.id, returning: true };
    const drop = nearestDropoff(world, unit.kingdom, unit.carryKind ?? resource, unit.x, unit.y);
    if (drop) setPath(world, unit, entityApproach(world, unit, drop));
  }
}

function updateBuilder(world: World, unit: Unit): void {
  if (unit.order.type !== 'build') return;
  const building = buildingById(world, unit.order.buildingId);
  if (!building || building.complete) {
    unit.order = { type: 'idle' };
    unit.path = [];
    return;
  }
  if (distanceToEntity(unit.x, unit.y, building) > 1.35) {
    if (unit.path.length === 0) setPath(world, unit, entityApproach(world, unit, building));
    return;
  }
  unit.workingTicks += 1;
  unit.path = [];
  unit.pathIndex = 0;
  building.progress = Math.min(1, building.progress + DT / Math.max(1, building.buildTime));
  building.hp = Math.max(1, Math.floor(building.maxHp * (0.1 + 0.9 * building.progress)));
  if (building.progress >= 1) {
    building.complete = true;
    building.progress = 1;
    building.hp = building.maxHp;
    if (building.type === 'farm') building.farmFood = FARM_FOOD;
    world.events.push({ type: 'built', x: building.x, y: building.y, building: building.type, kingdom: building.kingdom });
    unit.order = { type: 'idle' };
  }
}

function updateRepair(world: World, unit: Unit): void {
  if (unit.order.type !== 'repair') return;
  const building = buildingById(world, unit.order.buildingId);
  if (!building || building.hp >= building.maxHp) {
    unit.order = { type: 'idle' };
    unit.path = [];
    return;
  }
  if (distanceToEntity(unit.x, unit.y, building) > 1.35) {
    if (unit.path.length === 0) setPath(world, unit, entityApproach(world, unit, building));
    return;
  }
  const woodCost = 1.5 * DT;
  if (world.kingdoms[unit.kingdom].stock.wood < woodCost) {
    unit.order = { type: 'idle' };
    world.events.push({ type: 'notEnough', kingdom: unit.kingdom, resource: 'wood', reason: 'Need wood to repair' });
    return;
  }
  world.kingdoms[unit.kingdom].stock.wood -= woodCost;
  building.hp = Math.min(building.maxHp, building.hp + 9 * DT);
  unit.workingTicks += 1;
  unit.path = [];
}

function updateCombat(world: World): void {
  for (const unit of world.units) {
    if (!unit.alive) continue;
    if (unit.cooldown > 0) unit.cooldown -= DT;
    if (unit.type === 'villager') continue;

    const def = UNIT_DEFS[unit.type];
    const stats = unitStats(world, unit);

    let target: Unit | Building | null = null;
    if (unit.order.type === 'attack') {
      const found = entityById(world, unit.order.targetId);
      if (found && found.kind !== 'node' && found.alive) target = found;
      else {
        unit.order = { type: 'idle' };
        unit.targetId = null;
      }
    }
    if (!target && unit.targetId !== null) {
      const found = entityById(world, unit.targetId);
      if (found && found.kind !== 'node' && found.alive) target = found;
      else unit.targetId = null;
    }

    if (!target && (unit.order.type === 'idle' || unit.stance === 'aggressive' || (unit.order.type === 'move' && unit.attackMove))) {
      if (unit.stance === 'defensive' && Math.hypot(unit.x - unit.homeX, unit.y - unit.homeY) > 6) {
        // Hold near the post.
      } else {
        const radius = unit.stance === 'standGround' ? stats.range + 0.3 : def.vision + AGGRO_BONUS;
        target = nearestEnemyUnit(world, unit.kingdom, unit.x, unit.y, radius);
        if (target) unit.targetId = target.id;
      }
    }

    if (!target) {
      if (unit.order.type === 'attack') {
        unit.order = { type: 'idle' };
        unit.targetId = null;
      }
      continue;
    }

    const targetDistance = distanceToEntity(unit.x, unit.y, target);
    if (targetDistance <= stats.range + 0.05) {
      unit.path = [];
      unit.pathIndex = 0;
      if (unit.cooldown <= 0) {
        unit.cooldown = stats.cooldown;
        attackTarget(world, unit, target, stats.attack);
      }
      continue;
    }

    const explicit = unit.order.type === 'attack';
    const homeDistance = Math.hypot(unit.x - unit.homeX, unit.y - unit.homeY);
    const canChase =
      explicit ||
      unit.attackMove ||
      (unit.stance === 'aggressive' && targetDistance <= 10) ||
      (unit.stance === 'defensive' && targetDistance <= 5 && homeDistance <= 8);
    if (!canChase) {
      unit.targetId = null;
      continue;
    }
    if (unit.path.length === 0 && world.tick >= unit.repathAt) {
      const approach = entityApproach(world, unit, target);
      if (approach) setPath(world, unit, approach);
      unit.repathAt = world.tick + 12;
    }
  }

  for (const building of world.buildings) {
    if (!building.alive || !building.complete) continue;
    const def = BUILDING_DEFS[building.type];
    if (def.attack <= 0) continue;
    building.attackCooldown -= DT;
    if (building.attackCooldown > 0) continue;
    const target = nearestEnemyUnit(world, building.kingdom, building.x, building.y, def.range);
    if (!target) continue;
    building.attackCooldown = def.cooldown;
    spawnArrow(world, building.kingdom, building.x, building.y, target, def.attack, 'pierce', {});
  }
}

function attackTarget(world: World, unit: Unit, target: Unit | Building, baseDamage: number): void {
  const def = UNIT_DEFS[unit.type];
  const stats = unitStats(world, unit);
  unit.direction = Math.atan2(target.y - unit.y, target.x - unit.x);
  if (def.attackType === 'pierce' && def.range > 1.5) {
    spawnArrow(world, unit.kingdom, unit.x, unit.y, target, stats.attack, 'pierce', def.bonusVs);
  } else {
    applyDamage(world, unit.kingdom, target, baseDamage, def.attackType, def.bonusVs);
  }
}

function spawnArrow(
  world: World,
  kingdom: KingdomId,
  x: number,
  y: number,
  target: Unit | Building,
  damage: number,
  attackType: 'melee' | 'pierce',
  bonusVs: Partial<Record<'cavalry' | 'archer' | 'building', number>>,
): void {
  const dist = Math.hypot(target.x - x, target.y - y);
  const projectile: Projectile = {
    id: world.nextId++,
    kind: 'projectile',
    kingdom,
    x,
    y: y - 0.35,
    tx: target.x,
    ty: target.y,
    targetId: target.id,
    speed: Math.max(5, dist * 2.2),
    damage,
    attackType,
    bonusVs,
    arc: Math.min(2.4, 0.6 + dist * 0.1),
    alive: true,
  };
  world.projectiles.push(projectile);
  world.events.push({ type: 'attack', x: target.x, y: target.y, targetId: target.id, damage: 0, ranged: true, kingdom });
}

function applyDamage(
  world: World,
  sourceKingdom: KingdomId,
  target: Unit | Building,
  baseDamage: number,
  attackType: 'melee' | 'pierce',
  bonusVs: Partial<Record<'cavalry' | 'archer' | 'building', number>>,
): void {
  if (!target.alive) return;
  let armor = 0;
  if (target.kind === 'unit') {
    const stats = unitStats(world, target);
    armor = attackType === 'pierce' ? stats.pierceArmor : stats.meleeArmor;
  } else {
    const def = BUILDING_DEFS[target.type];
    armor = attackType === 'pierce' ? def.armorPierce : def.armorMelee;
  }
  let bonus = 0;
  if (target.kind === 'building') {
    bonus += bonusVs.building ?? 0;
  } else {
    if (isCavalry(target.type)) bonus += bonusVs.cavalry ?? 0;
    if (isArcher(target.type)) bonus += bonusVs.archer ?? 0;
  }
  const damage = Math.max(1, Math.round(baseDamage + bonus - armor));
  target.hp -= damage;
  world.events.push({
    type: 'attack',
    x: target.x,
    y: target.y,
    targetId: target.id,
    damage,
    ranged: attackType === 'pierce',
    kingdom: sourceKingdom,
  });
  if (target.kind === 'building' && target.hp > 0) {
    target.lastDamageTick = world.tick;
    if (world.tick % 90 === 0) {
      world.events.push({ type: 'underAttack', kingdom: target.kingdom, x: target.x, y: target.y });
    }
  }
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
  }
}

function updateProjectiles(world: World): void {
  for (const projectile of world.projectiles) {
    if (!projectile.alive) continue;
    const target = entityById(world, projectile.targetId);
    if (target && target.kind !== 'node' && target.alive) {
      projectile.tx = target.x;
      projectile.ty = target.y;
    }
    const dx = projectile.tx - projectile.x;
    const dy = projectile.ty - projectile.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.22) {
      projectile.alive = false;
      if (target && target.kind !== 'node' && target.alive) {
        applyDamage(
          world,
          projectile.kingdom,
          target,
          projectile.damage,
          projectile.attackType,
          projectile.bonusVs,
        );
      }
      continue;
    }
    const step = Math.min(dist, projectile.speed * DT);
    projectile.x += (dx / dist) * step;
    projectile.y += (dy / dist) * step;
  }
  world.projectiles = world.projectiles.filter((p) => p.alive);
}

function updateMovement(world: World): void {
  for (const unit of world.units) {
    if (!unit.alive) continue;
    if (unit.order.type === 'hold' || unit.workingTicks > 0) {
      if (unit.order.type === 'hold') unit.path = [];
      continue;
    }
    if (!unit.path.length) {
      if (unit.order.type === 'move' && Math.hypot(unit.x - unit.order.x, unit.y - unit.order.y) < 0.8) {
        unit.order = { type: 'idle' };
        unit.attackMove = false;
      }
      continue;
    }
    const stats = unitStats(world, unit);
    let budget = stats.speed * DT;
    while (budget > 0 && unit.pathIndex < unit.path.length) {
      const point = unit.path[unit.pathIndex]!;
      const dx = point.x - unit.x;
      const dy = point.y - unit.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.045) {
        unit.pathIndex += 1;
        continue;
      }
      const step = Math.min(budget, d);
      const nx = unit.x + (dx / d) * step;
      const ny = unit.y + (dy / d) * step;
      if (!isWalkable(world.map, Math.floor(nx), Math.floor(ny))) {
        unit.path = [];
        unit.pathIndex = 0;
        unit.repathAt = world.tick + 15;
        break;
      }
      unit.x = nx;
      unit.y = ny;
      unit.direction = Math.atan2(dy, dx);
      budget -= step;
    }
    if (unit.pathIndex >= unit.path.length) {
      unit.path = [];
      unit.pathIndex = 0;
    }
    if (unit.path.length === 0 && unit.order.type === 'move') {
      if (Math.hypot(unit.x - unit.order.x, unit.y - unit.order.y) < 0.8) {
        unit.order = { type: 'idle' };
        unit.attackMove = false;
      }
    }
  }

  // Soft separation.
  for (let i = 0; i < world.units.length; i += 1) {
    const a = world.units[i]!;
    if (!a.alive || a.workingTicks > 0) continue;
    for (let j = i + 1; j < world.units.length; j += 1) {
      const b = world.units[j]!;
      if (!b.alive || b.workingTicks > 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.radius + b.radius + 0.06;
      if (dist > 0.0001 && dist < min) {
        const push = (min - dist) * 0.5;
        const ax = a.x - (dx / dist) * push;
        const ay = a.y - (dy / dist) * push;
        const bx = b.x + (dx / dist) * push;
        const by = b.y + (dy / dist) * push;
        if (isWalkable(world.map, Math.floor(ax), Math.floor(ay))) {
          a.x = ax;
          a.y = ay;
        }
        if (isWalkable(world.map, Math.floor(bx), Math.floor(by))) {
          b.x = bx;
          b.y = by;
        }
      }
    }
  }
}

function cleanup(world: World): void {
  for (const unit of world.units) {
    if (!unit.alive || unit.hp > 0) continue;
    world.events.push({ type: 'death', x: unit.x, y: unit.y, unit: unit.type, kingdom: unit.kingdom });
    world.kingdoms[1 - unit.kingdom].stats.kills += 1;
    world.kingdoms[unit.kingdom].stats.lost += 1;
  }
  for (const building of world.buildings) {
    if (!building.alive || building.hp > 0) continue;
    world.events.push({ type: 'death', x: building.x, y: building.y, building: building.type, kingdom: building.kingdom });
    world.kingdoms[1 - building.kingdom].stats.buildingsDestroyed += 1;
    world.kingdoms[building.kingdom].stats.lost += 1;
    setFootprint(world, building, 0);
  }
  for (const node of world.nodes) {
    if (node.alive && node.amount <= 0) node.alive = false;
  }
  const deadNodes = world.nodes.filter((n) => !n.alive);
  for (const node of deadNodes) {
    if (inBounds(node.tileX, node.tileY)) world.map.blocked[idx(node.tileX, node.tileY)] = 0;
  }
  world.units = world.units.filter((u) => u.alive && u.hp > 0);
  world.buildings = world.buildings.filter((b) => b.alive && b.hp > 0);
  world.nodes = world.nodes.filter((n) => n.alive);
}

function checkVictory(world: World): void {
  if (world.result !== 'playing') return;
  const playerTC = townCentersOf(world, 0).length;
  const aiTC = townCentersOf(world, 1).length;
  if (playerTC > 0 && aiTC > 0) return;
  if (playerTC === 0 && aiTC === 0) {
    world.result = 'defeat';
    world.resultTick = world.tick;
    world.events.push({ type: 'defeat', kingdom: 1 });
    return;
  }
  if (aiTC === 0) {
    world.result = 'victory';
    world.resultTick = world.tick;
    world.events.push({ type: 'victory', kingdom: 0 });
  } else {
    world.result = 'defeat';
    world.resultTick = world.tick;
    world.events.push({ type: 'defeat', kingdom: 1 });
  }
}

export function step(world: World): void {
  if (world.result !== 'playing') return;
  const start = performance.now();
  world.tick += 1;
  world.time = world.tick / 30;
  for (const unit of world.units) {
    unit.prevX = unit.x;
    unit.prevY = unit.y;
    unit.workingTicks = 0;
  }
  if (world.ai[1] && world.tick >= world.ai[1]!.nextThinkTick) {
    const commands = planAI(world);
    for (const command of commands) world.commands.push(command);
    const cadence = DIFFICULTY_DEFS[world.options.difficulty].thinkSeconds * 30;
    world.ai[1]!.nextThinkTick = world.tick + Math.round(cadence);
  }
  applyCommands(world);
  updateProduction(world);
  updateVillagerWork(world);
  updateCombat(world);
  updateMovement(world);
  updateProjectiles(world);
  cleanup(world);
  if (world.tick % 6 === 0) updateFog(world);
  checkVictory(world);
  world.tickMs = performance.now() - start;
}

export function runTicks(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) step(world);
}

export function stateHash(world: World): string {
  let h = 2166136261;
  const mix = (value: number) => {
    h ^= value | 0;
    h = Math.imul(h, 16777619) >>> 0;
  };
  mix(world.tick);
  for (const k of world.kingdoms) {
    mix(k.stock.food * 100);
    mix(k.stock.wood * 100);
    mix(k.stock.gold * 100);
    mix(k.stock.stone * 100);
    mix(k.age);
  }
  for (const unit of world.units) {
    mix(unit.id);
    mix(unit.kingdom);
    mix(Math.round(unit.x * 100));
    mix(Math.round(unit.y * 100));
    mix(Math.round(unit.hp));
    mix(Math.round(unit.carryAmount * 10));
  }
  for (const building of world.buildings) {
    mix(building.id);
    mix(building.kingdom);
    mix(Math.round(building.hp));
    mix(Math.round(building.progress * 1000));
    mix(building.queue.length);
  }
  for (const node of world.nodes) {
    mix(node.id);
    mix(Math.round(node.amount));
  }
  mix(world.result === 'playing' ? 0 : world.result === 'victory' ? 1 : 2);
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function entityAt(world: World, x: number, y: number, kingdom: KingdomId): Unit | Building | ResourceNode | null {
  let bestUnit: Unit | null = null;
  let bestDist = Infinity;
  for (const unit of world.units) {
    if (!unit.alive) continue;
    if (unit.kingdom !== kingdom && !tileVisible(world, kingdom, unit.x, unit.y)) continue;
    const d = Math.hypot(unit.x - x, unit.y - y);
    if (d < bestDist && d < 0.7) {
      bestUnit = unit;
      bestDist = d;
    }
  }
  if (bestUnit) return bestUnit;
  for (const building of world.buildings) {
    if (!building.alive) continue;
    if (building.kingdom !== kingdom && !tileVisible(world, kingdom, building.x, building.y)) continue;
    if (x >= building.tileX && x < building.tileX + building.width && y >= building.tileY && y < building.tileY + building.height) {
      return building;
    }
  }
  for (const node of world.nodes) {
    if (!node.alive) continue;
    const d = Math.hypot(node.x - x, node.y - y);
    if (d < node.radius + 0.45) return node;
  }
  return null;
}

export function unitsInBox(
  world: World,
  kingdom: KingdomId,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Unit[] {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return world.units.filter(
    (u) =>
      u.alive &&
      u.kingdom === kingdom &&
      u.x >= minX &&
      u.x <= maxX &&
      u.y >= minY &&
      u.y <= maxY,
  );
}

export function ageName(age: Age): string {
  return age === 0 ? 'Dark Age' : age === 1 ? 'Feudal Age' : 'Castle Age';
}

export function techName(id: TechId): string {
  return TECH_DEFS[id].name;
}

export function civName(civ: Kingdom['civ']): string {
  return CIVS[civ].name;
}

export function visibleEnemies(world: World, kingdom: KingdomId): Unit[] {
  return world.units.filter((u) => u.alive && u.kingdom !== kingdom && tileVisible(world, kingdom, u.x, u.y));
}

export function drainEvents(world: World): GameEvent[] {
  const events = world.events;
  world.events = [];
  return events;
}

export function mapOf(world: World): GameMap {
  return world.map;
}

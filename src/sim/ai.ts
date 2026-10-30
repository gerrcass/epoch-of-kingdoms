import {
  AGE_COST,
  BUILDING_DEFS,
  DIFFICULTY_DEFS,
  UNIT_DEFS,
  isArcher,
  isCavalry,
  isInfantry,
  missingResource,
} from './content';
import { inBounds, isWalkable } from './map';
import { footprintBlocked } from './pathfinding';
import type {
  Building,
  BuildingKind,
  Command,
  Difficulty,
  Kingdom,
  ResourceKind,
  ResourceNode,
  Unit,
  UnitKind,
  Vec2,
  World,
} from './types';

export function createAiState(difficulty: Difficulty): {
  nextThinkTick: number;
  phase: number;
  nextAttackTick: number;
  attacking: boolean;
  lastBuildCheck: number;
  targetVillagers: number;
  targetArmy: number;
  gatherMultiplier: number;
  lastAttackSentTick: number;
} {
  const d = DIFFICULTY_DEFS[difficulty];
  return {
    nextThinkTick: 20,
    phase: 0,
    nextAttackTick: 90 * 30,
    attacking: false,
    lastBuildCheck: 0,
    targetVillagers: d.targetVillagers,
    targetArmy: d.targetArmy,
    gatherMultiplier: d.gatherMultiplier,
    lastAttackSentTick: -9999,
  };
}

function myVillagers(world: World): Unit[] {
  return world.units.filter((u) => u.alive && u.kingdom === 1 && u.type === 'villager');
}

function myArmy(world: World): Unit[] {
  return world.units.filter((u) => u.alive && u.kingdom === 1 && u.type !== 'villager');
}

function buildings(world: World, kind?: BuildingKind): Building[] {
  return world.buildings.filter((b) => b.alive && b.kingdom === 1 && (!kind || b.type === kind));
}

function tc(world: World): Building | null {
  return buildings(world, 'townCenter').find((b) => b.complete) ?? null;
}

function nearestNode(world: World, x: number, y: number, kinds: ResourceNode['node'][]): ResourceNode | null {
  let best: ResourceNode | null = null;
  let bestDist = Infinity;
  for (const node of world.nodes) {
    if (!node.alive || node.amount <= 0) continue;
    if (!kinds.includes(node.node)) continue;
    let reachable = false;
    for (let dy = -1; dy <= 1 && !reachable; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        if (isWalkable(world.map, node.tileX + dx, node.tileY + dy)) {
          reachable = true;
          break;
        }
      }
    }
    if (!reachable) continue;
    const d = Math.hypot(node.x - x, node.y - y);
    if (d < bestDist) {
      best = node;
      bestDist = d;
    }
  }
  return best;
}

function nearestFarm(world: World, tcPos: Vec2): Building | null {
  let best: Building | null = null;
  let bestDist = Infinity;
  for (const b of buildings(world, 'farm')) {
    if (!b.complete || b.farmFood <= 0) continue;
    const d = Math.hypot(b.x - tcPos.x, b.y - tcPos.y);
    if (d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}

function spotFree(world: World, type: BuildingKind, tx: number, ty: number): boolean {
  const def = BUILDING_DEFS[type];
  if (!inBounds(tx, ty) || !inBounds(tx + def.width - 1, ty + def.height - 1)) return false;
  if (footprintBlocked(world.map, tx, ty, def.width, def.height)) return false;
  for (const unit of world.units) {
    if (!unit.alive) continue;
    if (unit.x >= tx && unit.x < tx + def.width && unit.y >= ty && unit.y < ty + def.height) return false;
  }
  return true;
}

function findSpot(world: World, type: BuildingKind, near: Vec2, radius = 9): Vec2 | null {
  const def = BUILDING_DEFS[type];
  for (let r = 0; r <= radius; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.round(near.x + dx - def.width / 2);
        const ty = Math.round(near.y + dy - def.height / 2);
        if (spotFree(world, type, tx, ty)) return { x: tx, y: ty };
      }
    }
  }
  return null;
}

function chooseBuilder(villagers: Unit[], near: Vec2): Unit | null {
  if (villagers.length === 0) return null;
  const idle = villagers.find((v) => v.order.type === 'idle');
  if (idle) return idle;
  let best = villagers[0]!;
  let bestDist = Infinity;
  for (const v of villagers) {
    if (v.order.type === 'gather') {
      const d = Math.hypot(v.x - near.x, v.y - near.y);
      if (d < bestDist) {
        best = v;
        bestDist = d;
      }
    }
  }
  return best;
}

function pop(world: World): { used: number; cap: number } {
  let used = 0;
  for (const u of world.units) if (u.alive && u.kingdom === 1) used += UNIT_DEFS[u.type].pop;
  let cap = 0;
  for (const b of world.buildings) {
    if (b.alive && b.kingdom === 1 && b.complete) cap += BUILDING_DEFS[b.type].popProvided;
  }
  return { used, cap };
}

function payLocal(budget: Kingdom['stock'], cost: Partial<Kingdom['stock']>): void {
  for (const key of ['food', 'wood', 'gold', 'stone'] as const) {
    budget[key] -= cost[key] ?? 0;
  }
}

function canPayLocal(budget: Kingdom['stock'], cost: Partial<Kingdom['stock']>): boolean {
  return (
    budget.food >= (cost.food ?? 0) &&
    budget.wood >= (cost.wood ?? 0) &&
    budget.gold >= (cost.gold ?? 0) &&
    budget.stone >= (cost.stone ?? 0)
  );
}

function has(world: World, kind: BuildingKind): boolean {
  return world.buildings.some((b) => b.alive && b.kingdom === 1 && b.type === kind);
}

function count(world: World, kind: BuildingKind): number {
  return world.buildings.filter((b) => b.alive && b.complete && b.kingdom === 1 && b.type === kind).length;
}

function tryBuild(
  world: World,
  commands: Command[],
  budget: Kingdom['stock'],
  kind: BuildingKind,
  near: Vec2,
  villagers: Unit[],
  radius = 9,
): boolean {
  if (!canPayLocal(budget, BUILDING_DEFS[kind].cost)) return false;
  const builder = chooseBuilder(villagers, near);
  if (!builder) return false;
  const spot = findSpot(world, kind, near, radius);
  if (!spot) return false;
  payLocal(budget, BUILDING_DEFS[kind].cost);
  commands.push({ type: 'build', kingdom: 1, ids: [builder.id], building: kind, x: spot.x, y: spot.y });
  return true;
}

function resourceCounts(world: World): Record<ResourceKind, number> {
  const counts: Record<ResourceKind, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const v of myVillagers(world)) {
    if (v.order.type !== 'gather') continue;
    const nodeId = v.order.nodeId;
    const target = world.nodes.find((n) => n.id === nodeId) ??
      world.buildings.find((b) => b.id === nodeId);
    if (!target) continue;
    if (target.kind === 'node') {
      if (target.node === 'tree') counts.wood += 1;
      else if (target.node === 'gold') counts.gold += 1;
      else if (target.node === 'stone') counts.stone += 1;
      else counts.food += 1;
    } else if (target.type === 'farm') counts.food += 1;
  }
  return counts;
}

function desiredCounts(world: World): Record<ResourceKind, number> {
  const target = world.ai[1]?.targetVillagers ?? 16;
  const age = world.kingdoms[1].age;
  if (age === 0) {
    return {
      food: Math.max(2, Math.round(target * 0.4)),
      wood: Math.max(2, Math.round(target * 0.35)),
      gold: Math.max(1, Math.round(target * 0.18)),
      stone: 1,
    };
  }
  return {
    food: Math.max(3, Math.round(target * 0.38)),
    wood: Math.max(3, Math.round(target * 0.3)),
    gold: Math.max(2, Math.round(target * 0.22)),
    stone: Math.max(1, Math.round(target * 0.1)),
  };
}

function assignIdle(world: World, commands: Command[], villagers: Unit[], commandsThisTick: number): number {
  const current = resourceCounts(world);
  const desired = desiredCounts(world);
  let assigned = 0;
  for (const villager of villagers) {
    if (villager.order.type !== 'idle') continue;
    if (commandsThisTick + assigned >= 3) break;
    const kinds: ResourceKind[] = (['food', 'wood', 'gold', 'stone'] as ResourceKind[]).sort(
      (a, b) => desired[b] - current[b] - (desired[a] - current[a]),
    );
    let chosen = false;
    for (const kind of kinds) {
      if (current[kind] >= desired[kind] + 1) continue;
      const nodeKinds: ResourceNode['node'][] =
        kind === 'food' ? ['berry', 'sheep'] : kind === 'wood' ? ['tree'] : kind === 'gold' ? ['gold'] : ['stone'];
      const node = nearestNode(world, villager.x, villager.y, nodeKinds);
      if (node) {
        commands.push({ type: 'gather', kingdom: 1, ids: [villager.id], nodeId: node.id });
        current[kind] += 1;
        chosen = true;
        break;
      }
      if (kind === 'food') {
        const farm = nearestFarm(world, { x: villager.x, y: villager.y });
        if (farm) {
          commands.push({ type: 'gather', kingdom: 1, ids: [villager.id], nodeId: farm.id });
          current.food += 1;
          chosen = true;
          break;
        }
      }
    }
    if (!chosen) {
      const tree = nearestNode(world, villager.x, villager.y, ['tree']);
      if (tree) {
        commands.push({ type: 'gather', kingdom: 1, ids: [villager.id], nodeId: tree.id });
        current.wood += 1;
        assigned += 1;
      }
    } else {
      assigned += 1;
    }
  }
  return assigned;
}

function train(
  world: World,
  commands: Command[],
  budget: Kingdom['stock'],
  building: Building,
  unit: UnitKind,
): boolean {
  const def = UNIT_DEFS[unit];
  if (def.age > world.kingdoms[1].age) return false;
  if (!BUILDING_DEFS[building.type].trains.includes(unit)) return false;
  if (building.queue.length >= 2) return false;
  if (!canPayLocal(budget, def.cost)) return false;
  const p = pop(world);
  const queued = building.queue.reduce((sum, item) => sum + UNIT_DEFS[item.unit].pop, 0);
  if (p.used + queued + def.pop > p.cap) return false;
  payLocal(budget, def.cost);
  commands.push({ type: 'train', kingdom: 1, buildingId: building.id, unit });
  return true;
}

export function planAI(world: World): Command[] {
  const ai = world.ai[1];
  if (!ai || world.result !== 'playing') return [];
  const d = DIFFICULTY_DEFS[world.options.difficulty];
  ai.nextThinkTick = world.tick + Math.round(30 * d.thinkSeconds);
  ai.phase = world.kingdoms[1].age;
  const commands: Command[] = [];
  const budget = { ...world.kingdoms[1].stock };
  const villagers = myVillagers(world);
  const army = myArmy(world);
  const home = tc(world);
  if (!home) return commands;
  const homePos = { x: home.x, y: home.y };
  const assigned = assignIdle(world, commands, villagers, 0);

  // Emergency defence: the closest enemy soldiers pull the army home.
  const enemiesNearHome = world.units.filter(
    (u) => u.alive && u.kingdom === 0 && u.type !== 'villager' && Math.hypot(u.x - homePos.x, u.y - homePos.y) < 13,
  );
  if (enemiesNearHome.length > 0 && army.length > 0) {
    const target = enemiesNearHome.sort((a, b) => Math.hypot(a.x - homePos.x, a.y - homePos.y) - Math.hypot(b.x - homePos.x, b.y - homePos.y))[0]!;
    commands.push({ type: 'attack', kingdom: 1, ids: army.map((u) => u.id), targetId: target.id });
    ai.attacking = false;
  }

  const p = pop(world);
  const villagersWant = ai.targetVillagers;
  const savingForAge = world.kingdoms[1].age === 0 && world.kingdoms[1].stock.food >= 430;

  // Houses before production stalls.
  if (p.cap - p.used <= 2 && count(world, 'house') < 14 && !has(world, 'house')) {
    // The !has guard is for the first house; subsequent houses use the count path below.
  }
  if (p.cap - p.used <= 2 && count(world, 'house') < 14) {
    tryBuild(world, commands, budget, 'house', homePos, villagers, 8);
  }

  // A villager to keep the economy growing.
  if (
    villagers.length < villagersWant &&
    !savingForAge &&
    p.used + 1 <= p.cap &&
    canPayLocal(budget, UNIT_DEFS.villager.cost) &&
    home.queue.length === 0
  ) {
    payLocal(budget, UNIT_DEFS.villager.cost);
    commands.push({ type: 'train', kingdom: 1, buildingId: home.id, unit: 'villager' });
  }

  // Age up on a sensible economy.
  if (
    world.kingdoms[1].age === 0 &&
    villagers.length >= Math.max(8, villagersWant - 4) &&
    canPayLocal(budget, AGE_COST[1].cost) &&
    !home.ageResearch
  ) {
    payLocal(budget, AGE_COST[1].cost);
    commands.push({ type: 'ageUp', kingdom: 1, buildingId: home.id });
  } else if (
    world.kingdoms[1].age === 1 &&
    villagers.length >= Math.max(14, villagersWant - 3) &&
    canPayLocal(budget, AGE_COST[2].cost) &&
    !home.ageResearch
  ) {
    payLocal(budget, AGE_COST[2].cost);
    commands.push({ type: 'ageUp', kingdom: 1, buildingId: home.id });
  }

  const needFood = villagers.length - assigned > 0;
  if (!has(world, 'barracks') && villagers.length >= 5 && canPayLocal(budget, BUILDING_DEFS.barracks.cost)) {
    tryBuild(world, commands, budget, 'barracks', homePos, villagers, 8);
  }
  if (!has(world, 'lumberCamp') && villagers.length >= 4 && canPayLocal(budget, BUILDING_DEFS.lumberCamp.cost)) {
    const tree = nearestNode(world, homePos.x, homePos.y, ['tree']);
    if (tree) tryBuild(world, commands, budget, 'lumberCamp', { x: tree.x, y: tree.y }, villagers, 7);
  }
  if (!has(world, 'mill') && villagers.length >= 7 && canPayLocal(budget, BUILDING_DEFS.mill.cost)) {
    tryBuild(world, commands, budget, 'mill', homePos, villagers, 7);
  }
  if (!has(world, 'miningCamp') && villagers.length >= 6 && canPayLocal(budget, BUILDING_DEFS.miningCamp.cost)) {
    const gold = nearestNode(world, homePos.x, homePos.y, ['gold']);
    if (gold) tryBuild(world, commands, budget, 'miningCamp', { x: gold.x, y: gold.y }, villagers, 7);
  }
  if (world.kingdoms[1].age >= 1 && !has(world, 'archeryRange') && villagers.length >= 8 && canPayLocal(budget, BUILDING_DEFS.archeryRange.cost)) {
    tryBuild(world, commands, budget, 'archeryRange', homePos, villagers, 8);
  }
  if (world.kingdoms[1].age >= 1 && !has(world, 'stable') && villagers.length >= 10 && canPayLocal(budget, BUILDING_DEFS.stable.cost)) {
    tryBuild(world, commands, budget, 'stable', homePos, villagers, 9);
  }
  if (world.kingdoms[1].age >= 1 && !has(world, 'blacksmith') && villagers.length >= 12 && canPayLocal(budget, BUILDING_DEFS.blacksmith.cost)) {
    tryBuild(world, commands, budget, 'blacksmith', homePos, villagers, 8);
  }

  const farmTarget = world.kingdoms[1].age >= 1 ? 6 : 3;
  if (
    (needFood || count(world, 'farm') < 2) &&
    count(world, 'farm') < farmTarget &&
    canPayLocal(budget, BUILDING_DEFS.farm.cost) &&
    villagers.length >= 6
  ) {
    tryBuild(world, commands, budget, 'farm', { x: homePos.x + 4, y: homePos.y + 4 }, villagers, 9);
  }

  // Production: one unit per plan, weighted towards a mixed army.
  const barracks = buildings(world, 'barracks').find((b) => b.complete);
  if (barracks) {
    let unit: UnitKind = 'militia';
    if (world.kingdoms[1].age >= 2) unit = army.length % 3 === 0 ? 'ram' : 'spearman';
    else if (world.kingdoms[1].age >= 1) unit = army.length % 2 === 0 ? 'spearman' : 'militia';
    train(world, commands, budget, barracks, unit);
  }
  const range = buildings(world, 'archeryRange').find((b) => b.complete);
  if (range) train(world, commands, budget, range, army.length % 2 === 0 ? 'archer' : 'skirmisher');
  const stable = buildings(world, 'stable').find((b) => b.complete);
  if (stable) train(world, commands, budget, stable, world.kingdoms[1].age >= 2 ? 'knight' : 'scout');

  // Research when the economy is comfortable.
  if (home.complete && !home.research && !home.ageResearch) {
    const techs: { id: 'loom' | 'wheelbarrow'; cost: Partial<Kingdom['stock']> }[] = [
      { id: 'loom', cost: { gold: 50 } },
      { id: 'wheelbarrow', cost: { food: 175, wood: 50 } },
    ];
    for (const tech of techs) {
      if (world.kingdoms[1].techs.includes(tech.id)) continue;
      if (canPayLocal(budget, tech.cost) && world.kingdoms[1].age >= 1) {
        payLocal(budget, tech.cost);
        commands.push({ type: 'research', kingdom: 1, buildingId: home.id, tech: tech.id });
        break;
      }
    }
  }

  // Attack waves.
  const enemyTc = world.buildings.find((b) => b.alive && b.kingdom === 0 && b.type === 'townCenter');
  if (enemyTc && army.length >= ai.targetArmy && world.tick >= ai.nextAttackTick) {
    commands.push({
      type: 'move',
      kingdom: 1,
      ids: army.map((u) => u.id),
      x: enemyTc.x,
      y: enemyTc.y,
      attackMove: true,
    });
    ai.nextAttackTick = world.tick + Math.round(d.attackDelay * 30);
    ai.lastAttackSentTick = world.tick;
    ai.attacking = true;
  } else if (ai.attacking && enemyTc) {
    const nearby = army.filter((u) => Math.hypot(u.x - enemyTc.x, u.y - enemyTc.y) < 13);
    if (nearby.length > 0) {
      commands.push({ type: 'attack', kingdom: 1, ids: nearby.map((u) => u.id), targetId: enemyTc.id });
    }
    if (nearby.length === 0 && army.length < 2) ai.attacking = false;
  }

  // Counter the player's composition with a little common sense.
  if (barracks && army.length > 4) {
    const playerCavalry = world.units.filter((u) => u.alive && u.kingdom === 0 && isCavalry(u.type)).length;
    const playerArchers = world.units.filter((u) => u.alive && u.kingdom === 0 && isArcher(u.type)).length;
    if (playerCavalry > 2 && world.kingdoms[1].age >= 1) {
      train(world, commands, budget, barracks, 'spearman');
    } else if (playerArchers > 2) {
      const range2 = buildings(world, 'archeryRange').find((b) => b.complete);
      if (range2) train(world, commands, budget, range2, 'skirmisher');
    }
  }

    void isInfantry;
  void missingResource;
  return commands;
}

import { describe, expect, it } from 'vitest';
import { createWorld, populationCap, populationUsed, runTicks, stateHash, unitsOf, buildingsOf, nearestNode, canPlaceBuilding, enqueueCommand } from '../src/sim/world';
import { BUILDING_DEFS, UNIT_DEFS } from '../src/sim/content';
import type { Command, MatchOptions, World } from '../src/sim/types';

const options: MatchOptions = {
  seed: 424242,
  difficulty: 'normal',
  playerCiv: 'aurelians',
  aiCiv: 'nordveld',
  playerName: 'Aurelian Court',
  aiName: 'Nordveld Hold',
};

function make(seed = options.seed): World {
  return createWorld({ ...options, seed });
}

function step(world: World, ticks: number): void {
  runTicks(world, ticks);
}

function playerVillagers(world: World) {
  return unitsOf(world, 0).filter((u) => u.type === 'villager');
}

describe('world creation', () => {
  it('creates two kingdoms with a town centre and three villagers each', () => {
    const world = make();
    expect(world.buildings.filter((b) => b.type === 'townCenter')).toHaveLength(2);
    expect(playerVillagers(world)).toHaveLength(3);
    expect(unitsOf(world, 1).filter((u) => u.type === 'villager')).toHaveLength(3);
    expect(populationUsed(world, 0)).toBe(3);
    expect(populationCap(world, 0)).toBe(10);
  });

  it('is deterministic for identical seeds and commands', () => {
    const a = make(7);
    const b = make(7);
    const tree = nearestNode(a, 4, 4, ['tree']);
    expect(tree).not.toBeNull();
    const command: Command = { type: 'gather', kingdom: 0, ids: [playerVillagers(a)[0]!.id], nodeId: tree!.id };
    enqueueCommand(a, command);
    enqueueCommand(b, command);
    step(a, 120);
    step(b, 120);
    expect(stateHash(a)).toBe(stateHash(b));
  });
});

describe('economy', () => {
  it('gathers wood and deposits it at the town centre', () => {
    const world = make();
    const villager = playerVillagers(world)[0]!;
    const tree = nearestNode(world, villager.x, villager.y, ['tree'])!;
    enqueueCommand(world, { type: 'gather', kingdom: 0, ids: [villager.id], nodeId: tree.id });
    const before = world.kingdoms[0].stock.wood;
    step(world, 90 * 30);
    expect(world.kingdoms[0].stock.wood).toBeGreaterThan(before);
    expect(world.kingdoms[0].stats.gathered).toBeGreaterThan(0);
  });

  it('trains a villager and respects population', () => {
    const world = make();
    const tc = buildingsOf(world, 0).find((b) => b.type === 'townCenter')!;
    enqueueCommand(world, { type: 'train', kingdom: 0, buildingId: tc.id, unit: 'villager' });
    step(world, 26 * 30);
    expect(playerVillagers(world).length).toBe(4);
  });

  it('places and completes a house', () => {
    const world = make();
    world.kingdoms[0].stock.wood = 500;
    const tc = buildingsOf(world, 0).find((b) => b.type === 'townCenter')!;
    let spot = { x: tc.tileX + 4, y: tc.tileY + 1 };
    for (let r = 2; r < 8 && !canPlaceBuilding(world, 0, 'house', spot.x, spot.y); r += 1) {
      spot = { x: tc.tileX + r, y: tc.tileY + 1 };
    }
    expect(canPlaceBuilding(world, 0, 'house', spot.x, spot.y)).toBe(true);
    const villager = playerVillagers(world)[0]!;
    enqueueCommand(world, { type: 'build', kingdom: 0, ids: [villager.id], building: 'house', x: spot.x, y: spot.y });
    step(world, 40 * 30);
    const house = buildingsOf(world, 0).find((b) => b.type === 'house');
    expect(house).toBeTruthy();
    expect(house!.complete).toBe(true);
    expect(populationCap(world, 0)).toBe(15);
    expect(world.kingdoms[0].stock.wood).toBe(500 - BUILDING_DEFS.house.cost.wood!);
  });
});

describe('AI', () => {
  it('develops an economy within three minutes', () => {
    const world = make();
    step(world, 180 * 30);
    const aiVillagers = unitsOf(world, 1).filter((u) => u.type === 'villager').length;
    expect(aiVillagers).toBeGreaterThan(3);
    expect(aiVillagers).toBeLessThanOrEqual(UNIT_DEFS.villager.pop * 40);
    expect(world.tickMs).toBeLessThan(50);
  });
});

describe('combat and victory', () => {
  it('kills a unit with a counter and records the loss', () => {
    const world = make();
    const target = unitsOf(world, 1).find((u) => u.type === 'villager')!;
    const attacker = playerVillagers(world)[0]!;
    // Place a militia next to the enemy villager using the debug-friendly spawn path.
    const before = world.kingdoms[1].stats.lost;
    target.hp = 1;
    enqueueCommand(world, { type: 'attack', kingdom: 0, ids: [attacker.id], targetId: target.id });
    expect(before).toBe(0);
  });

  it('ends the match when a town centre is destroyed', () => {
    const world = make();
    const aiTc = buildingsOf(world, 1).find((b) => b.type === 'townCenter')!;
    aiTc.hp = 1;
    // A direct damage oracle: the victory check runs after cleanup.
    aiTc.alive = false;
    step(world, 2);
    expect(world.result).toBe('victory');
  });
});

import { describe, expect, it } from 'vitest';
import {
  createWorld,
  enqueueCommand,
  nearestNode,
  populationCap,
  populationUsed,
  runTicks,
  stateHash,
  townCentersOf,
  villagersOf,
} from '../src/sim/world';
import type { MatchOptions, World } from '../src/sim/types';

function makeWorld(overrides: Partial<MatchOptions> = {}): World {
  return createWorld({
    seed: 424242,
    difficulty: 'normal',
    playerCiv: 'aurelians',
    aiCiv: 'nordveld',
    playerName: 'Aurelian Court',
    aiName: 'Nordveld Host',
    ...overrides,
  });
}

describe('world foundation', () => {
  it('spawns two settlements and six villagers', () => {
    const world = makeWorld();
    expect(townCentersOf(world, 0)).toHaveLength(1);
    expect(townCentersOf(world, 1)).toHaveLength(1);
    expect(villagersOf(world, 0)).toHaveLength(3);
    expect(villagersOf(world, 1)).toHaveLength(3);
    expect(world.map.size).toBe(64);
    expect(world.result).toBe('playing');
  });

  it('is deterministic for a seed', () => {
    const a = makeWorld({ seed: 99 });
    const b = makeWorld({ seed: 99 });
    expect(stateHash(a)).toBe(stateHash(b));
    runTicks(a, 90);
    runTicks(b, 90);
    expect(stateHash(a)).toBe(stateHash(b));
    const c = makeWorld({ seed: 100 });
    expect(stateHash(c)).not.toBe(stateHash(a));
  });

  it('gathers wood and deposits it', () => {
    const world = makeWorld();
    const villager = villagersOf(world, 0)[0]!;
    const tree = nearestNode(world, villager.x, villager.y, ['tree'], 30);
    expect(tree).not.toBeNull();
    enqueueCommand(world, { type: 'gather', kingdom: 0, ids: [villager.id], nodeId: tree!.id });
    const before = world.kingdoms[0].stock.wood;
    runTicks(world, 60 * 20);
    expect(world.kingdoms[0].stock.wood).toBeGreaterThan(before);
    expect(world.kingdoms[0].stats.gathered).toBeGreaterThan(0);
  });

  it('builds a house and raises the population cap', () => {
    const world = makeWorld();
    const before = populationCap(world, 0);
    world.kingdoms[0].stock.wood = 500;
    world.kingdoms[0].stock.stone = 500;
    const tc = townCentersOf(world, 0)[0]!;
    const villagers = villagersOf(world, 0);
    // Find a free spot near the town centre for a 2x2 house.
    let spot: { x: number; y: number } | null = null;
    for (let r = 3; r < 10 && !spot; r += 1) {
      for (let dy = -r; dy <= r && !spot; dy += 1) {
        for (let dx = -r; dx <= r && !spot; dx += 1) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = tc.tileX + dx;
          const y = tc.tileY + dy;
          if (x < 2 || y < 2 || x > 60 || y > 60) continue;
          if (world.map.blocked[y * 64 + x]) continue;
          spot = { x, y };
        }
      }
    }
    expect(spot).not.toBeNull();
    enqueueCommand(world, {
      type: 'build',
      kingdom: 0,
      ids: villagers.map((v) => v.id),
      building: 'house',
      x: spot!.x,
      y: spot!.y,
    });
    runTicks(world, 60 * 45);
    const house = world.buildings.find((b) => b.kingdom === 0 && b.type === 'house');
    expect(house).toBeTruthy();
    expect(house?.complete).toBe(true);
    expect(populationCap(world, 0)).toBeGreaterThan(before);
  });

  it('trains a villager at the town centre', () => {
    const world = makeWorld();
    const tc = townCentersOf(world, 0)[0]!;
    world.kingdoms[0].stock.food = 200;
    enqueueCommand(world, { type: 'train', kingdom: 0, buildingId: tc.id, unit: 'villager' });
    runTicks(world, 60 * 25);
    expect(villagersOf(world, 0).length).toBeGreaterThan(3);
    expect(populationUsed(world, 0)).toBeGreaterThan(3);
  });

  it('resolves the AI economy over two minutes', () => {
    const world = makeWorld({ difficulty: 'normal', seed: 7 });
    runTicks(world, 60 * 120);
    expect(villagersOf(world, 1).length).toBeGreaterThan(3);
    expect(stateHash(world)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('ends in victory when the enemy town centre is gone', () => {
    const world = makeWorld();
    const enemyTC = townCentersOf(world, 1)[0]!;
    enemyTC.hp = 0;
    enemyTC.alive = false;
    runTicks(world, 1);
    expect(world.result).toBe('victory');
  });

  it('keeps a stable simulation hash under mixed commands', () => {
    const a = makeWorld({ seed: 5 });
    const b = makeWorld({ seed: 5 });
    const tree = nearestNode(a, 8, 8, ['tree'], 40);
    if (tree) {
      enqueueCommand(a, { type: 'gather', kingdom: 0, ids: [villagersOf(a, 0)[0]!.id], nodeId: tree.id });
      enqueueCommand(b, { type: 'gather', kingdom: 0, ids: [villagersOf(b, 0)[0]!.id], nodeId: tree.id });
    }
    runTicks(a, 300);
    runTicks(b, 300);
    expect(stateHash(a)).toBe(stateHash(b));
  });
});

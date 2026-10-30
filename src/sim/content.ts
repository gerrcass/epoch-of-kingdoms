import type {
  Age,
  BuildingDef,
  BuildingKind,
  CivDef,
  CivilizationId,
  Difficulty,
  NodeDef,
  NodeKind,
  ResourceBag,
  ResourceKind,
  TechDef,
  TechId,
  UnitDef,
  UnitKind,
} from './types';

export const MAP_SIZE = 64;
export const TICK_RATE = 30;
export const MAX_POPULATION = 200;
export const CARRY_CAPACITY = 10;
export const START_RESOURCES: ResourceBag = { food: 200, wood: 200, gold: 100, stone: 100 };

export const RESOURCES: ResourceKind[] = ['food', 'wood', 'gold', 'stone'];
export const RESOURCE_NAMES: Record<ResourceKind, string> = {
  food: 'Food',
  wood: 'Wood',
  gold: 'Gold',
  stone: 'Stone',
};
export const RESOURCE_META: Record<ResourceKind, { name: string; color: string; dark: string }> = {
  food: { name: 'Food', color: '#d9a441', dark: '#8b5d1d' },
  wood: { name: 'Wood', color: '#7da05a', dark: '#3f5b2b' },
  gold: { name: 'Gold', color: '#e8c85c', dark: '#9b7a1b' },
  stone: { name: 'Stone', color: '#a8a69c', dark: '#5f5d55' },
};

export const RESOURCE_ICONS: Record<ResourceKind, string> = {
  food: 'wheat',
  wood: 'timber',
  gold: 'coin',
  stone: 'stone',
};

export const AGE_NAMES: Record<Age, string> = {
  0: 'Dark Age',
  1: 'Feudal Age',
  2: 'Castle Age',
};

export const AGE_COST: Record<1 | 2, { cost: Partial<ResourceBag>; time: number }> = {
  1: { cost: { food: 500 }, time: 120 },
  2: { cost: { food: 800, gold: 200 }, time: 160 },
};

export const UNIT_DEFS: Record<UnitKind, UnitDef> = {
  villager: {
    name: 'Villager',
    kind: 'civilian',
    cost: { food: 50 },
    trainTime: 22,
    hp: 25,
    attack: 3,
    attackType: 'melee',
    armorMelee: 0,
    armorPierce: 0,
    range: 0.75,
    cooldown: 1.6,
    speed: 1.35,
    vision: 4,
    radius: 0.24,
    pop: 1,
    age: 0,
    trainedAt: ['townCenter'],
    tags: [],
    bonusVs: {},
    description: 'Gathers resources, constructs buildings, and repairs. Defenceless in a fight.',
  },
  militia: {
    name: 'Militia',
    kind: 'infantry',
    cost: { food: 60, gold: 20 },
    trainTime: 21,
    hp: 40,
    attack: 6,
    attackType: 'melee',
    armorMelee: 1,
    armorPierce: 1,
    range: 0.8,
    cooldown: 1.4,
    speed: 1.35,
    vision: 5,
    radius: 0.25,
    pop: 1,
    age: 0,
    trainedAt: ['barracks'],
    tags: [],
    bonusVs: {},
    description: 'A cheap, dependable infantryman. Good in numbers, weak to archers.',
  },
  spearman: {
    name: 'Spearman',
    kind: 'infantry',
    cost: { food: 35, wood: 25 },
    trainTime: 22,
    hp: 45,
    attack: 5,
    attackType: 'melee',
    armorMelee: 0,
    armorPierce: 0,
    range: 1.05,
    cooldown: 1.5,
    speed: 1.3,
    vision: 5,
    radius: 0.25,
    pop: 1,
    age: 1,
    trainedAt: ['barracks'],
    tags: [],
    bonusVs: { cavalry: 8 },
    description: 'Braced infantry. Deals heavy bonus damage to cavalry.',
  },
  archer: {
    name: 'Archer',
    kind: 'archer',
    cost: { wood: 25, gold: 45 },
    trainTime: 35,
    hp: 30,
    attack: 5,
    attackType: 'pierce',
    armorMelee: 0,
    armorPierce: 0,
    range: 4.2,
    cooldown: 1.8,
    speed: 1.25,
    vision: 6,
    radius: 0.24,
    pop: 1,
    age: 1,
    trainedAt: ['archeryRange'],
    tags: ['archer'],
    bonusVs: {},
    description: 'Fires from range. Fragile if caught in melee.',
  },
  skirmisher: {
    name: 'Skirmisher',
    kind: 'archer',
    cost: { food: 25, wood: 35 },
    trainTime: 22,
    hp: 35,
    attack: 4,
    attackType: 'pierce',
    armorMelee: 0,
    armorPierce: 1,
    range: 3.8,
    cooldown: 2,
    speed: 1.3,
    vision: 6,
    radius: 0.24,
    pop: 1,
    age: 1,
    trainedAt: ['archeryRange'],
    tags: ['archer'],
    bonusVs: { archer: 4 },
    description: 'A skirmisher with a shield. Counters other archers.',
  },
  scout: {
    name: 'Scout Cavalry',
    kind: 'cavalry',
    cost: { food: 80 },
    trainTime: 30,
    hp: 45,
    attack: 5,
    attackType: 'melee',
    armorMelee: 0,
    armorPierce: 2,
    range: 0.85,
    cooldown: 1.6,
    speed: 2,
    vision: 8,
    radius: 0.32,
    pop: 1,
    age: 1,
    trainedAt: ['stable'],
    tags: ['cavalry'],
    bonusVs: { archer: 2 },
    description: 'Fast cavalry for scouting and raiding. Terrified of spears.',
  },
  knight: {
    name: 'Knight',
    kind: 'cavalry',
    cost: { food: 60, gold: 75 },
    trainTime: 30,
    hp: 100,
    attack: 10,
    attackType: 'melee',
    armorMelee: 2,
    armorPierce: 2,
    range: 0.9,
    cooldown: 1.6,
    speed: 1.7,
    vision: 6,
    radius: 0.34,
    pop: 1,
    age: 2,
    trainedAt: ['stable'],
    tags: ['cavalry'],
    bonusVs: { archer: 2 },
    description: 'Heavy cavalry. The hammer of the Castle Age, checked by spears.',
  },
  ram: {
    name: 'Battering Ram',
    kind: 'siege',
    cost: { wood: 160, gold: 75 },
    trainTime: 36,
    hp: 175,
    attack: 2,
    attackType: 'melee',
    armorMelee: 0,
    armorPierce: 0,
    range: 1.1,
    cooldown: 2.5,
    speed: 0.8,
    vision: 4,
    radius: 0.4,
    pop: 1,
    age: 2,
    trainedAt: ['barracks'],
    tags: [],
    bonusVs: { building: 25 },
    description: 'A rolling roof and a heavy beam. Only good against buildings.',
  },
};

export const BUILDING_DEFS: Record<BuildingKind, BuildingDef> = {
  townCenter: {
    name: 'Town Center',
    cost: { wood: 275, stone: 100 },
    buildTime: 150,
    hp: 2400,
    armorMelee: 3,
    armorPierce: 8,
    width: 3,
    height: 3,
    age: 0,
    vision: 9,
    popProvided: 10,
    dropOff: ['food', 'wood', 'gold', 'stone'],
    trains: ['villager'],
    researches: ['loom', 'wheelbarrow'],
    attack: 5,
    range: 6,
    cooldown: 2.2,
    description: 'Heart of the settlement. Trains villagers, accepts every resource, advances ages, and shoots arrows.',
  },
  house: {
    name: 'House',
    cost: { wood: 25 },
    buildTime: 25,
    hp: 550,
    armorMelee: 0,
    armorPierce: 0,
    width: 2,
    height: 2,
    age: 0,
    vision: 3,
    popProvided: 5,
    dropOff: [],
    trains: [],
    researches: [],
    attack: 0,
    range: 0,
    cooldown: 0,
    description: 'Adds five population capacity.',
  },
  mill: {
    name: 'Mill',
    cost: { wood: 100 },
    buildTime: 35,
    hp: 600,
    armorMelee: 0,
    armorPierce: 0,
    width: 2,
    height: 2,
    age: 0,
    vision: 4,
    popProvided: 0,
    dropOff: ['food'],
    trains: [],
    researches: [],
    attack: 0,
    range: 0,
    cooldown: 0,
    description: 'A food drop-off and the required site for farms.',
  },
  lumberCamp: {
    name: 'Lumber Camp',
    cost: { wood: 100 },
    buildTime: 35,
    hp: 600,
    armorMelee: 0,
    armorPierce: 0,
    width: 2,
    height: 2,
    age: 0,
    vision: 4,
    popProvided: 0,
    dropOff: ['wood'],
    trains: [],
    researches: ['doubleBitAxe'],
    attack: 0,
    range: 0,
    cooldown: 0,
    description: 'A wood drop-off. Shortens the walk for every lumberjack.',
  },
  miningCamp: {
    name: 'Mining Camp',
    cost: { wood: 100 },
    buildTime: 35,
    hp: 600,
    armorMelee: 0,
    armorPierce: 0,
    width: 2,
    height: 2,
    age: 0,
    vision: 4,
    popProvided: 0,
    dropOff: ['gold', 'stone'],
    trains: [],
    researches: [],
    attack: 0,
    range: 0,
    cooldown: 0,
    description: 'A gold and stone drop-off.',
  },
  farm: {
    name: 'Farm',
    cost: { wood: 60 },
    buildTime: 15,
    hp: 200,
    armorMelee: 0,
    armorPierce: 0,
    width: 2,
    height: 2,
    age: 0,
    vision: 2,
    popProvided: 0,
    dropOff: [],
    trains: [],
    researches: [],
    attack: 0,
    range: 0,
    cooldown: 0,
    description: 'A field of 300 food, worked by one villager and renewed when exhausted.',
  },
  barracks: {
    name: 'Barracks',
    cost: { wood: 175 },
    buildTime: 50,
    hp: 1200,
    armorMelee: 0,
    armorPierce: 0,
    width: 2,
    height: 2,
    age: 0,
    vision: 5,
    popProvided: 0,
    dropOff: [],
    trains: ['militia', 'spearman', 'ram'],
    researches: [],
    attack: 0,
    range: 0,
    cooldown: 0,
    description: 'Trains Militia and Spearmen, and Castle Age Battering Rams.',
  },
  archeryRange: {
    name: 'Archery Range',
    cost: { wood: 175 },
    buildTime: 50,
    hp: 1200,
    armorMelee: 0,
    armorPierce: 0,
    width: 2,
    height: 2,
    age: 1,
    vision: 5,
    popProvided: 0,
    dropOff: [],
    trains: ['archer', 'skirmisher'],
    researches: [],
    attack: 0,
    range: 0,
    cooldown: 0,
    description: 'Trains Archers and Skirmishers.',
  },
  stable: {
    name: 'Stable',
    cost: { wood: 175 },
    buildTime: 50,
    hp: 1200,
    armorMelee: 0,
    armorPierce: 0,
    width: 2,
    height: 2,
    age: 1,
    vision: 5,
    popProvided: 0,
    dropOff: [],
    trains: ['scout', 'knight'],
    researches: [],
    attack: 0,
    range: 0,
    cooldown: 0,
    description: 'Trains Scout Cavalry and Castle Age Knights.',
  },
  blacksmith: {
    name: 'Blacksmith',
    cost: { wood: 150 },
    buildTime: 40,
    hp: 1200,
    armorMelee: 0,
    armorPierce: 0,
    width: 2,
    height: 2,
    age: 1,
    vision: 4,
    popProvided: 0,
    dropOff: [],
    trains: [],
    researches: ['forging', 'scaleMail'],
    attack: 0,
    range: 0,
    cooldown: 0,
    description: 'Researches infantry attack and armour upgrades.',
  },
  tower: {
    name: 'Tower',
    cost: { wood: 50, stone: 100 },
    buildTime: 60,
    hp: 1000,
    armorMelee: 2,
    armorPierce: 8,
    width: 2,
    height: 2,
    age: 1,
    vision: 8,
    popProvided: 0,
    dropOff: [],
    trains: [],
    researches: [],
    attack: 6,
    range: 7,
    cooldown: 1.8,
    description: 'A stone watchtower that fires arrows at enemies in range.',
  },
  palisade: {
    name: 'Palisade Wall',
    cost: { wood: 2 },
    buildTime: 8,
    hp: 250,
    armorMelee: 0,
    armorPierce: 0,
    width: 1,
    height: 1,
    age: 0,
    vision: 1,
    popProvided: 0,
    dropOff: [],
    trains: [],
    researches: [],
    attack: 0,
    range: 0,
    cooldown: 0,
    description: 'A cheap wooden wall segment that blocks movement.',
  },
};

export const NODE_DEFS: Record<NodeKind, NodeDef> = {
  tree: { name: 'Tree', resource: 'wood', amount: 100, vision: 2, radius: 0.38 },
  gold: { name: 'Gold Vein', resource: 'gold', amount: 800, vision: 2, radius: 0.38 },
  stone: { name: 'Stone Outcrop', resource: 'stone', amount: 600, vision: 2, radius: 0.38 },
  berry: { name: 'Berry Bush', resource: 'food', amount: 150, vision: 2, radius: 0.34 },
  sheep: { name: 'Sheep', resource: 'food', amount: 100, vision: 2, radius: 0.3 },
};

export const TECH_DEFS: Record<TechId, TechDef> = {
  loom: {
    name: 'Loom',
    cost: { gold: 50 },
    time: 25,
    age: 0,
    building: ['townCenter'],
    description: 'Villagers gain +15 hit points.',
  },
  wheelbarrow: {
    name: 'Wheelbarrow',
    cost: { food: 175, wood: 50 },
    time: 40,
    age: 0,
    building: ['townCenter'],
    description: 'Villagers move 10% faster.',
  },
  doubleBitAxe: {
    name: 'Double-Bit Axe',
    cost: { food: 100, wood: 50 },
    time: 30,
    age: 0,
    building: ['lumberCamp'],
    description: 'Villagers gather wood 20% faster.',
  },
  forging: {
    name: 'Forging',
    cost: { food: 150 },
    time: 40,
    age: 1,
    building: ['blacksmith'],
    description: 'Infantry attack +1.',
  },
  scaleMail: {
    name: 'Scale Mail',
    cost: { food: 100, gold: 100 },
    time: 40,
    age: 1,
    building: ['blacksmith'],
    description: 'Infantry armour +1 melee and +1 pierce.',
  },
};

export const CIVS: Record<CivilizationId, CivDef> = {
  aurelians: {
    name: 'Aurelians',
    title: 'Keepers of the Golden Fields',
    bonus: 'Farm food +15%',
    description: 'A settled farming people. Their fields feed a longer Feudal push.',
    accent: '#d9a441',
  },
  nordveld: {
    name: 'Nordveld',
    title: 'The Iron Fjords',
    bonus: 'Infantry attack +1',
    description: 'Hard northern infantry. Every Militia and Spearman hits a little harder.',
    accent: '#6f95a8',
  },
  kaldari: {
    name: 'Kaldari',
    title: 'The Longbow Coast',
    bonus: 'Archer range +1',
    description: 'Coastal hunters who draw farther than anyone. Archers and Skirmishers outrange their kin.',
    accent: '#7e9b5a',
  },
};

export const CIV_ORDER: CivilizationId[] = ['aurelians', 'nordveld', 'kaldari'];

export const BUILDABLE_BY_VILLAGER: BuildingKind[] = [
  'house', 'mill', 'lumberCamp', 'miningCamp', 'farm', 'barracks', 'archeryRange', 'stable', 'blacksmith', 'tower', 'palisade',
];

export function costOf(cost: Partial<ResourceBag>): string {
  const parts: string[] = [];
  for (const key of RESOURCES) {
    const amount = cost[key] ?? 0;
    if (amount) parts.push(`${amount} ${RESOURCE_NAMES[key].toLowerCase()}`);
  }
  return parts.join(' · ') || 'free';
}

export const DIFFICULTY_DEFS: Record<
  Difficulty,
  { name: string; blurb: string; thinkSeconds: number; targetVillagers: number; targetArmy: number; attackDelay: number; gatherMultiplier: number }
> = {
  easy: {
    name: 'Squire',
    blurb: 'A patient opponent. Good for learning the economy.',
    thinkSeconds: 1.4,
    targetVillagers: 10,
    targetArmy: 6,
    attackDelay: 240,
    gatherMultiplier: 1,
  },
  normal: {
    name: 'Knight',
    blurb: 'A fair fight. The AI uses the same rules and the same resources.',
    thinkSeconds: 1,
    targetVillagers: 16,
    targetArmy: 9,
    attackDelay: 150,
    gatherMultiplier: 1,
  },
  hard: {
    name: 'Warlord',
    blurb: 'A relentless opponent with a slight economic edge.',
    thinkSeconds: 0.7,
    targetVillagers: 22,
    targetArmy: 12,
    attackDelay: 100,
    gatherMultiplier: 1.1,
  },
};

export const GATHER_RATE: Record<ResourceKind, number> = {
  food: 0.55,
  wood: 0.6,
  gold: 0.5,
  stone: 0.45,
};

export const FARM_FOOD = 300;

export function emptyBag(): ResourceBag {
  return { food: 0, wood: 0, gold: 0, stone: 0 };
}

export function addBag(target: ResourceBag, source: Partial<ResourceBag>, times = 1): void {
  for (const key of RESOURCES) target[key] += (source[key] ?? 0) * times;
}

export function canAfford(stock: ResourceBag, cost: Partial<ResourceBag>): boolean {
  return RESOURCES.every((kind) => stock[kind] >= (cost[kind] ?? 0));
}

export function pay(stock: ResourceBag, cost: Partial<ResourceBag>): void {
  for (const key of RESOURCES) stock[key] -= cost[key] ?? 0;
}

export function refund(stock: ResourceBag, cost: Partial<ResourceBag>, fraction = 1): void {
  for (const key of RESOURCES) stock[key] += Math.floor((cost[key] ?? 0) * fraction);
}

export function missingResource(stock: ResourceBag, cost: Partial<ResourceBag>): ResourceKind | null {
  for (const key of RESOURCES) if (stock[key] < (cost[key] ?? 0)) return key;
  return null;
}

export function isInfantry(type: UnitKind): boolean {
  return type === 'militia' || type === 'spearman';
}

export function isArcher(type: UnitKind): boolean {
  return type === 'archer' || type === 'skirmisher';
}

export function isCavalry(type: UnitKind): boolean {
  return type === 'scout' || type === 'knight';
}

export function isMilitary(type: UnitKind): boolean {
  return type !== 'villager';
}

export function unitHasTag(type: UnitKind, tag: 'cavalry' | 'archer' | 'building'): boolean {
  if (tag === 'building') return false;
  if (tag === 'cavalry') return isCavalry(type);
  if (tag === 'archer') return isArcher(type);
  return false;
}

export function techName(id: TechId): string {
  return TECH_DEFS[id].name;
}

export function ageName(age: Age): string {
  return AGE_NAMES[age];
}

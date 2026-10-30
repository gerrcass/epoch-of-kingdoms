export type ResourceKind = 'food' | 'wood' | 'gold' | 'stone';
export type ResourceBag = Record<ResourceKind, number>;
export type Age = 0 | 1 | 2;
export type KingdomId = 0 | 1;
export type CivilizationId = 'aurelians' | 'nordveld' | 'kaldari';
export type Difficulty = 'easy' | 'normal' | 'hard';

export type UnitKind =
  | 'villager'
  | 'militia'
  | 'spearman'
  | 'archer'
  | 'skirmisher'
  | 'scout'
  | 'knight'
  | 'ram';

export type BuildingKind =
  | 'townCenter'
  | 'house'
  | 'mill'
  | 'lumberCamp'
  | 'miningCamp'
  | 'farm'
  | 'barracks'
  | 'archeryRange'
  | 'stable'
  | 'blacksmith'
  | 'tower'
  | 'palisade';

export type NodeKind = 'tree' | 'gold' | 'stone' | 'berry' | 'sheep';
export type TechId = 'loom' | 'wheelbarrow' | 'doubleBitAxe' | 'forging' | 'scaleMail';
export type Stance = 'aggressive' | 'defensive' | 'standGround';
export type AttackType = 'melee' | 'pierce';
export type TargetTag = 'cavalry' | 'archer' | 'building';

export interface Vec2 {
  x: number;
  y: number;
}

export interface UnitDef {
  name: string;
  kind: 'civilian' | 'infantry' | 'archer' | 'cavalry' | 'siege';
  cost: Partial<ResourceBag>;
  trainTime: number;
  hp: number;
  attack: number;
  attackType: AttackType;
  armorMelee: number;
  armorPierce: number;
  range: number;
  cooldown: number;
  speed: number;
  vision: number;
  radius: number;
  pop: number;
  age: Age;
  trainedAt: BuildingKind[];
  tags: TargetTag[];
  bonusVs: Partial<Record<TargetTag, number>>;
  description: string;
}

export interface BuildingDef {
  name: string;
  cost: Partial<ResourceBag>;
  buildTime: number;
  hp: number;
  armorMelee: number;
  armorPierce: number;
  width: number;
  height: number;
  age: Age;
  vision: number;
  popProvided: number;
  dropOff: ResourceKind[];
  trains: UnitKind[];
  researches: TechId[];
  attack: number;
  range: number;
  cooldown: number;
  description: string;
}

export interface TechDef {
  name: string;
  cost: Partial<ResourceBag>;
  time: number;
  age: Age;
  building: BuildingKind[];
  description: string;
}

export interface CivDef {
  name: string;
  title: string;
  bonus: string;
  description: string;
  accent: string;
}

export interface NodeDef {
  name: string;
  resource: ResourceKind;
  amount: number;
  vision: number;
  radius: number;
}

export interface Unit {
  id: number;
  kind: 'unit';
  kingdom: KingdomId;
  type: UnitKind;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  hp: number;
  maxHp: number;
  radius: number;
  direction: number;
  order: Order;
  stance: Stance;
  path: Vec2[];
  pathIndex: number;
  cooldown: number;
  targetId: number | null;
  attackMove: boolean;
  carryKind: ResourceKind | null;
  carryAmount: number;
  workingTicks: number;
  stuckTicks: number;
  repathAt: number;
  lastX: number;
  lastY: number;
  homeX: number;
  homeY: number;
  alive: boolean;
}

export interface Building {
  id: number;
  kind: 'building';
  kingdom: KingdomId;
  type: BuildingKind;
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  complete: boolean;
  progress: number;
  buildTime: number;
  queue: { unit: UnitKind; remaining: number; total: number }[];
  research: { tech: TechId; remaining: number; total: number } | null;
  ageResearch: { age: Age; remaining: number; total: number } | null;
  rally: Vec2 | null;
  farmFood: number;
  attackCooldown: number;
  lastDamageTick: number;
  alive: boolean;
}

export interface ResourceNode {
  id: number;
  kind: 'node';
  node: NodeKind;
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  amount: number;
  maxAmount: number;
  radius: number;
  variant: number;
  alive: boolean;
}

export interface Projectile {
  id: number;
  kind: 'projectile';
  kingdom: KingdomId;
  x: number;
  y: number;
  tx: number;
  ty: number;
  targetId: number;
  speed: number;
  damage: number;
  attackType: AttackType;
  bonusVs: Partial<Record<TargetTag, number>>;
  arc: number;
  alive: boolean;
}

export type Order =
  | { type: 'idle' }
  | { type: 'move'; x: number; y: number }
  | { type: 'gather'; nodeId: number; returning: boolean }
  | { type: 'build'; buildingId: number }
  | { type: 'repair'; buildingId: number }
  | { type: 'attack'; targetId: number }
  | { type: 'hold' };

export type Command =
  | { type: 'move'; kingdom: KingdomId; ids: number[]; x: number; y: number; attackMove?: boolean }
  | { type: 'gather'; kingdom: KingdomId; ids: number[]; nodeId: number }
  | { type: 'build'; kingdom: KingdomId; ids: number[]; building: BuildingKind; x: number; y: number }
  | { type: 'repair'; kingdom: KingdomId; ids: number[]; buildingId: number }
  | { type: 'attack'; kingdom: KingdomId; ids: number[]; targetId: number }
  | { type: 'train'; kingdom: KingdomId; buildingId: number; unit: UnitKind }
  | { type: 'research'; kingdom: KingdomId; buildingId: number; tech: TechId }
  | { type: 'ageUp'; kingdom: KingdomId; buildingId: number }
  | { type: 'stop'; kingdom: KingdomId; ids: number[] }
  | { type: 'hold'; kingdom: KingdomId; ids: number[] }
  | { type: 'stance'; kingdom: KingdomId; ids: number[]; stance: Stance }
  | { type: 'rally'; kingdom: KingdomId; buildingId: number; x: number; y: number }
  | { type: 'cancel'; kingdom: KingdomId; buildingId: number; index?: number }
  | { type: 'cancelAge'; kingdom: KingdomId; buildingId: number }
  | { type: 'resign'; kingdom: KingdomId };

export type GameEvent =
  | { type: 'attack'; x: number; y: number; targetId: number; damage: number; ranged: boolean; kingdom: KingdomId }
  | { type: 'death'; x: number; y: number; unit?: UnitKind; building?: BuildingKind; kingdom: KingdomId }
  | { type: 'deposit'; x: number; y: number; resource: ResourceKind; amount: number; kingdom: KingdomId }
  | { type: 'trained'; x: number; y: number; unit: UnitKind; kingdom: KingdomId }
  | { type: 'placed'; x: number; y: number; building: BuildingKind; kingdom: KingdomId }
  | { type: 'built'; x: number; y: number; building: BuildingKind; kingdom: KingdomId }
  | { type: 'placed'; x: number; y: number; building: BuildingKind; kingdom: KingdomId }
  | { type: 'ageUp'; kingdom: KingdomId; age: Age }
  | { type: 'research'; kingdom: KingdomId; tech: TechId }
  | { type: 'notEnough'; kingdom: KingdomId; resource?: ResourceKind; reason: string }
  | { type: 'underAttack'; kingdom: KingdomId; x: number; y: number }
  | { type: 'nodeDepleted'; x: number; y: number; node: NodeKind }
  | { type: 'farmExhausted'; x: number; y: number; kingdom: KingdomId }
  | { type: 'victory'; kingdom: KingdomId }
  | { type: 'defeat'; kingdom: KingdomId }
  | { type: 'projectile'; projectile: Projectile }
  | { type: 'message'; kingdom: KingdomId; text: string };

export interface Kingdom {
  id: KingdomId;
  name: string;
  civ: CivilizationId;
  color: string;
  stock: ResourceBag;
  age: Age;
  techs: TechId[];
  stats: { gathered: number; kills: number; buildingsDestroyed: number; trained: number; lost: number };
}

export interface AiState {
  nextThinkTick: number;
  phase: number;
  nextAttackTick: number;
  attacking: boolean;
  lastBuildCheck: number;
  targetVillagers: number;
  targetArmy: number;
  gatherMultiplier: number;
  lastAttackSentTick: number;
}

export interface GameMap {
  size: number;
  terrain: Uint8Array;
  blocked: Uint8Array;
  startTiles: [Vec2, Vec2];
}

export interface MatchOptions {
  seed: number;
  difficulty: Difficulty;
  playerCiv: CivilizationId;
  aiCiv: CivilizationId;
  playerName: string;
  aiName: string;
}

export interface World {
  seed: number;
  tick: number;
  time: number;
  rng: () => number;
  map: GameMap;
  kingdoms: [Kingdom, Kingdom];
  units: Unit[];
  buildings: Building[];
  nodes: ResourceNode[];
  projectiles: Projectile[];
  nextId: number;
  commands: Command[];
  events: GameEvent[];
  visible: [Uint8Array, Uint8Array];
  explored: [Uint8Array, Uint8Array];
  result: 'playing' | 'victory' | 'defeat';
  resultTick: number;
  options: MatchOptions;
  ai: [AiState | null, AiState | null];
  fogDirty: boolean;
  tickMs: number;
}

export type ResearchId = TechId;

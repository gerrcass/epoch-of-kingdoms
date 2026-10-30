import type { BuildingKind, ResourceKind, TechId, UnitKind } from '../sim/types';

function svg(body: string, viewBox = '0 0 24 24'): string {
  return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

const RESOURCE: Record<ResourceKind, string> = {
  food: svg('<path d="M12 22V10"/><path d="M12 14c-3 0-5-1-6-4 3 0 5 1 6 4Z"/><path d="M12 14c3 0 5-1 6-4-3 0-5 1-6 4Z"/><path d="M12 9c-2 0-4-1-4-4 2 0 4 1 4 4Z"/><path d="M12 9c2 0 4-1 4-4-2 0-4 1-4 4Z"/>'),
  wood: svg('<path d="M3 17l4-8 14 5-4 8Z"/><path d="M7 9l3-2 10 4-3 2"/><circle cx="6" cy="17" r="1"/><circle cx="16" cy="19" r="1"/>'),
  gold: svg('<circle cx="12" cy="12" r="7"/><path d="M9.5 9.5h5M9.5 14.5h5M12 9.5v5"/><path d="M4 6l2-2M20 6l-2-2"/>'),
  stone: svg('<path d="M4 19l3-10 6-4 7 6v8Z"/><path d="M7 9l4 3 6-1 3 6"/><path d="M11 12l-1 7"/>'),
};

const UNIT: Record<UnitKind, string> = {
  villager: svg('<circle cx="12" cy="7" r="3.2"/><path d="M7.5 21v-5.5c0-2.4 2-4.5 4.5-4.5s4.5 2 4.5 4.5V21"/><path d="M4 9.5h16"/><path d="M17 14l3 4"/>'),
  militia: svg('<path d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6Z"/><path d="M8.5 12l2.5 3 4.5-6"/>'),
  spearman: svg('<path d="M5 20L19 5"/><path d="M19 5l2-3-1 4-4-1 3 0"/><circle cx="8" cy="17" r="2.5"/>'),
  archer: svg('<path d="M5 4v16"/><path d="M5 5c8 0 12 5 12 9s-4 5-12 5"/><path d="M5 12h14"/><path d="M17 12l4-2v4Z"/>'),
  skirmisher: svg('<path d="M4 20L18 6"/><path d="M18 6l3-1-1 3-3-1Z"/><path d="M8 8l8 8"/><circle cx="8" cy="16" r="3"/>'),
  scout: svg('<path d="M4 17c1-5 4-8 8-8 3 0 5 2 5 4l3 1v5"/><path d="M8 17v3M17 17v3"/><path d="M15 9V5l3-2"/><circle cx="9" cy="7" r="1.5"/>'),
  knight: svg('<path d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6Z"/><path d="M12 7v6M9 10h6"/><path d="M8 16l8-8"/>'),
  ram: svg('<path d="M3 16h18v5H3z"/><path d="M5 16V9h14v7"/><circle cx="7" cy="21" r="1.6"/><circle cx="17" cy="21" r="1.6"/><path d="M2 11h5M17 11h5"/>'),
};

const BUILDING: Record<BuildingKind, string> = {
  townCenter: svg('<path d="M4 21h16M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/><path d="M9 9h2M13 9h2M9 12h2M13 12h2"/><path d="M12 3v3"/>'),
  house: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v11h14V10"/><path d="M9 21v-6h6v6"/>'),
  mill: svg('<path d="M6 21h12M7 21V9h10v12"/><path d="M12 9V5M12 5L6 2M12 5l6-3M12 5L8 11M12 5l4 6"/><path d="M10 21v-5h4v5"/>'),
  lumberCamp: svg('<path d="M3 20l4-8h10l4 8Z"/><path d="M7 12l2-4h6l2 4"/><path d="M5 20h14"/><path d="M9 16h6M12 13v7"/>'),
  miningCamp: svg('<path d="M3 20l3-7h12l3 7Z"/><path d="M8 13l1-4h6l1 4"/><path d="M5 20h14"/><circle cx="12" cy="9" r="1.5"/>'),
  farm: svg('<path d="M3 20h18"/><path d="M5 20c0-5 3-9 7-9s7 4 7 9"/><path d="M8 20v-6M12 20v-8M16 20v-6"/><path d="M7 12l2-2M17 12l-2-2"/>'),
  barracks: svg('<path d="M3 21h18M5 21V9h14v12"/><path d="M5 9l7-5 7 5"/><path d="M9 21v-7h6v7"/><path d="M8 6V2M8 4h5l-1 2 1 2H8"/>'),
  archeryRange: svg('<path d="M3 21h18M5 21V10h14v11"/><path d="M5 10l7-5 7 5"/><circle cx="12" cy="15" r="3"/><circle cx="12" cy="15" r="1"/><path d="M12 21v-3"/>'),
  stable: svg('<path d="M3 21h18M5 21V10h14v11"/><path d="M5 10l7-5 7 5"/><path d="M8 21v-5c0-2 1.5-3 4-3s4 1 4 3v5"/><path d="M9 6V3M15 6V3"/>'),
  blacksmith: svg('<path d="M3 21h18M5 21V10h14v11"/><path d="M5 10l7-5 7 5"/><path d="M9 17h6l-1-3h-4Z"/><path d="M12 14V9M10 9h4"/><path d="M17 6V3"/>'),
  tower: svg('<path d="M6 21h12M7 21V7h10v14"/><path d="M5 7V4h3v2h2V4h4v2h2V4h3v3"/><path d="M10 17h4v4h-4z"/><path d="M11 10h2"/>'),
  palisade: svg('<path d="M3 21h18"/><path d="M5 21V8l2-4 2 4v13M10 21V8l2-4 2 4v13M15 21V8l2-4 2 4v13"/>'),
};

const TECH: Record<string, string> = {
  loom: svg('<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/><path d="M3 6h2M19 6h2"/>'),
  wheelbarrow: svg('<circle cx="8" cy="18" r="3"/><path d="M11 17l3-8h4M5 11h7"/><path d="M14 9l4 3"/>'),
  doubleBitAxe: svg('<path d="M4 20L15 6"/><path d="M12 5l6-2 3 3-2 5-5-1Z"/><path d="M5 21l-2-2"/>'),
  forging: svg('<path d="M4 20h16"/><path d="M8 16V8h8v8Z"/><path d="M6 16h12"/><path d="M12 8V4M10 6h4"/>'),
  scaleMail: svg('<path d="M12 3l8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6Z"/><path d="M8 10l4 3 4-3M8 14l4 3 4-3"/>'),
};

const ACTION: Record<string, string> = {
  attackMove: svg('<path d="M4 20L18 6M14 4l6 2-2 6M20 4l-4 4"/><path d="M4 4l6 2-2 6"/>'),
  stop: svg('<rect x="5" y="5" width="14" height="14" rx="1"/>'),
  hold: svg('<path d="M12 3l8 3v6c0 4-4 8-8 9-4-1-8-5-8-9V6Z"/><path d="M9 12l2 2 4-4"/>'),
  aggressive: svg('<path d="M4 20L18 6M14 4l6 2-2 6"/>'),
  defensive: svg('<path d="M12 3l8 3v6c0 4-4 8-8 9-4-1-8-5-8-9V6Z"/>'),
  standGround: svg('<path d="M12 3v18M5 7h14M7 21h10"/><path d="M5 7l3 4M19 7l-3 4"/>'),
  rally: svg('<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>'),
  cancel: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  age: svg('<path d="M4 8l4 4 4-7 4 7 4-4-2 10H6Z"/><path d="M6 21h12"/>'),
  idle: svg('<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/><circle cx="12" cy="3" r="1"/>'),
  repair: svg('<path d="M5 19l4-4M13 5l6 6-3 3-6-6Z"/><path d="M4 20h4v-4H4z"/>'),
  gather: svg('<path d="M12 21V8"/><path d="M7 13c0-4 2-7 5-9 3 2 5 5 5 9-3 0-5-1-5-4-0 3-2 4-5 4Z"/><path d="M6 21h12"/>'),
  build: svg('<path d="M4 21h16M6 21V9l6-5 6 5v12"/><path d="M10 21v-6h4v6"/>'),
  rallySmall: svg('<path d="M7 21V4M7 4h9l-2 3 2 3H7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
};

export function resourceIcon(kind: ResourceKind | string): string {
  return RESOURCE[kind as ResourceKind] ?? ACTION.plus!;
}

export function unitIcon(kind: UnitKind | string): string {
  return UNIT[kind as UnitKind] ?? ACTION.idle!;
}

export function buildingIcon(kind: BuildingKind | string): string {
  return BUILDING[kind as BuildingKind] ?? ACTION.build!;
}

export function techIcon(kind: TechId | string): string {
  return TECH[kind] ?? ACTION.age!;
}

export function actionIcon(name: string): string {
  return ACTION[name] ?? ACTION.plus!;
}

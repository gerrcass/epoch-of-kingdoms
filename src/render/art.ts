import { BUILDING_DEFS, RESOURCE_META, UNIT_DEFS } from '../sim/content';
import type { Building, Projectile, ResourceNode, Unit } from '../sim/types';
import { TILE_H, TILE_W, worldToIso } from './iso';

export const TEAM = ['#4a7fd4', '#b7443d'] as const;
export const TEAM_DARK = ['#2c4f8a', '#742622'] as const;

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(7, 11, 7, 0.32)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawNode(ctx: CanvasRenderingContext2D, node: ResourceNode, time: number, selected: boolean): void {
  const iso = worldToIso(node.x, node.y);
  ctx.save();
  ctx.translate(iso.x, iso.y);
  const v = node.variant;
  if (node.node === 'tree') {
    shadow(ctx, 8, 4, 22, 10);
    const sway = Math.sin(time * 0.9 + node.id) * 1.5;
    ctx.fillStyle = '#55402b';
    ctx.fillRect(-3, -20, 6, 21);
    ctx.fillStyle = '#3c2c1e';
    ctx.fillRect(-1.5, -18, 2, 18);
    const canopy = ['#314d2d', '#3c5d33', '#4b6e3b', '#5a7d43'];
    for (let i = 0; i < 4; i += 1) {
      const cy = -28 - i * 9;
      const r = 18 - i * 2.2 + (v % 3);
      ctx.fillStyle = canopy[i]!;
      ctx.beginPath();
      ctx.ellipse(sway * (i / 3), cy, r + 5, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(154, 190, 96, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-9 + sway, -45, 9, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(40, 56, 28, 0.45)';
    ctx.beginPath();
    ctx.ellipse(9, -25, 11, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (node.node === 'gold') {
    shadow(ctx, 2, 3, 21, 9);
    ctx.fillStyle = '#5c5b54';
    ctx.beginPath();
    ctx.moveTo(-20, 2);
    ctx.lineTo(-12, -12);
    ctx.lineTo(2, -19);
    ctx.lineTo(17, -8);
    ctx.lineTo(19, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#75746b';
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-9, -10);
    ctx.lineTo(2, -15);
    ctx.lineTo(12, -6);
    ctx.lineTo(11, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e1bc4f';
    for (let i = 0; i < 6; i += 1) {
      const gx = -10 + ((i * 7 + v * 3) % 20);
      const gy = -3 - ((i * 5 + v * 2) % 11);
      ctx.beginPath();
      ctx.arc(gx, gy, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f6dd88';
    ctx.fillRect(-3, -8, 3, 2);
  } else if (node.node === 'stone') {
    shadow(ctx, 2, 3, 21, 9);
    ctx.fillStyle = '#5f5e57';
    ctx.beginPath();
    ctx.moveTo(-20, 2);
    ctx.lineTo(-11, -11);
    ctx.lineTo(3, -17);
    ctx.lineTo(16, -7);
    ctx.lineTo(18, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7b7a71';
    ctx.beginPath();
    ctx.moveTo(-13, 1);
    ctx.lineTo(-8, -8);
    ctx.lineTo(1, -13);
    ctx.lineTo(10, -5);
    ctx.lineTo(9, 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(45,44,40,0.5)';
    ctx.beginPath();
    ctx.moveTo(-4, -10);
    ctx.lineTo(2, -4);
    ctx.lineTo(8, -6);
    ctx.stroke();
  } else if (node.node === 'berry') {
    shadow(ctx, 2, 3, 18, 8);
    ctx.fillStyle = '#3f5c30';
    ctx.beginPath();
    ctx.ellipse(0, -10, 17, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4e7038';
    ctx.beginPath();
    ctx.ellipse(-6, -14, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 6; i += 1) {
      const bx = -11 + ((i * 5 + v) % 22);
      const by = -4 - ((i * 3 + v) % 12);
      ctx.fillStyle = i % 2 ? '#a52f35' : '#c94a4d';
      ctx.beginPath();
      ctx.arc(bx, by, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    shadow(ctx, 1, 3, 16, 7);
    ctx.fillStyle = '#d2c9b6';
    ctx.beginPath();
    ctx.ellipse(0, -8, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8ad99';
    ctx.beginPath();
    ctx.ellipse(-7, -7, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4b4034';
    ctx.beginPath();
    ctx.ellipse(-13, -11, 4, 3, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f2923';
    ctx.fillRect(-14.5, -12, 1.5, 1.5);
    ctx.fillRect(-2, 0, 1.8, 5);
    ctx.fillRect(4, 0, 1.8, 5);
  }
  if (selected) {
    ctx.strokeStyle = '#f1d57e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  void RESOURCE_META;
}

export function drawUnit(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  x: number,
  y: number,
  time: number,
  selected: boolean,
): void {
  const iso = worldToIso(x, y);
  const team = TEAM[unit.kingdom];
  const teamDark = TEAM_DARK[unit.kingdom];
  const moving = unit.path.length > 0;
  const phase = time * 9 + unit.id * 1.7;
  const bob = moving ? Math.sin(phase) * 1.2 : Math.sin(time * 2 + unit.id) * 0.45;
  const facing = Math.cos(unit.direction) >= 0 ? 1 : -1;
  const carry = unit.carryKind;

  ctx.save();
  ctx.translate(iso.x, iso.y - bob);
  shadow(ctx, 0, 0, 9, 3.8);
  if (selected) {
    ctx.strokeStyle = '#f4da88';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11.5, 5.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(70, 51, 16, 0.6)';
    ctx.lineWidth = 2.8;
    ctx.stroke();
  }

  if (unit.type === 'ram') {
    drawRam(ctx, unit, time);
  } else if (unit.type === 'scout' || unit.type === 'knight') {
    drawHorse(ctx, unit, team, teamDark, moving, phase);
  } else {
    drawFoot(ctx, unit, team, teamDark, moving, phase, facing);
  }

  if (carry && unit.carryAmount > 0) {
    const color = RESOURCE_META[carry].color;
    ctx.fillStyle = '#59422a';
    ctx.beginPath();
    ctx.ellipse(-7 * facing, -13, 4.2, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-7 * facing, -16, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const damaged = unit.hp < unit.maxHp;
  if ((selected || damaged) && unit.type !== 'ram') {
    const w = 24;
    const pct = Math.max(0, unit.hp / unit.maxHp);
    ctx.fillStyle = 'rgba(10, 13, 9, 0.8)';
    ctx.fillRect(-w / 2 - 1, -40, w + 2, 5);
    ctx.fillStyle = pct > 0.55 ? '#6faa4c' : pct > 0.28 ? '#cfaa4b' : '#bd4b3f';
    ctx.fillRect(-w / 2, -39, w * pct, 3);
    ctx.strokeStyle = 'rgba(234, 222, 188, 0.35)';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(-w / 2 - 1, -40, w + 2, 5);
  }
  ctx.restore();
  void UNIT_DEFS;
}

function drawFoot(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  team: string,
  teamDark: string,
  moving: boolean,
  phase: number,
  facing: number,
): void {
  const swing = moving ? Math.sin(phase) * 3 : 0;
  ctx.strokeStyle = '#3b2a1d';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-3, -11);
  ctx.lineTo(-3 - swing, -1);
  ctx.moveTo(3, -11);
  ctx.lineTo(3 + swing, -1);
  ctx.stroke();
  ctx.strokeStyle = '#6d5034';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (swing > 0) {
    ctx.moveTo(-3 + swing, -1);
    ctx.lineTo(-5 + swing, 0);
  }
  ctx.stroke();

  ctx.save();
  ctx.scale(facing, 1);
  // torso
  let bodyColor = '#b78b55';
  let belt = '#5c432b';
  if (unit.type === 'militia' || unit.type === 'spearman' || unit.type === 'knight') bodyColor = team;
  if (unit.type === 'archer' || unit.type === 'skirmisher') bodyColor = teamDark;
  if (unit.type === 'spearman' && unit.kingdom === 1) bodyColor = '#6f8b52';
  if (unit.type === 'knight') bodyColor = '#b9bcb1';
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(-5, -23);
  ctx.lineTo(5, -23);
  ctx.lineTo(6.5, -9);
  ctx.lineTo(-6.5, -9);
  ctx.closePath();
  ctx.fill();
  if (unit.type === 'villager') {
    ctx.fillStyle = '#8d6b43';
    ctx.fillRect(-6.5, -13, 13, 2);
    ctx.fillStyle = belt;
    ctx.fillRect(-6.5, -11, 13, 2);
  } else {
    ctx.fillStyle = 'rgba(239, 231, 205, 0.5)';
    ctx.fillRect(-5, -20, 10, 1.4);
    ctx.fillStyle = teamDark;
    ctx.fillRect(-6, -12, 12, 2.5);
  }
  // arms
  ctx.strokeStyle = unit.type === 'knight' || unit.type === 'militia' ? teamDark : bodyColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-4, -21);
  ctx.lineTo(-7, -14 + Math.sin(phase) * (moving ? 2 : 0));
  ctx.moveTo(4, -21);
  ctx.lineTo(7.5, -15 - Math.sin(phase) * (moving ? 2 : 0));
  ctx.stroke();
  // head
  ctx.fillStyle = '#d8ab7d';
  ctx.beginPath();
  ctx.arc(0, -27, 4.4, 0, Math.PI * 2);
  ctx.fill();
  if (unit.type === 'villager') {
    ctx.fillStyle = '#8d6a3f';
    ctx.beginPath();
    ctx.ellipse(0, -30, 7.5, 2.4, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7b5b36';
    ctx.fillRect(-7, -31, 14, 2);
  } else {
    ctx.fillStyle = unit.type === 'archer' || unit.type === 'skirmisher' ? '#6b6558' : '#b9b8ac';
    ctx.beginPath();
    ctx.arc(0, -28.5, 4.6, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-4.6, -28.5, 9.2, 1.8);
    if (unit.type === 'knight') {
      ctx.fillStyle = team;
      ctx.fillRect(-1.2, -35, 2.4, 3);
    }
  }
  // weapons / shields
  if (unit.type === 'spearman') {
    ctx.strokeStyle = '#6a4d2e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(1, -20);
    ctx.lineTo(20, -34);
    ctx.stroke();
    ctx.fillStyle = '#c9c6b7';
    ctx.beginPath();
    ctx.moveTo(20, -36);
    ctx.lineTo(24, -33);
    ctx.lineTo(20, -30);
    ctx.closePath();
    ctx.fill();
  } else if (unit.type === 'archer' || unit.type === 'skirmisher') {
    ctx.strokeStyle = '#7f5c36';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(7, -22, 8, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = '#d9cfb2';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(7, -30);
    ctx.lineTo(7, -14);
    ctx.stroke();
    if (unit.type === 'skirmisher') {
      ctx.strokeStyle = '#d2be86';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(7, -20);
      ctx.lineTo(17, -30);
      ctx.stroke();
    }
  } else if (unit.type === 'militia' || unit.type === 'knight') {
    ctx.strokeStyle = '#c4c4b8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(5, -20);
    ctx.lineTo(16, -32);
    ctx.stroke();
    ctx.fillStyle = team;
    ctx.beginPath();
    ctx.arc(-8, -20, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ead9a4';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  } else if (unit.type === 'villager') {
    ctx.strokeStyle = '#6a4c2e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(5, -20);
    ctx.lineTo(13, -27);
    ctx.stroke();
    ctx.fillStyle = '#a7a596';
    ctx.beginPath();
    ctx.moveTo(12, -28);
    ctx.lineTo(17, -26);
    ctx.lineTo(13, -23);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawHorse(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  team: string,
  _teamDark: string,
  moving: boolean,
  phase: number,
): void {
  const facing = Math.cos(unit.direction) >= 0 ? 1 : -1;
  const gallop = moving ? Math.sin(phase * 1.2) : 0;
  ctx.save();
  ctx.scale(facing, 1);
  ctx.fillStyle = unit.type === 'knight' ? '#6c5340' : '#7a5a42';
  ctx.beginPath();
  ctx.ellipse(0, -11, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#44301f';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-9, -7);
  ctx.lineTo(-10 + gallop * 3, 0);
  ctx.moveTo(-3, -7);
  ctx.lineTo(-2 - gallop * 3, 0);
  ctx.moveTo(5, -7);
  ctx.lineTo(6 - gallop * 3, 0);
  ctx.moveTo(10, -7);
  ctx.lineTo(12 + gallop * 3, 0);
  ctx.stroke();
  ctx.fillStyle = '#6c5340';
  ctx.beginPath();
  ctx.ellipse(12, -17, 4.5, 6.5, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(15, -22, 3, 4, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = team;
  ctx.fillRect(-6, -13, 12, 3);
  ctx.fillStyle = unit.type === 'knight' ? '#bfc0b4' : team;
  ctx.beginPath();
  ctx.ellipse(0, -18, 4.4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8ab7d';
  ctx.beginPath();
  ctx.arc(0, -24, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8b7aa';
  ctx.beginPath();
  ctx.arc(0, -25, 4, Math.PI, Math.PI * 2);
  ctx.fill();
  if (unit.type === 'knight') {
    ctx.strokeStyle = '#d8d4c4';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(7, -20);
    ctx.lineTo(23, -32);
    ctx.stroke();
    ctx.fillStyle = '#e6e0cc';
    ctx.beginPath();
    ctx.moveTo(23, -34);
    ctx.lineTo(27, -31);
    ctx.lineTo(23, -28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = team;
    ctx.beginPath();
    ctx.moveTo(-7, -21);
    ctx.lineTo(-1, -21);
    ctx.lineTo(-4, -14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawRam(ctx: CanvasRenderingContext2D, unit: Unit, time: number): void {
  const facing = Math.cos(unit.direction) >= 0 ? 1 : -1;
  ctx.save();
  ctx.scale(facing, 1);
  shadow(ctx, 0, 0, 21, 7);
  ctx.fillStyle = '#4a3521';
  ctx.fillRect(-18, -15, 36, 13);
  ctx.fillStyle = '#5d4329';
  ctx.fillRect(-17, -22, 34, 5);
  ctx.fillStyle = '#332518';
  ctx.beginPath();
  ctx.arc(-11, -2, 4.5, 0, Math.PI * 2);
  ctx.arc(11, -2, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6d5234';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-6, -16);
  ctx.lineTo(6, -16);
  ctx.stroke();
  ctx.strokeStyle = '#8c724c';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-22, -11 + Math.sin(time * 8) * 2);
  ctx.lineTo(-31, -11 + Math.sin(time * 8) * 2);
  ctx.stroke();
  ctx.fillStyle = '#9d9988';
  ctx.fillRect(-35, -14 + Math.sin(time * 8) * 2, 5, 7);
  ctx.restore();
}

export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  building: Building,
  time: number,
  selected: boolean,
): void {
  const iso = worldToIso(building.x, building.y);
  const def = BUILDING_DEFS[building.type];
  const w = def.width;
  const h = def.height;
  const halfW = (w + h) * 16;
  const halfH = (w + h) * 8;
  const team = TEAM[building.kingdom];
  const teamDark = TEAM_DARK[building.kingdom];
  const p = building.complete ? 1 : Math.max(0.06, building.progress);

  ctx.save();
  ctx.translate(iso.x, iso.y);
  ctx.globalAlpha = building.complete ? 1 : 0.72 + p * 0.28;

  // Ground shadow.
  shadow(ctx, 4, 4, halfW * 0.9, halfH * 0.9);

  const n = { x: 0, y: -halfH };
  const e = { x: halfW, y: 0 };
  const s = { x: 0, y: halfH };
  const wpt = { x: -halfW, y: 0 };

  if (building.type === 'farm') {
    drawFarm(ctx, building, halfW, halfH);
    drawHealthBar(ctx, building, selected, -halfH - 8, 44);
    ctx.restore();
    return;
  }
  if (building.type === 'palisade') {
    drawPalisade(ctx, halfW, halfH, team);
    drawHealthBar(ctx, building, selected, -halfH - 14, 34);
    ctx.restore();
    return;
  }

  const style = buildingStyle(building.type);
  const wall = style.wall * p;
  const roof = style.roof * p;
  const baseFill = style.body;
  const baseDark = style.bodyDark;

  // Foundation / plinth.
  polygon(ctx, [n, e, { x: e.x, y: e.y + 5 }, { x: 0, y: s.y + 5 }, { x: wpt.x, y: wpt.y + 5 }], '#5e584c');
  polygon(ctx, [n, e, s, wpt], baseDark);

  const nT = raised(n, wall);
  const eT = raised(e, wall);
  const sT = raised(s, wall);
  const wT = raised(wpt, wall);
  polygon(ctx, [wpt, s, sT, wT], shade(baseFill, -0.24));
  polygon(ctx, [s, e, eT, sT], shade(baseFill, 0.08));
  polygon(ctx, [n, e, eT, nT], shade(baseFill, 0.02));
  polygon(ctx, [n, wpt, wT, nT], shade(baseFill, -0.34));

  // Timber framing and door.
  ctx.strokeStyle = 'rgba(54, 40, 26, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(wpt.x, wpt.y);
  ctx.lineTo(wT.x, wT.y);
  ctx.lineTo(0, sT.y);
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(eT.x, eT.y);
  ctx.lineTo(0, sT.y);
  ctx.stroke();

  ctx.fillStyle = '#3e2f20';
  const doorW = Math.max(7, 12);
  const doorH = Math.min(wall * 0.5, 20);
  ctx.fillRect(-doorW / 2, sT.y + wall * 0.48, doorW, doorH);

  // Roof.
  if (style.kind === 'tower') {
    polygon(ctx, [wT, nT, eT, sT], '#5c564b');
    for (let i = 0; i < 4; i += 1) {
      ctx.fillStyle = '#4b453b';
      const x = -halfW + 5 + i * (halfW * 2 - 10) / 3;
      ctx.fillRect(x, wT.y - 4, 5, 6);
    }
    ctx.fillStyle = '#2d2720';
    ctx.fillRect(-2, wT.y + wall * 0.18, 4, 9);
  } else {
    const ridge = { x: 0, y: Math.min(wT.y, nT.y) - roof };
    polygon(ctx, [nT, eT, ridge], shade(style.roofColor, 0.18));
    polygon(ctx, [eT, sT, ridge], style.roofColor);
    polygon(ctx, [sT, wT, ridge], shade(style.roofColor, -0.2));
    polygon(ctx, [wT, nT, ridge], shade(style.roofColor, -0.04));
    ctx.strokeStyle = 'rgba(37, 27, 20, 0.38)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(nT.x, nT.y);
    ctx.lineTo(ridge.x, ridge.y);
    ctx.lineTo(sT.x, sT.y);
    ctx.stroke();
  }

  // Windows, banners, and special details.
  ctx.fillStyle = '#2c241b';
  if (building.type === 'townCenter' || building.type === 'barracks' || building.type === 'blacksmith') {
    for (let i = 0; i < 2; i += 1) {
      ctx.fillRect(-7 + i * 8.5, sT.y + 9 + i * 5, 3.6, 5);
    }
  }

  const bannerBase = { x: halfW * 0.62, y: -halfH * 0.2 };
  const bannerTop = { x: bannerBase.x, y: bannerBase.y - wall - roof * 1.2 };
  ctx.strokeStyle = '#493724';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(bannerBase.x, bannerBase.y);
  ctx.lineTo(bannerTop.x, bannerTop.y);
  ctx.stroke();
  const wave = Math.sin(time * 2.2 + building.id) * 2;
  ctx.fillStyle = team;
  ctx.beginPath();
  ctx.moveTo(bannerTop.x, bannerTop.y);
  ctx.lineTo(bannerTop.x + 15, bannerTop.y + 2 + wave);
  ctx.lineTo(bannerTop.x + 12, bannerTop.y + 8);
  ctx.lineTo(bannerTop.x, bannerTop.y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(238, 221, 164, 0.55)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  if (building.type === 'townCenter') {
    // Second floor and central keep.
    const second = { x: -halfW * 0.62, y: -halfH * 0.62 };
    const secondE = { x: halfW * 0.62, y: -halfH * 0.62 };
    const secondS = { x: 0, y: halfH * 0.62 };
    const secondW = { x: -halfW * 0.62, y: halfH * 0.62 };
    const top = raised(secondS, wall * 0.7);
    polygon(ctx, [secondW, secondS, top, raised(secondW, wall * 0.7)], shade(baseFill, -0.12));
    polygon(ctx, [secondS, secondE, raised(secondE, wall * 0.7), top], shade(baseFill, 0.08));
    polygon(ctx, [secondE, second, raised(second, wall * 0.7), raised(secondE, wall * 0.7)], shade(baseFill, 0.02));
    polygon(ctx, [second, secondW, raised(secondW, wall * 0.7), raised(second, wall * 0.7)], shade(baseFill, -0.24));
    const keepRidge = { x: 0, y: Math.min(raised(secondS, wall * 0.7).y, raised(secondW, wall * 0.7).y) - roof * 0.7 };
    polygon(ctx, [raised(secondW, wall * 0.7), raised(secondS, wall * 0.7), keepRidge], shade(style.roofColor, 0.2));
    polygon(ctx, [raised(secondS, wall * 0.7), raised(secondE, wall * 0.7), keepRidge], style.roofColor);
    ctx.fillStyle = teamDark;
    ctx.fillRect(-3, keepRidge.y - 12, 6, 12);
    ctx.fillStyle = team;
    ctx.beginPath();
    ctx.moveTo(3, keepRidge.y - 12);
    ctx.lineTo(15 + wave, keepRidge.y - 9);
    ctx.lineTo(3, keepRidge.y - 4);
    ctx.closePath();
    ctx.fill();
  }

  if (building.type === 'mill') {
    const bladeY = sT.y - wall * 0.1;
    ctx.save();
    ctx.translate(0, bladeY);
    ctx.rotate(time * 0.55);
    ctx.strokeStyle = '#d3c29e';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 4; i += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -24);
      ctx.stroke();
      ctx.fillStyle = 'rgba(204, 185, 141, 0.72)';
      ctx.fillRect(-4, -25, 8, 12);
    }
    ctx.fillStyle = '#3d2c1d';
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (building.type === 'blacksmith') {
    const glow = 0.55 + Math.sin(time * 3.4) * 0.18;
    ctx.fillStyle = `rgba(232, 139, 60, ${glow})`;
    ctx.beginPath();
    ctx.ellipse(0, sT.y + 12, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#514a3e';
    ctx.fillRect(7, sT.y - 18, 5, 20);
  }

  if (building.type === 'stable') {
    ctx.fillStyle = '#3e2c1c';
    ctx.fillRect(-7, sT.y + 7, 14, 17);
    ctx.fillStyle = '#c5aa70';
    ctx.beginPath();
    ctx.arc(0, sT.y + 13, 5, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  if (building.type === 'archeryRange') {
    ctx.strokeStyle = '#d8c9a2';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-halfW * 0.72, sT.y + 16, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-halfW * 0.72 + 12, sT.y + 20, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (!building.complete) {
    // Scaffolding and a progress bar.
    ctx.strokeStyle = 'rgba(122, 94, 57, 0.8)';
    ctx.lineWidth = 1.4;
    for (const x of [-halfW * 0.6, halfW * 0.6]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, -Math.max(wall, 10) - 8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-halfW * 0.6, -Math.max(wall, 10) * 0.6);
    ctx.lineTo(halfW * 0.6, -Math.max(wall, 10) * 0.6);
    ctx.stroke();
    const barY = -halfH - Math.max(wall, 10) - 20;
    ctx.fillStyle = 'rgba(10, 13, 9, 0.82)';
    ctx.fillRect(-30, barY, 60, 6);
    ctx.fillStyle = '#d9b968';
    ctx.fillRect(-29, barY + 1, 58 * building.progress, 4);
    ctx.strokeStyle = 'rgba(235, 218, 165, 0.6)';
    ctx.lineWidth = 0.7;
    ctx.strokeRect(-30, barY, 60, 6);
  }

  if (building.hp < building.maxHp * 0.5) {
    ctx.strokeStyle = 'rgba(44, 35, 25, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, sT.y + 8);
    ctx.lineTo(-4, sT.y + 16);
    ctx.lineTo(-7, sT.y + 24);
    ctx.moveTo(11, sT.y + 12);
    ctx.lineTo(6, sT.y + 19);
    ctx.stroke();
  }

  drawHealthBar(ctx, building, selected, -halfH - Math.max(wall, 10) - 36, Math.max(44, halfW * 0.9));
  ctx.restore();
}

function buildingStyle(type: Building['type']): {
  wall: number;
  roof: number;
  body: string;
  bodyDark: string;
  roofColor: string;
  kind: 'normal' | 'tower';
} {
  switch (type) {
    case 'townCenter':
      return { wall: 42, roof: 34, body: '#bfb08f', bodyDark: '#8c7e63', roofColor: '#6c4234', kind: 'normal' };
    case 'house':
      return { wall: 19, roof: 22, body: '#c8b78f', bodyDark: '#96866a', roofColor: '#8b633a', kind: 'normal' };
    case 'mill':
      return { wall: 34, roof: 18, body: '#b7aa8c', bodyDark: '#897d65', roofColor: '#695438', kind: 'normal' };
    case 'lumberCamp':
      return { wall: 15, roof: 12, body: '#8b6a44', bodyDark: '#5d472d', roofColor: '#68492b', kind: 'normal' };
    case 'miningCamp':
      return { wall: 14, roof: 12, body: '#817152', bodyDark: '#584c39', roofColor: '#5d4c35', kind: 'normal' };
    case 'barracks':
      return { wall: 27, roof: 24, body: '#b3a487', bodyDark: '#7f725b', roofColor: '#713f32', kind: 'normal' };
    case 'archeryRange':
      return { wall: 23, roof: 22, body: '#b8a989', bodyDark: '#81745c', roofColor: '#635a35', kind: 'normal' };
    case 'stable':
      return { wall: 27, roof: 23, body: '#b0a183', bodyDark: '#7b705a', roofColor: '#695339', kind: 'normal' };
    case 'blacksmith':
      return { wall: 26, roof: 21, body: '#8f8574', bodyDark: '#615a4e', roofColor: '#4e4a43', kind: 'normal' };
    case 'tower':
      return { wall: 64, roof: 14, body: '#a49b88', bodyDark: '#716a5d', roofColor: '#5c4b3b', kind: 'tower' };
    default:
      return { wall: 20, roof: 18, body: '#b0a183', bodyDark: '#7b705a', roofColor: '#695339', kind: 'normal' };
  }
}

function drawFarm(ctx: CanvasRenderingContext2D, building: Building, halfW: number, halfH: number): void {
  polygon(
    ctx,
    [
      { x: 0, y: -halfH },
      { x: halfW, y: 0 },
      { x: 0, y: halfH },
      { x: -halfW, y: 0 },
    ],
    '#7e6440',
  );
  const rows = 5;
  for (let i = 1; i < rows; i += 1) {
    const t = i / rows;
    ctx.strokeStyle = 'rgba(58, 43, 24, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-halfW + t * halfW, -halfH + t * halfH);
    ctx.lineTo(t * halfW, halfH - (1 - t) * halfH);
    ctx.stroke();
  }
  const ripe = building.farmFood / 300;
  ctx.strokeStyle = ripe > 0.4 ? '#c6a84e' : '#98864f';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 16; i += 1) {
    const t = (i % 4) / 4;
    const u = Math.floor(i / 4) / 4;
    const x = -halfW * 0.7 + u * halfW * 1.4 + t * halfW * 0.3;
    const y = -halfH * 0.6 + u * halfH * 1.2 + t * halfH * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1, y - 4);
    ctx.stroke();
  }
}

function drawPalisade(ctx: CanvasRenderingContext2D, halfW: number, halfH: number, team: string): void {
  for (let i = 0; i < 5; i += 1) {
    const t = i / 4;
    const x = -halfW + t * halfW * 2;
    const y = -halfH + Math.abs(t - 0.5) * halfH * 2;
    ctx.strokeStyle = '#66482b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 22);
    ctx.stroke();
    ctx.strokeStyle = '#98724a';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 22);
    ctx.lineTo(x + 2, y - 27);
    ctx.stroke();
  }
  ctx.fillStyle = team;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(-halfW * 0.35, -halfH * 0.2 - 18, 7, 5);
  ctx.globalAlpha = 1;
}

function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  building: Building,
  selected: boolean,
  y: number,
  width: number,
): void {
  if (!selected && building.hp >= building.maxHp) return;
  const pct = Math.max(0, building.hp / building.maxHp);
  ctx.fillStyle = 'rgba(9, 12, 8, 0.82)';
  ctx.fillRect(-width / 2 - 1, y - 1, width + 2, 7);
  ctx.fillStyle = pct > 0.55 ? '#6faa4c' : pct > 0.28 ? '#cfaa4b' : '#bd4b3f';
  ctx.fillRect(-width / 2, y, width * pct, 4);
  ctx.strokeStyle = 'rgba(231, 219, 183, 0.4)';
  ctx.lineWidth = 0.7;
  ctx.strokeRect(-width / 2 - 1, y - 1, width + 2, 7);
}

export function drawProjectile(ctx: CanvasRenderingContext2D, projectile: Projectile): void {
  const iso = worldToIso(projectile.x, projectile.y);
  const target = worldToIso(projectile.tx, projectile.ty);
  const angle = Math.atan2(target.y - iso.y, target.x - iso.x);
  const progress = Math.min(1, Math.max(0, 1 - Math.hypot(target.x - iso.x, target.y - iso.y) / 300));
  const lift = Math.sin(progress * Math.PI) * projectile.arc * 10;
  ctx.save();
  ctx.translate(iso.x, iso.y - lift);
  ctx.rotate(angle);
  ctx.strokeStyle = '#e2d6b1';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(5, 0);
  ctx.stroke();
  ctx.fillStyle = '#e9dfc5';
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(1, -2);
  ctx.lineTo(1, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawGhost(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  valid: boolean,
): void {
  const halfW = (width + height) * 16;
  const halfH = (width + height) * 8;
  ctx.save();
  ctx.translate(x, y);
  const n = { x: 0, y: -halfH };
  const e = { x: halfW, y: 0 };
  const s = { x: 0, y: halfH };
  const w = { x: -halfW, y: 0 };
  polygon(ctx, [n, e, s, w], valid ? 'rgba(120, 186, 98, 0.22)' : 'rgba(190, 65, 55, 0.22)');
  ctx.strokeStyle = valid ? '#9bd57e' : '#e06a5e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function polygon(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], fill: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function raised(p: { x: number; y: number }, h: number): { x: number; y: number } {
  return { x: p.x, y: p.y - h };
}

function shade(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  const num = parseInt(value, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  if (amount >= 0) {
    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);
  } else {
    r = Math.round(r * (1 + amount));
    g = Math.round(g * (1 + amount));
    b = Math.round(b * (1 + amount));
  }
  return `rgb(${r},${g},${b})`;
}

export function worldIso(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) };
}

export function teamColor(kingdom: 0 | 1): string {
  return TEAM[kingdom];
}

void worldIso;

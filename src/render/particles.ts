import { RESOURCE_META } from '../sim/content';
import type { GameEvent, ResourceKind } from '../sim/types';
import { worldToIso } from './iso';

interface Particle {
  kind: 'dot' | 'text' | 'ring' | 'leaf' | 'smoke';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  text?: string;
  gravity: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private lastAmbient = 0;

  clear(): void {
    this.particles = [];
  }

  text(x: number, y: number, text: string, color: string): void {
    this.particles.push({
      kind: 'text',
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: -26,
      life: 1.25,
      maxLife: 1.25,
      size: 12,
      color,
      text,
      gravity: -8,
    });
  }

  dots(x: number, y: number, color: string, count = 7, speed = 18): void {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        kind: 'dot',
        x,
        y,
        vx: Math.cos(angle) * s,
        vy: Math.sin(angle) * s - 10,
        life: 0.45 + Math.random() * 0.4,
        maxLife: 0.85,
        size: 1.4 + Math.random() * 1.8,
        color,
        gravity: 60,
      });
    }
  }

  ring(x: number, y: number, color: string, size = 20): void {
    this.particles.push({
      kind: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.6,
      maxLife: 0.6,
      size,
      color,
      gravity: 0,
    });
  }

  smoke(x: number, y: number): void {
    this.particles.push({
      kind: 'smoke',
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: -8 - Math.random() * 8,
      life: 1.8,
      maxLife: 1.8,
      size: 4 + Math.random() * 5,
      color: 'rgba(170, 166, 152, 0.22)',
      gravity: -2,
    });
  }

  leaf(x: number, y: number): void {
    this.particles.push({
      kind: 'leaf',
      x,
      y,
      vx: 4 + Math.random() * 8,
      vy: 2 + Math.random() * 4,
      life: 3.2,
      maxLife: 3.2,
      size: 1.8 + Math.random() * 1.8,
      color: Math.random() > 0.5 ? '#8a8e43' : '#a68b4a',
      gravity: 1,
    });
  }

  ambient(x: number, y: number, radius: number, dt: number, time: number): void {
    this.lastAmbient += dt;
    if (this.lastAmbient < 0.18) return;
    this.lastAmbient = 0;
    if (Math.random() > 0.6) {
      this.leaf(x + (Math.random() - 0.5) * radius, y + (Math.random() - 0.5) * radius * 0.5);
    }
    void time;
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      if (p.kind === 'ring') {
        p.size += 60 * dt;
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const iso = worldToIso(p.x, p.y);
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.kind === 'text') {
        ctx.font = `600 ${p.size}px Georgia, 'Times New Roman', serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(10, 12, 9, 0.8)';
        ctx.strokeText(p.text ?? '', iso.x, iso.y + 6);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text ?? '', iso.x, iso.y + 6);
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(iso.x, iso.y, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'leaf') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(iso.x, iso.y, p.size * 1.6, p.size * 0.6, 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(iso.x, iso.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  handleEvents(
    events: GameEvent[],
    playerKingdom: 0 | 1,
  ): void {
    for (const event of events) {
      if (event.type === 'attack' && event.damage > 0) {
        this.text(event.x, event.y - 0.4, `-${event.damage}`, event.kingdom === playerKingdom ? '#f2b0a2' : '#ffd9c9');
        if (event.ranged) this.dots(event.x, event.y, '#e1d7b5', 3, 8);
      } else if (event.type === 'death') {
        const color = event.unit ? '#8c3e32' : '#71695a';
        this.dots(event.x, event.y, color, event.building ? 18 : 7, event.building ? 28 : 16);
        if (event.building) this.ring(event.x, event.y, 'rgba(84, 75, 58, 0.5)', 18);
        if (event.type === 'death' && event.unit === 'ram') this.dots(event.x, event.y, '#6d5130', 16, 22);
      } else if (event.type === 'deposit') {
        const color = RESOURCE_META[event.resource as ResourceKind].color;
        this.text(event.x, event.y - 0.6, `+${Math.round(event.amount)}`, color);
      } else if (event.type === 'trained') {
        this.ring(event.x, event.y, 'rgba(222, 210, 164, 0.5)', 10);
      } else if (event.type === 'built') {
        this.ring(event.x, event.y, 'rgba(226, 200, 129, 0.55)', 20);
        this.dots(event.x, event.y, '#c4b28a', 8, 12);
      } else if (event.type === 'ageUp') {
        this.ring(0, 0, 'rgba(240, 210, 120, 0.7)', 30);
        this.text(0, 0, event.age === 1 ? 'Feudal Age' : 'Castle Age', '#f2d67e');
      } else if (event.type === 'underAttack') {
        this.text(event.x, event.y - 1.2, 'Under attack!', '#ef8a75');
      } else if (event.type === 'farmExhausted') {
        this.text(event.x, event.y - 0.6, 'Farm exhausted', '#d6c08a');
      } else if (event.type === 'nodeDepleted') {
        this.dots(event.x, event.y, '#7e8e43', 8, 14);
      }
    }
  }
}

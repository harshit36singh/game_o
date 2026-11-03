import { PHYS, type Sim } from "./engine";
import type { Obj, Theme } from "./types";

export const VIEW_W = 960;
export const VIEW_H = 540;
const T = 48; // pixels per tile
const GROUND_Y = VIEW_H - 80; // screen y of world y=0
const INK = "#2b2118";
const PLAYER = "#d97757";
const PLAYER_SHADE = "#b85c3e";
const CAM_LEAD = 5;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  color: string;
}

const sx = (wx: number, camX: number) => (wx - camX) * T;
const sy = (wy: number) => GROUND_Y - wy * T;

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function inked(ctx: CanvasRenderingContext2D, fill: string, lw = 3) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** Small deterministic pseudo-random for background decoration */
function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export class Renderer {
  private particles: Particle[] = [];
  private squash = 0; // >0 stretched tall, <0 squashed flat
  private blinkT = 2;
  private time = 0;
  private shake = 0;

  reset() {
    this.particles = [];
    this.squash = 0;
    this.shake = 0;
  }

  /** React to engine events with juice */
  onEvent(e: string, sim: Sim) {
    const p = sim.p;
    const cx = p.x + 0.5;
    const footY = p.gd === 1 ? p.y : p.y + 1;
    if (e === "jump" || e === "pad" || e === "orb") {
      this.squash = e === "pad" ? 0.35 : 0.22;
      this.puff(cx - 0.3, footY, 3, "#ffffff", 0.6);
    } else if (e === "land") {
      this.squash = -0.25;
      this.puff(cx, footY, 4, "#ffffff", 0.8);
    } else if (e === "die") {
      this.shake = 0.35;
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2;
        const s = 3 + Math.random() * 7;
        this.particles.push({
          x: cx,
          y: p.y + 0.5,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          r: 0.12 + Math.random() * 0.22,
          life: 0,
          max: 0.6 + Math.random() * 0.5,
          color: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? PLAYER : PLAYER_SHADE,
        });
      }
    } else if (e === "portal") {
      this.puff(cx, p.y + 0.5, 8, "#ffffff", 1.2);
    }
  }

  private puff(x: number, y: number, n: number, color: string, spread: number) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * spread,
        y,
        vx: -2 - Math.random() * 3,
        vy: (Math.random() - 0.2) * 2,
        r: 0.12 + Math.random() * 0.15,
        life: 0,
        max: 0.35 + Math.random() * 0.25,
        color,
      });
    }
  }

  update(dt: number) {
    this.time += dt;
    this.squash *= Math.pow(0.0005, dt);
    this.shake = Math.max(0, this.shake - dt);
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 1.5 + Math.random() * 2.5;
    for (const pt of this.particles) {
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy -= 9 * dt;
    }
    this.particles = this.particles.filter((pt) => pt.life < pt.max);
  }

  draw(ctx: CanvasRenderingContext2D, sim: Sim) {
    const th = sim.level.theme;
    const p = sim.p;
    const camX = p.x - CAM_LEAD;

    ctx.save();
    if (this.shake > 0) {
      const m = this.shake * 18;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    this.drawSky(ctx, th, camX);
    this.drawCeiling(ctx, th, camX);
    this.drawGround(ctx, th, camX);
    this.drawFinish(ctx, sim.level.length, camX);

    for (let i = 0; i < sim.objs.length; i++) {
      const o = sim.objs[i];
      if (o.x + o.w < camX - 1 || o.x > camX + VIEW_W / T + 1) continue;
      this.drawObj(ctx, o, th, camX, sim.used.has(i));
    }

    if (!p.dead) this.drawPlayer(ctx, sim, camX);
    for (const pt of this.particles) {
      const k = 1 - pt.life / pt.max;
      ctx.beginPath();
      ctx.arc(sx(pt.x, camX), sy(pt.y), pt.r * T * (0.4 + 0.6 * k), 0, Math.PI * 2);
      ctx.globalAlpha = Math.min(1, k * 1.5);
      inked(ctx, pt.color, 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private drawSky(ctx: CanvasRenderingContext2D, th: Theme, camX: number) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(1, th.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // sun with a sleepy smile
    const sunX = 760;
    const sunY = 130;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
    inked(ctx, "#ffd68a");
    ctx.beginPath();
    ctx.arc(sunX - 14, sunY - 4, 6, Math.PI * 0.1, Math.PI * 0.9);
    ctx.moveTo(sunX + 20, sunY - 4);
    ctx.arc(sunX + 14, sunY - 4, 6, Math.PI * 0.1, Math.PI * 0.9);
    ctx.moveTo(sunX + 10, sunY + 14);
    ctx.arc(sunX, sunY + 12, 10, Math.PI * 0.15, Math.PI * 0.85);
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // clouds
    const cloudPar = camX * T * 0.12;
    const span = VIEW_W + 300;
    for (let i = 0; i < 6; i++) {
      const x = ((((i * 260 + hash(i) * 120 - cloudPar) % span) + span) % span) - 150;
      const y = 80 + hash(i + 9) * 130;
      this.cloud(ctx, x, y, 0.7 + hash(i + 3) * 0.6);
    }

    // two layers of rolling hills
    this.hills(ctx, th.hills[0], camX * T * 0.2, 330, 70, 0.008);
    this.hills(ctx, th.hills[1], camX * T * 0.4, 390, 50, 0.013);
  }

  private cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x + 30 * s, y - 16 * s, 26 * s, Math.PI, Math.PI * 1.85);
    ctx.arc(x + 66 * s, y - 6 * s, 22 * s, Math.PI * 1.3, Math.PI * 0.5);
    ctx.closePath();
    inked(ctx, "#fffaf2", 3);
  }

  private hills(ctx: CanvasRenderingContext2D, color: string, off: number, base: number, amp: number, freq: number) {
    ctx.beginPath();
    ctx.moveTo(-10, VIEW_H);
    for (let x = -10; x <= VIEW_W + 10; x += 8) {
      const wx = x + off;
      const y = base - amp * (0.5 + 0.5 * Math.sin(wx * freq)) * (0.6 + 0.4 * Math.sin(wx * freq * 0.37 + 1));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW_W + 10, VIEW_H);
    ctx.closePath();
    inked(ctx, color, 3);
  }

  private drawCeiling(ctx: CanvasRenderingContext2D, th: Theme, camX: number) {
    const y = sy(PHYS.CEIL);
    const off = (((camX * T) % 48) + 48) % 48;
    ctx.beginPath();
    ctx.moveTo(-60, -10);
    ctx.lineTo(-60, y);
    for (let x = -off - 48; x < VIEW_W + 48; x += 48) ctx.arc(x + 24, y, 24, Math.PI, 0, true);
    ctx.lineTo(VIEW_W + 60, y);
    ctx.lineTo(VIEW_W + 60, -10);
    ctx.closePath();
    inked(ctx, th.grass, 3);
  }

  private drawGround(ctx: CanvasRenderingContext2D, th: Theme, camX: number) {
    ctx.beginPath();
    ctx.rect(-10, GROUND_Y, VIEW_W + 20, VIEW_H - GROUND_Y + 10);
    inked(ctx, th.ground, 3);
    // pebbles that scroll with the world
    const startTile = Math.floor(camX) - 1;
    for (let t = startTile; t < startTile + VIEW_W / T + 3; t++) {
      if (hash(t) > 0.55) continue;
      const x = sx(t + hash(t + 1), camX);
      const y = GROUND_Y + 30 + hash(t + 2) * 34;
      ctx.beginPath();
      ctx.ellipse(x, y, 6 + hash(t + 3) * 6, 4 + hash(t + 4) * 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fill();
    }
    // grass lip with bumps hanging over the dirt
    const off = (((camX * T) % 32) + 32) % 32;
    ctx.beginPath();
    ctx.moveTo(-40, GROUND_Y);
    for (let x = -off - 32; x < VIEW_W + 32; x += 32) ctx.arc(x + 16, GROUND_Y + 8, 16, Math.PI, 0, true);
    ctx.lineTo(VIEW_W + 40, GROUND_Y);
    ctx.closePath();
    inked(ctx, th.grass, 3);
    ctx.beginPath();
    ctx.moveTo(-10, GROUND_Y);
    ctx.lineTo(VIEW_W + 10, GROUND_Y);
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  private drawFinish(ctx: CanvasRenderingContext2D, length: number, camX: number) {
    const x = sx(length + 1, camX);
    if (x < -100 || x > VIEW_W + 100) return;
    const top = sy(PHYS.CEIL);
    ctx.beginPath();
    ctx.rect(x - 4, top, 8, GROUND_Y - top);
    inked(ctx, "#fffaf2", 3);
    const c = 18;
    for (let r = 0; r < 3; r++)
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = (r + k) % 2 ? INK : "#fffaf2";
        ctx.fillRect(x + 4 + k * c, top + 30 + r * c, c, c);
      }
    ctx.beginPath();
    ctx.rect(x + 4, top + 30, c * 4, c * 3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  private drawObj(ctx: CanvasRenderingContext2D, o: Obj, th: Theme, camX: number, used: boolean) {
    const x = sx(o.x, camX);
    const y = sy(o.y + o.h);
    const w = o.w * T;
    const h = o.h * T;
    switch (o.kind) {
      case "block": {
        rrect(ctx, x + 1, y + 1, w - 2, h - 2, 10);
        ctx.fillStyle = th.block;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = th.blockShade;
        ctx.fillRect(x, y + h - 12, w, 12);
        ctx.restore();
        rrect(ctx, x + 1, y + 1, w - 2, h - 2, 10);
        ctx.lineWidth = 3;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 18);
        ctx.quadraticCurveTo(x + 10, y + 10, x + 18, y + 10);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.stroke();
        break;
      }
      case "spike": {
        const base = o.flip ? y : y + h;
        const tip = o.flip ? y + h - 4 : y + 4;
        ctx.beginPath();
        ctx.moveTo(x + 4, base);
        ctx.lineTo(x + w / 2, tip);
        ctx.lineTo(x + w - 4, base);
        ctx.closePath();
        inked(ctx, th.spike);
        const dir = o.flip ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 7, base - dir * 10);
        ctx.lineTo(x + w / 2 - 3, base - dir * 24);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.stroke();
        break;
      }
      case "pad": {
        // bouncy mushroom cap
        const by = o.flip ? y : y + h;
        const d = o.flip ? 1 : -1;
        const squish = used ? 0.6 : 1;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, by, w / 2 - 2, 16 * squish, 0, o.flip ? 0 : Math.PI, o.flip ? Math.PI : 0);
        ctx.closePath();
        inked(ctx, "#ffd34d");
        ctx.beginPath();
        ctx.arc(x + w / 2 - 8, by + d * 7 * squish, 3.5, 0, Math.PI * 2);
        ctx.arc(x + w / 2 + 9, by + d * 9 * squish, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fffaf2";
        ctx.fill();
        break;
      }
      case "orb": {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const pulse = used ? 0 : Math.sin(this.time * 6) * 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 21 + pulse, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = used ? "rgba(43,33,24,0.25)" : INK;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        inked(ctx, used ? "#e7dccb" : "#ffd34d");
        ctx.beginPath();
        ctx.arc(cx - 4, cy - 4, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#fffaf2";
        ctx.fill();
        break;
      }
      case "portal": {
        const color = o.g === -1 ? "#6a9fb5" : th.accent;
        const cx = x + w / 2;
        ctx.beginPath();
        ctx.ellipse(cx, y + h / 2, 20, h / 2 - 6, 0, 0, Math.PI * 2);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 8;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.lineWidth = 4;
        ctx.strokeStyle = color;
        ctx.stroke();
        // arrows show the new gravity direction
        const dir = o.g === -1 ? -1 : 1;
        for (let k = 0; k < 3; k++) {
          const ay = y + h * (0.3 + k * 0.2) + ((this.time * 40) % 20) * dir;
          ctx.beginPath();
          ctx.moveTo(cx - 8, ay - dir * 6);
          ctx.lineTo(cx, ay + dir * 4);
          ctx.lineTo(cx + 8, ay - dir * 6);
          ctx.lineWidth = 4;
          ctx.strokeStyle = INK;
          ctx.stroke();
        }
        break;
      }
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, sim: Sim, camX: number) {
    const p = sim.p;
    const cx = sx(p.x + 0.5, camX);
    const cy = sy(p.y + 0.5);
    const s = T - 4;
    const stretch = 1 + this.squash;
    const sxScale = 1 / Math.sqrt(Math.max(0.5, stretch));

    // soft shadow on whichever surface gravity points to
    const shadowY = p.gd === 1 ? GROUND_Y + 4 : sy(PHYS.CEIL) - 4;
    ctx.beginPath();
    ctx.ellipse(cx, shadowY, 18, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(43,33,24,0.15)";
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sxScale, stretch * p.gd);
    ctx.rotate(p.rot);

    rrect(ctx, -s / 2, -s / 2, s, s, 11);
    ctx.fillStyle = PLAYER;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = PLAYER_SHADE;
    ctx.fillRect(-s / 2, s / 2 - 9, s, 9);
    ctx.restore();
    rrect(ctx, -s / 2, -s / 2, s, s, 11);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // googly eyes
    const blink = this.blinkT < 0;
    for (const ex of [-7, 9]) {
      if (blink) {
        ctx.beginPath();
        ctx.moveTo(ex - 6, -4);
        ctx.lineTo(ex + 6, -4);
        ctx.lineWidth = 3;
        ctx.strokeStyle = INK;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(ex, -4, 7, 8, 0, 0, Math.PI * 2);
        inked(ctx, "#fffaf2", 2.5);
        ctx.beginPath();
        ctx.arc(ex + 2.5, -3 - Math.max(-3, Math.min(3, p.vy * 0.12 * p.gd)), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = INK;
        ctx.fill();
      }
    }
    // cheeks + grin
    ctx.fillStyle = "rgba(255,170,160,0.85)";
    ctx.beginPath();
    ctx.ellipse(-13, 8, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.ellipse(16, 8, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2, 6, 6, Math.PI * 0.15, Math.PI * 0.85);
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
  }
}

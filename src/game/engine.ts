import type { Level, Obj } from "./types";

export const PHYS = {
  G: 88,
  JUMP: 20.6,
  PAD: 27,
  ORB: 20.5,
  MAXV: 32,
  CEIL: 9,
  STEP: 1 / 240,
};

export type GameEvent = "jump" | "land" | "pad" | "orb" | "portal" | "die" | "win";

export interface PlayerState {
  x: number;
  y: number;
  vy: number;
  /** 1 = gravity pulls down, -1 = gravity pulls up */
  gd: 1 | -1;
  grounded: boolean;
  rot: number;
  dead: boolean;
  won: boolean;
}

interface Snapshot {
  p: PlayerState;
  used: number[];
  buffer: number;
  startIdx: number;
}

const EPS = 1e-4;

function overlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw - EPS && ax + aw > bx + EPS && ay < by + bh - EPS && ay + ah > by + EPS;
}

export class Sim {
  readonly level: Level;
  readonly objs: Obj[];
  p!: PlayerState;
  used = new Set<number>();
  events: GameEvent[] = [];
  private buffer = 0;
  private startIdx = 0;

  constructor(level: Level) {
    this.level = level;
    this.objs = [...level.objs].sort((a, b) => a.x - b.x);
    this.reset();
  }

  reset() {
    this.p = { x: 0, y: 0, vy: 0, gd: 1, grounded: true, rot: 0, dead: false, won: false };
    this.used.clear();
    this.events = [];
    this.buffer = 0;
    this.startIdx = 0;
  }

  get progress() {
    return Math.min(1, Math.max(0, this.p.x / this.level.length));
  }

  snapshot(): Snapshot {
    return { p: { ...this.p }, used: [...this.used], buffer: this.buffer, startIdx: this.startIdx };
  }

  restore(s: Snapshot) {
    this.p = { ...s.p };
    this.used = new Set(s.used);
    this.buffer = s.buffer;
    this.startIdx = s.startIdx;
  }

  private die() {
    if (this.p.dead) return;
    this.p.dead = true;
    this.events.push("die");
  }

  /** Advance one fixed physics step. `pressed` is true only on the frame the input went down. */
  tick(holding: boolean, pressed: boolean) {
    const p = this.p;
    if (p.dead || p.won) return;
    const dt = PHYS.STEP;

    if (pressed) this.buffer = 0.12;
    else if (this.buffer > 0) this.buffer -= dt;

    if (p.grounded && holding) {
      p.vy = PHYS.JUMP * p.gd;
      p.grounded = false;
      this.buffer = 0;
      this.events.push("jump");
    }

    p.vy -= p.gd * PHYS.G * dt;
    p.vy = Math.max(-PHYS.MAXV, Math.min(PHYS.MAXV, p.vy));

    const prevY = p.y;
    const wasGrounded = p.grounded;
    p.x += this.level.speed * dt;
    p.y += p.vy * dt;
    p.grounded = false;

    if (p.y < 0) {
      p.y = 0;
      if (p.vy < 0) p.vy = 0;
      if (p.gd === 1) p.grounded = true;
    }
    if (p.y + 1 > PHYS.CEIL) {
      p.y = PHYS.CEIL - 1;
      if (p.vy > 0) p.vy = 0;
      if (p.gd === -1) p.grounded = true;
    }

    const objs = this.objs;
    while (this.startIdx < objs.length && objs[this.startIdx].x + objs[this.startIdx].w < p.x - 1) this.startIdx++;

    for (let i = this.startIdx; i < objs.length && objs[i].x < p.x + 1.5; i++) {
      const o = objs[i];
      switch (o.kind) {
        case "block": {
          if (!overlap(p.x + 0.04, p.y, 0.92, 1, o.x, o.y, o.w, o.h)) break;
          const top = o.y + o.h;
          if (p.gd === 1 && p.vy <= 0 && prevY >= top - 0.3) {
            p.y = top;
            p.vy = 0;
            p.grounded = true;
          } else if (p.gd === -1 && p.vy >= 0 && prevY + 1 <= o.y + 0.3) {
            p.y = o.y - 1;
            p.vy = 0;
            p.grounded = true;
          } else {
            this.die();
          }
          break;
        }
        case "spike": {
          const sy = o.flip ? o.y + 0.45 : o.y;
          if (overlap(p.x + 0.18, p.y + 0.18, 0.64, 0.64, o.x + 0.32, sy, 0.36, 0.55)) this.die();
          break;
        }
        case "pad": {
          if (this.used.has(i)) break;
          const py = o.flip ? o.y + 0.65 : o.y;
          if (overlap(p.x, p.y, 1, 1, o.x + 0.1, py, 0.8, 0.35)) {
            this.used.add(i);
            p.vy = PHYS.PAD * p.gd;
            p.grounded = false;
            this.events.push("pad");
          }
          break;
        }
        case "orb": {
          if (this.used.has(i) || this.buffer <= 0) break;
          if (overlap(p.x, p.y, 1, 1, o.x - 0.25, o.y - 0.25, 1.5, 1.5)) {
            this.used.add(i);
            this.buffer = 0;
            p.vy = PHYS.ORB * p.gd;
            p.grounded = false;
            this.events.push("orb");
          }
          break;
        }
        case "portal": {
          if (this.used.has(i)) break;
          if (overlap(p.x, p.y, 1, 1, o.x, o.y, o.w, o.h)) {
            this.used.add(i);
            if (o.g && o.g !== p.gd) {
              p.gd = o.g;
              p.vy *= 0.4;
              p.grounded = false;
            }
            this.events.push("portal");
          }
          break;
        }
      }
      if (p.dead) return;
    }

    if (p.grounded && !wasGrounded) this.events.push("land");

    // purely visual spin, kept here so it is deterministic
    if (p.grounded) {
      const target = Math.round(p.rot / (Math.PI / 2)) * (Math.PI / 2);
      p.rot += (target - p.rot) * Math.min(1, dt * 30);
    } else {
      p.rot += p.gd * 7.4 * dt;
    }

    if (p.x >= this.level.length) {
      p.won = true;
      this.events.push("win");
    }
  }
}

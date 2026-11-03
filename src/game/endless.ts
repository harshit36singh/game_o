import { PHYS, Sim } from "./engine";
import type { Level } from "./types";

export const FLY = {
  RISE: 10, // climb speed while UP is held (tiles/s)
  DIVE: 10, // dive speed while DOWN is held
  DRIFT: 1.6, // slow sink when nothing is pressed
  RESPONSE: 16, // how quickly vertical speed reaches its target (higher = snappier)
  START_SPEED: 9,
  MAX_SPEED: 14,
  ACCEL: 0.008, // speed gained per tile travelled
  OPEN: 14, // wide-open runway at the start
  NARROW_IN: 18, // tiles over which the tunnel closes in to its starting width
  START_GAP: 7,
  MIN_GAP: 2.5,
  SHRINK: 0.011, // gap lost per tile
};

/** Tiny seeded PRNG so a tunnel can be replayed exactly (used by the solver). */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Endless flying mode: hold to rise, release to fall, and stay inside a wavy
 * tunnel whose walls close in from the top and bottom the further you get.
 */
export class FlySim extends Sim {
  // `declare` so these aren't reset to undefined after the base constructor calls reset()
  declare speed: number;
  declare thrusting: boolean;
  /** set by the game every frame: is the DOWN control held? (UP comes in through tick) */
  declare downHeld: boolean;
  declare phases: number[];
  declare seed: number;
  /** gravity stays off (the cube just bobs) until the player first presses */
  declare started: boolean;
  declare private bob: number;

  constructor(level: Level, seed?: number) {
    super(level);
    this.reset(seed);
  }

  override reset(seed?: number) {
    super.reset();
    this.seed = seed ?? Math.floor(Math.random() * 1e9);
    const rnd = mulberry32(this.seed);
    this.phases = [0, 0, 0].map(() => rnd() * Math.PI * 2);
    this.speed = FLY.START_SPEED;
    this.thrusting = false;
    this.downHeld = false;
    this.started = false;
    this.bob = 0;
    this.p.y = PHYS.CEIL / 2 - 0.5;
    this.p.grounded = false;
  }

  /** Endless: there is no 100%, the HUD shows distance instead. */
  override get progress() {
    return 0;
  }

  get distance() {
    return Math.floor(this.p.x);
  }

  gap(x: number) {
    if (x < FLY.OPEN) return PHYS.CEIL;
    const t = x - FLY.OPEN;
    if (t < FLY.NARROW_IN) return PHYS.CEIL + (FLY.START_GAP - PHYS.CEIL) * (t / FLY.NARROW_IN);
    return Math.max(FLY.MIN_GAP, FLY.START_GAP - (t - FLY.NARROW_IN) * FLY.SHRINK);
  }

  center(x: number) {
    const g = this.gap(x);
    const room = Math.max(0, (PHYS.CEIL - g) / 2 - 0.2);
    const t = Math.max(0, x - FLY.OPEN);
    const f = 1 + Math.min(1, t / 600) * 0.4; // wiggles get a little faster later on
    const [a, b, c] = this.phases;
    const n = 0.55 * Math.sin(x * 0.08 * f + a) + 0.3 * Math.sin(x * 0.17 * f + b) + 0.15 * Math.sin(x * 0.33 * f + c);
    return PHYS.CEIL / 2 + n * room;
  }

  bottom(x: number) {
    return this.center(x) - this.gap(x) / 2;
  }

  top(x: number) {
    return this.center(x) + this.gap(x) / 2;
  }

  /** `up` = UP control held. DOWN comes from `downHeld`. */
  override tick(up: boolean, _pressed: boolean) {
    const p = this.p;
    if (p.dead) return;
    const dt = PHYS.STEP;
    const down = this.downHeld;

    this.thrusting = up && !down;
    this.speed = Math.min(FLY.MAX_SPEED, FLY.START_SPEED + p.x * FLY.ACCEL);
    if (up || down) this.started = true;
    if (!this.started) {
      // gentle hover so nobody crashes before they even touch the controls
      this.bob += dt;
      p.vy = Math.cos(this.bob * 4) * 0.8;
    } else {
      // direct control: ease quickly toward a target climb/dive speed (no floaty momentum)
      const target = up && !down ? FLY.RISE : down && !up ? -FLY.DIVE : -FLY.DRIFT;
      p.vy += (target - p.vy) * Math.min(1, dt * FLY.RESPONSE);
    }
    p.x += this.speed * dt;
    p.y += p.vy * dt;
    // nose follows the flight path
    p.rot = -Math.atan2(p.vy, this.speed) * 0.45;

    // forgiving hitbox: only the middle of the cube counts
    for (const ox of [0.2, 0.5, 0.8]) {
      const wx = p.x + ox;
      if (p.y + 0.2 < this.bottom(wx) || p.y + 0.8 > this.top(wx)) {
        this.die();
        return;
      }
    }
  }
}

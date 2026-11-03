// Brute-force solver: proves each level can be beaten with 60Hz inputs.
import { Sim, PHYS } from "../src/game/engine";
import { ENDLESS, LEVELS } from "../src/game/levels";
import { FlySim } from "../src/game/endless";

const SUB = Math.round(1 / 60 / PHYS.STEP);

function solve(level: (typeof LEVELS)[number]) {
  const sim = new Sim(level);
  const seen = new Set<string>();
  let best = 0;
  const inputs: number[] = [];

  function dfs(frame: number, prevHold: boolean): boolean {
    const p = sim.p;
    best = Math.max(best, p.x);
    if (p.won) return true;
    const key = `${frame}|${p.y.toFixed(2)}|${p.vy.toFixed(1)}|${p.gd}|${p.grounded}|${prevHold}|${sim.used.size}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const snap = sim.snapshot();
    for (const hold of [false, true]) {
      sim.restore(snap);
      let pressed = hold && !prevHold;
      for (let s = 0; s < SUB && !sim.p.dead && !sim.p.won; s++) {
        sim.tick(hold, pressed);
        pressed = false;
      }
      if (!sim.p.dead) {
        inputs.push(hold ? 1 : 0);
        if (dfs(frame + 1, hold)) return true;
        inputs.pop();
      }
    }
    sim.restore(snap);
    return false;
  }

  const ok = dfs(0, false);
  return { ok, best };
}

// Endless tunnel: prove several random tunnels stay flyable well past the point
// where it reaches minimum width and top speed. Decisions at 30Hz (humans get 60Hz).
function solveFly(seed: number, goal: number) {
  const sim = new FlySim(ENDLESS, seed);
  const sub = Math.round(1 / 30 / PHYS.STEP);
  const seen = new Set<string>();
  let best = 0;
  function dfs(frame: number): boolean {
    const p = sim.p;
    best = Math.max(best, p.x);
    if (p.x >= goal) return true;
    const key = `${frame}|${Math.round(p.y * 20)}|${Math.round(p.vy * 2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const snap = sim.snapshot();
    // inputs: up / nothing / down; try the one that steers toward the tunnel centre first
    const wantUp = p.y + 0.5 < sim.center(p.x + 2);
    const order: Array<[boolean, boolean]> = wantUp
      ? [[true, false], [false, false], [false, true]]
      : [[false, true], [false, false], [true, false]];
    for (const [up, down] of order) {
      sim.restore(snap);
      sim.downHeld = down;
      for (let s = 0; s < sub && !sim.p.dead; s++) sim.tick(up, false);
      if (!sim.p.dead && dfs(frame + 1)) return true;
    }
    sim.restore(snap);
    return false;
  }
  return { ok: dfs(0), best };
}

let fail = false;
for (const seed of [1, 2, 3, 42, 1337, 98765]) {
  const r = solveFly(seed, 1000);
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${(ENDLESS.name + " #" + seed).padEnd(16)} ${r.ok ? "flown 1000m" : `stuck at x=${r.best.toFixed(1)}`}`);
  if (!r.ok) fail = true;
}
for (const l of LEVELS) {
  const r = solve(l);
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${l.name.padEnd(16)} ${r.ok ? "" : `stuck at x=${r.best.toFixed(1)}`}`);
  if (!r.ok) fail = true;
}
process.exit(fail ? 1 : 0);

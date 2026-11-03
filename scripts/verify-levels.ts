// Brute-force solver: proves each level can be beaten with 60Hz inputs.
import { Sim, PHYS } from "../src/game/engine";
import { LEVELS } from "../src/game/levels";

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

let fail = false;
for (const l of LEVELS) {
  const r = solve(l);
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${l.name.padEnd(16)} ${r.ok ? "" : `stuck at x=${r.best.toFixed(1)}`}`);
  if (!r.ok) fail = true;
}
process.exit(fail ? 1 : 0);

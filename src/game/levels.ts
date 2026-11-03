import type { Level, Obj, Theme } from "./types";
import { PHYS } from "./engine";

class B {
  objs: Obj[] = [];
  spike(x: number, n = 1, y = 0) {
    for (let i = 0; i < n; i++) this.objs.push({ kind: "spike", x: x + i, y, w: 1, h: 1 });
    return this;
  }
  /** spikes hanging down from a ceiling */
  cspike(x: number, n = 1, y = PHYS.CEIL - 1) {
    for (let i = 0; i < n; i++) this.objs.push({ kind: "spike", x: x + i, y, w: 1, h: 1, flip: true });
    return this;
  }
  block(x: number, y: number, w = 1, h = 1) {
    this.objs.push({ kind: "block", x, y, w, h });
    return this;
  }
  pad(x: number, y = 0, flip = false) {
    this.objs.push({ kind: "pad", x, y, w: 1, h: 1, flip });
    return this;
  }
  orb(x: number, y: number) {
    this.objs.push({ kind: "orb", x, y, w: 1, h: 1 });
    return this;
  }
  portal(x: number, g: 1 | -1) {
    this.objs.push({ kind: "portal", x, y: 0, w: 0.8, h: PHYS.CEIL, g });
    return this;
  }
}

const meadow: Theme = {
  skyTop: "#fbe3c8",
  skyBottom: "#f6f0e6",
  hills: ["#c9d6a3", "#a9bf86"],
  ground: "#9c6b4a",
  grass: "#7fa65a",
  block: "#e8b86b",
  blockShade: "#c9944a",
  spike: "#8f7fb8",
  accent: "#d97757",
};

const biscuit: Theme = {
  skyTop: "#f7c9a8",
  skyBottom: "#fbeee0",
  hills: ["#e2b48c", "#cf9670"],
  ground: "#7d4f36",
  grass: "#c98a4b",
  block: "#f2d29b",
  blockShade: "#d4ad6c",
  spike: "#b5524a",
  accent: "#6a9fb5",
};

const hollow: Theme = {
  skyTop: "#c9c3e6",
  skyBottom: "#efe9f4",
  hills: ["#a9a1d1", "#8d84bd"],
  ground: "#5e4a6e",
  grass: "#7c9c86",
  block: "#9fc5b4",
  blockShade: "#77a391",
  spike: "#d97757",
  accent: "#e8b86b",
};

function meadowStroll(): Obj[] {
  return new B()
    .spike(16)
    .spike(26)
    .spike(36, 2)
    .block(46, 0, 4, 1)
    .spike(57, 2)
    .block(66, 0, 2, 1)
    .block(70, 0, 2, 2)
    .block(74, 0, 6, 2)
    .spike(84, 3)
    .pad(94)
    .spike(96, 4)
    .spike(108)
    .block(114, 0, 7, 1)
    .spike(118, 1, 1)
    .spike(128, 6)
    .orb(130, 2)
    .spike(144)
    .spike(150, 2)
    .spike(157)
    .block(166, 0, 3, 1)
    .block(172, 0, 3, 2)
    .block(178, 0, 3, 1)
    .pad(188)
    .block(192, 0, 4, 3)
    .spike(203, 3).objs;
}

function biscuitCanyon(): Obj[] {
  return new B()
    .spike(14, 2)
    .spike(23)
    .block(29, 0, 3, 1)
    .block(35, 0, 3, 2)
    .spike(32, 3)
    .spike(38, 3)
    .spike(45, 3)
    .pad(53)
    .block(57, 0, 2, 4)
    .spike(59, 5)
    .spike(70, 2)
    .orb(80, 2)
    .spike(78, 7)
    .block(92, 0, 8, 1)
    .spike(95, 1, 1)
    .spike(100, 3)
    .block(108, 0, 2, 2)
    .block(113, 0, 2, 3)
    .spike(110, 3)
    .spike(115, 4)
    .pad(125)
    .orb(131, 4)
    .spike(127, 10)
    .spike(145, 3)
    .block(153, 0, 6, 1)
    .spike(159, 2)
    .block(161, 0, 5, 2)
    .spike(166, 3)
    .spike(176, 2)
    .spike(183, 2)
    .spike(190, 3).objs;
}

function upsideHollow(): Obj[] {
  return new B()
    .spike(14)
    .spike(22, 2)
    .portal(30, -1)
    .cspike(38)
    .cspike(46, 2)
    .block(54, 7, 4, 1)
    .cspike(62, 3)
    .portal(70, 1)
    .spike(76, 2)
    .pad(84)
    .spike(86, 4)
    .block(93, 0, 3, 1)
    .portal(96, -1)
    .cspike(100, 3)
    .block(108, 6, 4, 2)
    .cspike(116, 2)
    .portal(122, 1)
    .spike(128, 3)
    .orb(140, 2)
    .spike(138, 6)
    .portal(150, -1)
    .cspike(154, 2)
    .orb(164, 6)
    .cspike(162, 6)
    .portal(172, 1)
    .spike(178, 3)
    .spike(186, 2).objs;
}

export const LEVELS: Level[] = [
  {
    id: "meadow",
    name: "Meadow Stroll",
    difficulty: "Easy",
    speed: 10.4,
    bpm: 120,
    root: 57,
    scale: [0, 2, 4, 7, 9, 12],
    length: 216,
    theme: meadow,
    objs: meadowStroll(),
  },
  {
    id: "biscuit",
    name: "Biscuit Canyon",
    difficulty: "Normal",
    speed: 11.2,
    bpm: 132,
    root: 55,
    scale: [0, 3, 5, 7, 10, 12],
    length: 202,
    theme: biscuit,
    objs: biscuitCanyon(),
  },
  {
    id: "hollow",
    name: "Upside Hollow",
    difficulty: "Hard",
    speed: 10.8,
    bpm: 126,
    root: 52,
    scale: [0, 2, 3, 7, 8, 12],
    length: 198,
    theme: hollow,
    objs: upsideHollow(),
  },
];

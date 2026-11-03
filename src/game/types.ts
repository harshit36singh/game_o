export type ObjKind = "block" | "spike" | "pad" | "orb" | "portal";

export interface Obj {
  kind: ObjKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** spikes/pads: true when hanging from above */
  flip?: boolean;
  /** portals: gravity direction after passing (1 = normal, -1 = upside down) */
  g?: 1 | -1;
}

export interface Theme {
  skyTop: string;
  skyBottom: string;
  hills: [string, string];
  ground: string;
  grass: string;
  block: string;
  blockShade: string;
  spike: string;
  accent: string;
}

export interface Level {
  id: string;
  name: string;
  difficulty: "Easy" | "Normal" | "Hard";
  speed: number;
  bpm: number;
  /** semitone offsets used by the music generator */
  scale: number[];
  root: number;
  length: number;
  theme: Theme;
  objs: Obj[];
}

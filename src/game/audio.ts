import type { Level } from "./types";

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Tiny procedural chiptune band + sound effects built on WebAudio. */
class AudioBox {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private level: Level | null = null;
  private noise!: AudioBuffer;
  muted = localStorage.getItem("clayhop.muted") === "1";

  private ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain();
      this.music.gain.value = 0.55;
      this.music.connect(this.master);
      const len = this.ctx.sampleRate * 0.3;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    localStorage.setItem("clayhop.muted", m ? "1" : "0");
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
  }

  private tone(t: number, freq: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, slideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hat(t: number, vol: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f).connect(g).connect(this.music);
    s.start(t);
    s.stop(t + 0.06);
  }

  startMusic(level: Level) {
    const ctx = this.ensure();
    this.stopMusic();
    this.level = level;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stopMusic() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const ctx = this.ctx!;
    const lv = this.level!;
    const stepDur = 60 / lv.bpm / 4;
    // a seeded melody so every level has its own tune
    const seed = lv.id.length * 7 + lv.bpm;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const t = this.nextTime;
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % 4;
      const chord = [0, 3, 4, 2][bar];
      // kick
      if (s % 4 === 0) this.tone(t, 150, 0.18, "sine", 0.9, this.music, 45);
      // clap-ish snare
      if (s === 4 || s === 12) this.tone(t, 300, 0.09, "triangle", 0.25, this.music, 120);
      if (s % 2 === 1) this.hat(t, s % 4 === 3 ? 0.18 : 0.08);
      // bouncy bass
      if (s % 2 === 0) {
        const n = lv.root - 24 + lv.scale[chord % lv.scale.length] + (s % 4 === 2 ? 12 : 0);
        this.tone(t, midiHz(n), stepDur * 1.6, "square", 0.12, this.music);
      }
      // plucky lead
      const r = Math.sin((this.step % 64) * 12.9898 + seed) * 43758.5453;
      const rnd = r - Math.floor(r);
      if (s % 2 === 0 || rnd > 0.7) {
        if (rnd > 0.25) {
          const idx = Math.floor(rnd * lv.scale.length);
          const n = lv.root + lv.scale[(idx + chord) % lv.scale.length];
          this.tone(t, midiHz(n), stepDur * 1.2, "triangle", 0.16, this.music);
        }
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }

  sfx(kind: string) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (kind) {
      case "pad":
        this.tone(t, 300, 0.25, "square", 0.12, this.master, 1200);
        break;
      case "orb":
        this.tone(t, 660, 0.15, "triangle", 0.25, this.master, 1320);
        break;
      case "portal":
        this.tone(t, 900, 0.35, "sine", 0.2, this.master, 200);
        break;
      case "die":
        this.tone(t, 420, 0.4, "sawtooth", 0.18, this.master, 60);
        this.tone(t + 0.05, 200, 0.3, "square", 0.12, this.master, 40);
        break;
      case "win":
        [0, 4, 7, 12].forEach((n, i) => this.tone(t + i * 0.1, midiHz(72 + n), 0.3, "triangle", 0.25, this.master));
        break;
    }
  }

  unlock() {
    this.ensure();
  }
}

export const audio = new AudioBox();

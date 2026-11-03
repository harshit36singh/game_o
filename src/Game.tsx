import { useEffect, useRef, useState } from "react";
import { PHYS, Sim } from "./game/engine";
import { Renderer, VIEW_H, VIEW_W } from "./game/render";
import { audio } from "./game/audio";
import type { Level } from "./game/types";

interface Props {
  level: Level;
  hasNext: boolean;
  onExit: () => void;
  onNext: () => void;
}

type Status = "playing" | "paused" | "won";

export const bestKey = (id: string) => `clayhop.best.${id}`;

export default function Game({ level, hasNext, onExit, onNext }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<Status>("playing");
  const restartRef = useRef<() => void>(() => {});
  const [status, setStatusState] = useState<Status>("playing");
  const [attempt, setAttempt] = useState(1);
  const [muted, setMuted] = useState(audio.muted);
  const [best, setBest] = useState(() => Number(localStorage.getItem(bestKey(level.id)) || 0));

  const setStatus = (s: Status) => {
    statusRef.current = s;
    setStatusState(s);
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const sim = new Sim(level);
    const renderer = new Renderer();
    let holding = false;
    let pressed = false;
    let acc = 0;
    let last = performance.now();
    let deadFor = 0;
    let raf = 0;
    let bestLocal = Number(localStorage.getItem(bestKey(level.id)) || 0);

    const saveBest = (pct: number) => {
      if (pct > bestLocal) {
        bestLocal = pct;
        localStorage.setItem(bestKey(level.id), String(pct));
        setBest(pct);
      }
    };

    const restart = () => {
      sim.reset();
      renderer.reset();
      acc = 0;
      deadFor = 0;
      pressed = false;
      setStatus("playing");
      audio.startMusic(level);
    };
    restartRef.current = () => {
      setAttempt((a) => a + 1);
      restart();
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const press = () => {
      audio.unlock();
      if (statusRef.current !== "playing") return;
      if (!holding) pressed = true;
      holding = true;
    };
    const release = () => {
      holding = false;
    };
    const togglePause = () => {
      if (statusRef.current === "won") return;
      if (statusRef.current === "paused") {
        setStatus("playing");
        audio.startMusic(level);
      } else {
        setStatus("paused");
        audio.stopMusic();
        holding = false;
      }
      last = performance.now();
    };

    const isJumpKey = (k: string) => k === "Space" || k === "ArrowUp" || k === "KeyW" || k === "Enter";
    const onKeyDown = (e: KeyboardEvent) => {
      if (isJumpKey(e.code)) {
        e.preventDefault();
        if (!e.repeat) press();
      } else if (e.code === "Escape" || e.code === "KeyP") {
        togglePause();
      } else if (e.code === "KeyR" && statusRef.current !== "won") {
        restartRef.current();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isJumpKey(e.code)) release();
    };
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      press();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    (window as unknown as { __togglePause: () => void }).__togglePause = togglePause;

    audio.startMusic(level);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (statusRef.current === "playing") {
        if (sim.p.dead) {
          deadFor += dt;
          if (deadFor > 0.9) {
            setAttempt((a) => a + 1);
            restart();
          }
        } else if (!sim.p.won) {
          acc += dt;
          while (acc >= PHYS.STEP) {
            sim.tick(holding, pressed);
            pressed = false;
            acc -= PHYS.STEP;
          }
        }
        for (const e of sim.events) {
          renderer.onEvent(e, sim);
          audio.sfx(e);
          if (e === "die") {
            audio.stopMusic();
            saveBest(Math.floor(sim.progress * 100));
          } else if (e === "win") {
            audio.stopMusic();
            saveBest(100);
            setStatus("won");
          }
        }
        sim.events = [];
        renderer.update(dt);
      }

      const scale = canvas.width / VIEW_W;
      ctx.setTransform(scale, 0, 0, canvas.height / VIEW_H, 0, 0);
      renderer.draw(ctx, sim);

      const pct = Math.floor(sim.progress * 100);
      if (barRef.current) barRef.current.style.width = `${sim.progress * 100}%`;
      if (pctRef.current) pctRef.current.textContent = `${pct}%`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      audio.stopMusic();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, [level]);

  const togglePause = () => (window as unknown as { __togglePause: () => void }).__togglePause();

  return (
    <div className="stage">
      <div className="game-frame">
        <canvas ref={canvasRef} className="game-canvas" />
        <div className="hud">
          <div className="hud-left">
            <span className="chip">Attempt {attempt}</span>
          </div>
          <div className="progress">
            <div className="progress-fill" ref={barRef} />
            <span className="progress-text" ref={pctRef}>0%</span>
          </div>
          <div className="hud-right">
            <button
              className="icon-btn"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => {
                audio.setMuted(!muted);
                setMuted(!muted);
              }}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button className="icon-btn" aria-label="Pause" onClick={togglePause}>
              ⏸
            </button>
          </div>
        </div>

        {status === "paused" && (
          <div className="overlay">
            <div className="panel">
              <h2>Paused</h2>
              <p className="muted">Best: {best}%</p>
              <div className="row">
                <button className="btn primary" onClick={togglePause}>Resume</button>
                <button className="btn" onClick={() => restartRef.current()}>Restart</button>
                <button className="btn" onClick={onExit}>Menu</button>
              </div>
            </div>
          </div>
        )}

        {status === "won" && (
          <div className="overlay">
            <div className="panel pop">
              <div className="mascot big happy" aria-hidden>
                <span className="eye" />
                <span className="eye" />
                <span className="smile" />
              </div>
              <h2>Level complete!</h2>
              <p className="muted">
                {level.name} cleared in {attempt} attempt{attempt === 1 ? "" : "s"}.
              </p>
              <div className="row">
                {hasNext && <button className="btn primary" onClick={onNext}>Next level</button>}
                <button className="btn" onClick={() => { setAttempt(0); restartRef.current(); }}>Play again</button>
                <button className="btn" onClick={onExit}>Menu</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="hint">Space / ↑ / click to jump · hold to keep hopping · tap orbs mid-air · Esc to pause · R to restart</p>
    </div>
  );
}

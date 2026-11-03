import { useEffect, useRef, useState } from "react";
import { PHYS, Sim } from "./game/engine";
import { FlySim } from "./game/endless";
import { Renderer, setViewport } from "./game/render";
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
  const tipRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<(id: number, dir: "up" | "down") => void>(() => {});
  const fly = level.mode === "fly";
  const unit = fly ? " m" : "%";
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
    const sim = fly ? new FlySim(level) : new Sim(level);
    const renderer = new Renderer();
    // input: keyboard flags + every active pointer (mouse/finger) and what it is pressing
    let keyUp = false;
    let keyDown = false;
    const pointers = new Map<number, "up" | "down">();
    const upHeld = () => keyUp || [...pointers.values()].includes("up");
    const downHeld = () => keyDown || [...pointers.values()].includes("down");
    let pressed = false;
    let acc = 0;
    let last = performance.now();
    let deadFor = 0;
    let raf = 0;
    let bestLocal = Number(localStorage.getItem(bestKey(level.id)) || 0);
    let view = setViewport(16 / 9);
    if (fly) renderer.bestX = bestLocal;

    /** best is a percentage for normal levels and metres for the endless tunnel */
    const saveBest = (value: number) => {
      if (value > bestLocal) {
        bestLocal = value;
        localStorage.setItem(bestKey(level.id), String(value));
        setBest(value);
        if (fly) renderer.bestX = value;
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
      view = setViewport(r.width / r.height);
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    document.addEventListener("fullscreenchange", resize);

    /** called when any UP-type input goes down (jump in levels, climb in the tunnel) */
    const press = () => {
      audio.unlock();
      if (statusRef.current !== "playing") return;
      if (!upHeld()) pressed = true;
    };
    const releaseAll = () => {
      keyUp = false;
      keyDown = false;
      pointers.clear();
    };
    const togglePause = () => {
      if (statusRef.current === "won") return;
      if (statusRef.current === "paused") {
        setStatus("playing");
        audio.startMusic(level);
      } else {
        setStatus("paused");
        audio.stopMusic();
        releaseAll();
      }
      last = performance.now();
    };

    const isJumpKey = (k: string) => k === "Space" || k === "ArrowUp" || k === "KeyW" || k === "Enter";
    const isDownKey = (k: string) => fly && (k === "ArrowDown" || k === "KeyS");
    const onKeyDown = (e: KeyboardEvent) => {
      if (isJumpKey(e.code)) {
        e.preventDefault();
        // don't let Space/Enter also "click" a HUD button that kept focus
        (document.activeElement as HTMLElement | null)?.blur?.();
        if (!e.repeat) press();
        keyUp = true;
      } else if (isDownKey(e.code)) {
        e.preventDefault();
        audio.unlock();
        keyDown = true;
      } else if (e.code === "Escape" || e.code === "KeyP") {
        togglePause();
      } else if (e.code === "KeyR" && statusRef.current !== "won") {
        restartRef.current();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isJumpKey(e.code)) keyUp = false;
      else if (isDownKey(e.code)) keyDown = false;
    };
    /** canvas presses count as UP; the on-screen arrow buttons call this with their direction */
    const pointerDown = (id: number, dir: "up" | "down") => {
      if (dir === "up") press();
      else audio.unlock();
      if (statusRef.current === "playing") pointers.set(id, dir);
    };
    controlRef.current = pointerDown;
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      pointerDown(e.pointerId, "up");
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("blur", releaseAll);
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
          const holding = upHeld();
          if (sim instanceof FlySim) sim.downHeld = downHeld();
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
            saveBest(fly ? Math.floor(sim.p.x) : Math.floor(sim.progress * 100));
          } else if (e === "win") {
            audio.stopMusic();
            saveBest(100);
            setStatus("won");
          }
        }
        sim.events = [];
        renderer.update(dt, sim);
      }

      const scale = canvas.width / view.w;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      renderer.draw(ctx, sim);

      if (fly) {
        const d = Math.floor(sim.p.x);
        if (pctRef.current) pctRef.current.textContent = `${d} m · best ${Math.max(bestLocal, d)} m`;
        if (barRef.current) barRef.current.style.width = bestLocal ? `${Math.min(100, (d / bestLocal) * 100)}%` : "0%";
        if (tipRef.current) tipRef.current.style.opacity = !(sim as FlySim).started && !sim.p.dead ? "1" : "0";
      } else {
        const pct = Math.floor(sim.progress * 100);
        if (barRef.current) barRef.current.style.width = `${sim.progress * 100}%`;
        if (pctRef.current) pctRef.current.textContent = `${pct}%`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      audio.stopMusic();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      document.removeEventListener("fullscreenchange", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", releaseAll);
    };
  }, [level, fly]);

  const [isFull, setIsFull] = useState(!!document.fullscreenElement);
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth);
  useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const canFullscreen = !!document.fullscreenEnabled;
  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        // phones: prefer landscape while playing (not supported everywhere, so ignore failures)
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        await o.lock?.("landscape").catch(() => {});
      }
    } catch {
      /* fullscreen refused: nothing to do */
    }
  };

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
            {canFullscreen && (
              <button className="icon-btn" aria-label={isFull ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
                {isFull ? "🗗" : "⛶"}
              </button>
            )}
            <button className="icon-btn" aria-label="Pause" onClick={togglePause}>
              ⏸
            </button>
          </div>
        </div>

        {fly && (
          <div className="start-tip" ref={tipRef}>
            Hold ▲ to climb · ▼ to dive
          </div>
        )}

        {fly && status === "playing" && (
          <>
            <button
              className="fly-btn fly-down"
              aria-label="Fly down"
              onPointerDown={(e) => {
                e.preventDefault();
                controlRef.current(e.pointerId, "down");
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              ▼
            </button>
            <button
              className="fly-btn fly-up"
              aria-label="Fly up"
              onPointerDown={(e) => {
                e.preventDefault();
                controlRef.current(e.pointerId, "up");
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              ▲
            </button>
          </>
        )}

        {portrait && status === "playing" && (
          <div className={`rotate-tip${fly ? " above-controls" : ""}`} aria-live="polite">
            <span className="rotate-icon">📱</span> Turn your phone sideways for a bigger view
          </div>
        )}

        {status === "paused" && (
          <div className="overlay">
            <div className="panel">
              <h2>Paused</h2>
              <p className="muted">
                Best: {best}
                {unit}
              </p>
              <p className="controls">
                {fly
                  ? "▲ / ↑ / W / Space to climb · ▼ / ↓ / S to dive · let go to slowly sink · R restarts"
                  : "Space / ↑ / tap to jump · hold to keep hopping · tap orbs mid-air · R restarts"}
              </p>
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
    </div>
  );
}

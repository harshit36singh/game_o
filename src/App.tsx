import { useState } from "react";
import Game, { bestKey } from "./Game";
import { ENDLESS, LEVELS } from "./game/levels";
import { audio } from "./game/audio";

export default function App() {
  // index into LEVELS, or "endless" for the Sky Tunnel
  const [levelIdx, setLevelIdx] = useState<number | "endless" | null>(null);
  const [, refresh] = useState(0);

  if (levelIdx !== null) {
    const endless = levelIdx === "endless";
    return (
      <Game
        key={levelIdx}
        level={endless ? ENDLESS : LEVELS[levelIdx]}
        hasNext={!endless && levelIdx < LEVELS.length - 1}
        onExit={() => {
          setLevelIdx(null);
          refresh((n) => n + 1);
        }}
        onNext={() => setLevelIdx(endless ? null : levelIdx + 1)}
      />
    );
  }

  const skyBest = Number(localStorage.getItem(bestKey(ENDLESS.id)) || 0);

  return (
    <div className="menu">
      <header className="title">
        <div className="mascot bounce" aria-hidden>
          <span className="eye" />
          <span className="eye" />
          <span className="smile" />
        </div>
        <h1>
          Clay <span>Hop</span>
        </h1>
        <p className="tagline">A bouncy little rhythm runner. One button. Lots of spikes.</p>
      </header>

      <div className="levels">
        {LEVELS.map((l, i) => {
          const best = Number(localStorage.getItem(bestKey(l.id)) || 0);
          return (
            <button
              key={l.id}
              className="level-card"
              style={{ "--card": l.theme.block, "--card2": l.theme.skyTop } as React.CSSProperties}
              onClick={() => {
                audio.unlock();
                setLevelIdx(i);
              }}
            >
              <span className={`badge ${l.difficulty.toLowerCase()}`}>{l.difficulty}</span>
              <span className="level-name">{l.name}</span>
              <span className="level-best">
                <span className="mini-bar">
                  <span style={{ width: `${best}%` }} />
                </span>
                {best === 100 ? "★ Cleared" : `Best ${best}%`}
              </span>
            </button>
          );
        })}
      </div>

      <button
        className="level-card endless-card"
        style={{ "--card": "#6a9fb5", "--card2": ENDLESS.theme.skyTop } as React.CSSProperties}
        onClick={() => {
          audio.unlock();
          setLevelIdx("endless");
        }}
      >
        <span className="badge endless">∞ Endless</span>
        <span className="level-name">{ENDLESS.name}</span>
        <span className="endless-desc">Hold to fly. The tunnel closes in from top and bottom. How far can you go?</span>
        <span className="level-best">{skyBest ? `Best ${skyBest} m` : "No flights yet"}</span>
      </button>

      <p className="hint">Space / ↑ / click to jump · hold to keep hopping · tap orbs mid-air</p>
    </div>
  );
}

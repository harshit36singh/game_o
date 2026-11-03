# Clay Hop

An original, cartoon-styled rhythm auto-runner for the browser. Your little clay cube slides forward on its own — tap to hop over spikes, bounce on mushroom pads, tap orbs mid-air, and flip gravity through portals.

**Play:** https://clay-hop.onrender.com

## Controls

| Action | Input |
| --- | --- |
| Jump (hold to keep hopping) | Space / ↑ / W / click / tap |
| Fly up (Sky Tunnel) | Hold Space / ↑ / W / click / tap |
| Orb jump | Tap while touching an orb |
| Pause | Esc / P |
| Restart | R |

## Levels

- **Meadow Stroll** (Easy): spikes, steps and a first orb
- **Biscuit Canyon** (Normal): faster pace with long pad and orb chains
- **Upside Hollow** (Hard): gravity portals and ceiling spikes
- **Sky Tunnel** (Endless): your cube puts on a propeller hat. Hold to fly up, let go to drop, and stay inside a wavy tunnel whose walls close in from the top and bottom while the speed creeps up. Each run is a new random tunnel; your best distance is saved and marked in the tunnel.

All art is drawn in code on a canvas, and the music and sound effects are synthesized live with WebAudio. Best progress is saved in your browser.

## Development

```bash
npm install
npm run dev      # local dev server
npm run verify   # brute-force solver: every level is beatable and random tunnels stay flyable
npm run build    # production build in dist/
```

Built with Vite, React and TypeScript. Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

### Project layout

- `src/game/engine.ts`: deterministic fixed-step physics (no DOM)
- `src/game/endless.ts`: endless flying mode with a procedurally generated, shrinking tunnel
- `src/game/levels.ts`: level layouts and color themes
- `src/game/render.ts`: cartoon canvas renderer (player, obstacles, parallax, particles)
- `src/game/audio.ts`: procedural music and sound effects
- `src/Game.tsx` / `src/App.tsx`: React UI (menu, HUD, pause and win screens)

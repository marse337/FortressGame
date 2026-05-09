# Island Fortress

A browser-based, pixel-art tribute to the arcade classic *Rampart*. Build walls from tetromino pieces, place turrets inside enclosed courtyards, then defend against waves of attacking ships.

Pure HTML5 / Canvas / vanilla JavaScript — no runtime dependencies, no framework. **Plays on desktop and mobile browsers** (iOS Safari, Android Firefox / Chrome) and runs straight from `file://` (just double-click `index.html`).

## How to Play

The game runs in three rotating phases on a 30-second timer. Survive each combat phase to advance to the next wave.

### Phases

1. **Build** — Place tetromino-shaped wall pieces to enclose territory. You need at least one fully closed courtyard to survive the round.
2. **Turret** — Place turrets inside your courtyards. The number you can place depends on courtyard size (per-wave cap and total cap).
3. **Combat** — Enemy boats spawn offshore and fire at your walls. Aim and tap/click to fire your turrets.

Lose all your walls and it's game over.

### Controls

The game uses three on-screen action buttons that work for both mouse and touch: **Rotate**, **Erase**, **Skip**. They're enabled only during the relevant phases.

**Desktop (mouse + keyboard):**

| Input | Action |
|-------|--------|
| **Left click** | Place piece / fire turret |
| **Right click** | Erase |
| **R** | Rotate piece / turret |
| **Space** | Skip current phase |

**Mobile / touch:**

| Input | Action |
|-------|--------|
| **Tap** | Place piece / fire turret |
| **Erase button (toggle)** | Tap to enable erase mode, then taps erase instead of place |
| **Rotate button** | Rotate the piece or turret |
| **Skip button** | End the current Build or Turret phase early |

### UI Toggles

- **Grid** — show/hide tile grid overlay
- **Scanlines** — CRT scanline effect
- **Waves** — animated water

## Running Locally

The game ships as a single bundled script ([game.js](game.js)) loaded as a classic `<script>`, so you can **just double-click `index.html`** — no server required, no CORS errors. Works the same when served over HTTP.

If you want to test on a phone over your local network, run any static file server and open the page from the phone:

```sh
# Python
python -m http.server 8000

# Node
npx serve .
```

Then open `http://<your-pc-ip>:8000` from the phone (and `http://localhost:8000` from the PC).

## Editing the Source

The source of truth is the modular code in [src/](src/). The single-file `game.js` is **generated** from those files by [build.mjs](build.mjs).

After editing anything under `src/`, regenerate the bundle:

```sh
node build.mjs
```

That's the entire build step — no `npm install`, no dependencies. `build.mjs` reads each file in dependency order, strips ES `import`/`export` syntax, wraps the result in an IIFE, and writes it to `game.js`.

## Hosting on GitHub Pages

Because this is a pure static site, GitHub Pages can serve it directly with no build step or workflow file.

1. Create a new public repository on GitHub.
2. From this folder:
   ```sh
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
3. On GitHub, go to **Settings → Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Set **Branch** to `main` and folder to `/ (root)`. Save.
6. Wait ~30 seconds, then visit `https://<your-username>.github.io/<repo-name>/`.

Push new commits to `main` and the live site updates automatically.

## Project Structure

```
index.html              Entry point and HUD markup
styles.css              UI styling (responsive, touch-friendly)
game.js                 Generated bundle — what the browser loads
build.mjs               Tiny Node script that bundles src/ into game.js
src/
  main.js               Boot: wires modules together and starts the loop
  config.js             Canvas/buffer constants
  gameConstants.js      Wave scaling formulas and round timing
  state.js              Central game state shape
  flow.js               Phase machine (LOBBY -> BUILD -> TURRET -> COMBAT)
  gameLoop.js           Main RAF loop
  input.js              Pointer/keyboard routing per phase
  ui.js                 HUD bindings, on-screen action buttons, erase-mode toggle
  layout.js             Procedural island generation
  pieces.js             Tetromino shapes and rotation
  buildPhase.js         Wall placement logic
  turretPhase.js        Turret placement logic
  combatPhase.js        Enemy spawning, projectiles, hit resolution
  wavePrep.js           Reset/carry-over between waves
  enclosure.js          Flood-fill to detect closed courtyards
  courtyard.js          Courtyard tile bookkeeping
  mapper.js             Screen <-> internal-buffer coordinate mapping
  render.js             Pixel-buffer rendering
  palette.js            Color palette
  utils.js              Seeded RNG and helpers
```

## Architecture Notes

- The game renders to a small **384x288 internal buffer** (8px tiles), then scales to a larger on-page canvas. This preserves the chunky pixel look at any window size.
- Input uses the **Pointer Events API**, which unifies mouse, touch, and pen. The canvas has `touch-action: none` so swipes don't scroll the page.
- The browser loads a single bundled [game.js](game.js) (a classic script wrapping all source in one IIFE), which is why double-clicking `index.html` just works. ES-module CORS rules forbid loading `import`-style code from `file://`, so the bundle sidesteps that.
- Phases are driven by [src/flow.js](src/flow.js); the on-screen action buttons (Rotate / Erase / Skip) auto-enable based on current phase.
- Difficulty scales per wave via the formulas in [src/gameConstants.js](src/gameConstants.js#L7-L11) (enemy count, health, fire rate, movement, projectile speed).
- All randomness goes through the seeded `RNG` in [src/utils.js](src/utils.js), with separate streams for layout, piece shuffling, and combat.

## Browser Support

Tested on:

- Desktop Chrome / Edge / Firefox / Safari (recent versions)
- iOS Safari 15+
- Android Chrome / Firefox (recent versions)

The game requires support for the Pointer Events API and ES2018+ JavaScript features (available in every browser shipped since ~2020).

## License

Not specified. Add a `LICENSE` file if you intend to publish or share this code.

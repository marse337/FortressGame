// src/main.js
import { CONFIG } from "./config.js";
import { RNG } from "./utils.js";
import { createState } from "./state.js";
import { generateLayout } from "./layout.js";
import { renderFrame } from "./render.js";
import { initUI } from "./ui.js";
import { recomputeCourtyards } from "./enclosure.js";

import { rebuildCourtyardSet } from "./courtyard.js";
import { createMapper } from "./mapper.js";
import { initBuildPhase } from "./buildPhase.js";
import { initTurretPhase } from "./turretPhase.js";
import { initCombatPhase } from "./combatPhase.js";
import { initFlow } from "./flow.js";
import { startGameLoop } from "./gameLoop.js";
import { initInput } from "./input.js";

import { resetFortressForNewGame, prepareNextWaveKeepWalls } from "./wavePrep.js";

const view = document.getElementById("view");
const vctx = view.getContext("2d");

// low-res internal buffer
const buf = document.createElement("canvas");
buf.width = CONFIG.INTERNAL_W;
buf.height = CONFIG.INTERNAL_H;
const ctx = buf.getContext("2d");

const state = createState();

// Safety: ensure fields exist (so refactors don’t crash)
if (!state.wallTiles) state.wallTiles = new Set();
if (!state.turrets) state.turrets = [];
if (!state.projectiles) state.projectiles = [];
if (!state.courtyardRegions) state.courtyardRegions = [];
if (!state.courtyardSet) state.courtyardSet = new Set();
if (!state.boats) state.boats = [];
if (state.turretsPlacedThisWave == null) state.turretsPlacedThisWave = 0;

// RNGs
let layoutRng = new RNG((Math.random() * 1e9) | 0);
let pieceRng  = new RNG((Math.random() * 1e9) | 0);
let combatRng = new RNG((Math.random() * 1e9) | 0);

function buildFreshLayout() {
  layoutRng = new RNG((Math.random() * 1e9) | 0);
  generateLayout(state, layoutRng);
}

const mapper = createMapper(view);

// flow is referenced by UI callbacks, so define it before initUI
let flow = null;

const ui = initUI({
  onRestart: () => flow?.resetToLobby(),
  onStart: () => flow?.startGame(),
});

const build = initBuildPhase({
  state,
  pieceRng,
  recomputeCourtyards,
  rebuildCourtyardSet,
});

function resetForNewGame() {
  resetFortressForNewGame({ state, newPiece: build.newPiece });
}

function prepNextWaveKeepWalls() {
  prepareNextWaveKeepWalls({ state, newPiece: build.newPiece });
}

const turret = initTurretPhase({
  state,
  recomputeCourtyards,
  rebuildCourtyardSet,
});

const combat = initCombatPhase({
  state,
  combatRng,
  recomputeCourtyards,
  rebuildCourtyardSet,
  onAllWallsDestroyed: () => flow?.gameOver("Game Over: all walls destroyed!"),
});

// Flow controls phases/waves/banner/timer.
// IMPORTANT: Flow must call ui.setRound(state.wave) when wave changes.
// (If your flow already does this, great; if not, add it there.)
flow = initFlow({
  state,
  ui,
  buildFreshLayout,
  resetFortressForNewGame: resetForNewGame,
  prepareNextWaveKeepWalls: prepNextWaveKeepWalls,
  spawnEnemiesForWave: combat.spawnEnemiesForWave,
  turret // <-- add this
});

// Input routes pointer/keyboard to the correct phase handlers
initInput({ view, state, mapper, build, turret, combat, flow });

// Resize view
function resizeView() {
  const maxW = Math.min(CONFIG.VIEW_MAX_W, document.documentElement.clientWidth - CONFIG.VIEW_PADDING);
  const w = Math.max(CONFIG.VIEW_MIN_W, maxW | 0);
  const h = (w / CONFIG.ASPECT) | 0;
  view.width = w;
  view.height = h;
}
window.addEventListener("resize", resizeView);
view.addEventListener("contextmenu", (e) => e.preventDefault());

// Boot
resizeView();
flow.resetToLobby();

// Start loop
startGameLoop({
  state,
  ui,
  renderFrame,
  ctx,
  buf,
  vctx,
  view,
  mapper,
  flow,
  combat,
  turret,
});

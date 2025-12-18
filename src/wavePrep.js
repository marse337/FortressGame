// src/wavePrep.js
import { recomputeCourtyards } from "./enclosure.js";
import { rebuildCourtyardSet } from "./courtyard.js";

export function resetFortressForNewGame({ state, newPiece }) {
  // Defensive init (prevents rare undefined crashes)
  if (!state.wallTiles) state.wallTiles = new Set();
  if (!state.courtyardRegions) state.courtyardRegions = [];
  if (!state.courtyardSet) state.courtyardSet = new Set();
  if (!state.turrets) state.turrets = [];
  if (!state.projectiles) state.projectiles = [];
  if (!state.boats) state.boats = [];

  // Clear fortress + entities
  state.wallTiles.clear();
  state.turrets.length = 0;
  state.projectiles.length = 0;
  state.boats.length = 0;

  state.courtyardRegions.length = 0;
  state.courtyardSet.clear();

  // Reset per-wave placement budget
  state.turretsPlacedThisWave = 0;

  // Reset common controls/ghosts to avoid stale state on restart
  state.turretDir = 0;
  state.hover = { x: -1, y: -1, valid: false, cells: [] };

  newPiece();
  recomputeCourtyards(state);
  rebuildCourtyardSet(state);
}

export function prepareNextWaveKeepWalls({ state, newPiece }) {
  // Defensive init
  if (!state.courtyardRegions) state.courtyardRegions = [];
  if (!state.courtyardSet) state.courtyardSet = new Set();
  if (!state.turrets) state.turrets = [];
  if (!state.projectiles) state.projectiles = [];
  if (!state.boats) state.boats = [];

  // Keep walls; clear combat-only entities
  state.projectiles.length = 0;
  state.boats.length = 0;

  // Age turrets (green->orange->red->gone)
  for (let i = state.turrets.length - 1; i >= 0; i--) {
    state.turrets[i].life = (state.turrets[i].life ?? 3) - 1;
    if (state.turrets[i].life <= 0) state.turrets.splice(i, 1);
  }

  // Courtyard may have changed if walls were destroyed
  recomputeCourtyards(state);
  rebuildCourtyardSet(state);

  // Reset per-wave placement budget (so you can place more next turret phase)
  state.turretsPlacedThisWave = 0;

  newPiece();
}

// src/turretPhase.js
import { CONFIG } from "./config.js";
import { key } from "./utils.js";

export function initTurretPhase({ state, recomputeCourtyards, rebuildCourtyardSet }) {
  function isCourtyardTile(tx, ty) {
    return !!state.courtyardSet && state.courtyardSet.has(key(tx, ty));
  }

  function turretCells(anchorTx, anchorTy, dir) {
    if (dir === 0) return [{ x: anchorTx, y: anchorTy }, { x: anchorTx + 1, y: anchorTy }];
    return [{ x: anchorTx, y: anchorTy }, { x: anchorTx, y: anchorTy + 1 }];
  }

  function buildTurretOccupiedSet() {
    const occ = new Set();
    for (const t of (state.turrets || [])) {
      for (const c of turretCells(t.x, t.y, t.dir)) occ.add(key(c.x, c.y));
    }
    return occ;
  }

  function countEmptyCourtyardTiles() {
    const courtyard = state.courtyardSet;
    if (!courtyard || courtyard.size === 0) return 0;

    const occ = buildTurretOccupiedSet();
    const walls = state.wallTiles;

    let empty = 0;
    for (const k of courtyard) {
      if (walls && walls.has(k)) continue;
      if (occ.has(k)) continue;
      empty++;
    }
    return empty;
  }

  // Turrets allowed THIS WAVE based on empty courtyard space
  // Formula: 1 + floor(emptyTiles / 20), capped at 4
  const TILES_PER_TURRET = 20;
  const MAX_TURRETS_PER_WAVE_CAP = 4;

  function maxTurretsThisWave() {
    const emptyTiles = countEmptyCourtyardTiles();
    return Math.min(MAX_TURRETS_PER_WAVE_CAP, 1 + Math.floor(emptyTiles / TILES_PER_TURRET));
  }

  // Total turret cap (prevents infinite accumulation over waves)
  // 1 turret per 6 empty tiles - generous but prevents overcrowding
  function maxTotalTurretsForCourtyard() {
    const emptyTiles = countEmptyCourtyardTiles();
    return Math.max(1, Math.floor(emptyTiles / 6));
  }

  function isTurretOccupied(tx, ty) {
    for (const t of (state.turrets || [])) {
      const cells = turretCells(t.x, t.y, t.dir);
      if (cells.some(c => c.x === tx && c.y === ty)) return true;
    }
    return false;
  }

  function computeHover(anchorTx, anchorTy) {
    const maxTx = Math.floor(CONFIG.INTERNAL_W / CONFIG.TILE) - 1;
    const maxTy = Math.floor(CONFIG.INTERNAL_H / CONFIG.TILE) - 1;

    const dir = state.turretDir || 0;
    const cells = turretCells(anchorTx, anchorTy, dir);

    let valid = true;

    // Cap A: per-wave placement budget (scales with courtyard size)
    const maxThisWave = maxTurretsThisWave();
    if ((state.turretsPlacedThisWave || 0) >= maxThisWave) valid = false;

    // Cap B: total turrets based on EMPTY courtyard space + wave divisor
    const maxTotal = maxTotalTurretsForCourtyard();
    if ((state.turrets?.length || 0) >= maxTotal) valid = false;

    for (const c of cells) {
      if (c.x < 0 || c.y < 0 || c.x > maxTx || c.y > maxTy) { valid = false; break; }
      if (!isCourtyardTile(c.x, c.y)) { valid = false; break; }
      if (state.wallTiles?.has(key(c.x, c.y))) { valid = false; break; }
      if (isTurretOccupied(c.x, c.y)) { valid = false; break; }
    }

    return { cells, valid, maxTotal, maxThisWave };
  }

  function setHover(tx, ty) {
    const { cells, valid } = computeHover(tx, ty);
    state.hover = { x: tx, y: ty, valid, cells };
  }

  function placeAtHover() {
    if (!state.hover?.valid) return;

    const maxThisWave = maxTurretsThisWave();
    const maxTotal = maxTotalTurretsForCourtyard();
    if ((state.turretsPlacedThisWave || 0) >= maxThisWave) return;
    if ((state.turrets?.length || 0) >= maxTotal) return;

    const dir = state.turretDir || 0;
    state.turrets.push({ x: state.hover.x, y: state.hover.y, dir, life: 3, placedWave: state.wave });

    state.turretsPlacedThisWave = (state.turretsPlacedThisWave || 0) + 1;

    recomputeCourtyards(state);
    rebuildCourtyardSet(state);

    const { cells, valid } = computeHover(state.hover.x, state.hover.y);
    state.hover = { ...state.hover, valid, cells };
  }

  function eraseAtAnchor() {
    const h = state.hover;
    if (!h || h.x < 0 || h.y < 0) return;

    for (let i = 0; i < (state.turrets?.length || 0); i++) {
      const t = state.turrets[i];
      const cells = turretCells(t.x, t.y, t.dir);

      if (cells.some(c => c.x === h.x && c.y === h.y)) {
        if (state.phase === "TURRET" && t.placedWave === state.wave) {
          state.turretsPlacedThisWave = Math.max(0, (state.turretsPlacedThisWave || 0) - 1);
        }
        state.turrets.splice(i, 1);
        break;
      }
    }

    recomputeCourtyards(state);
    rebuildCourtyardSet(state);

    const { cells, valid } = computeHover(h.x, h.y);
    state.hover = { ...h, valid, cells };
  }

  return {
    countEmptyCourtyardTiles,
    maxTurretsThisWave,
    maxTotalTurretsForCourtyard,
    setHover,
    placeAtHover,
    eraseAtAnchor
  };
}

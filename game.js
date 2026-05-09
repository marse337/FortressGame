/* Island Fortress - generated bundle.
   Source of truth lives in src/*.js.
   To regenerate after editing source: node build.mjs */
(function () {
  "use strict";

// ============ src/config.js ============
const CONFIG = {
  // Bigger internal “console” buffer (still 4:3, still divisible by TILE=8)
  INTERNAL_W: 384,
  INTERNAL_H: 288,
  TILE: 8,

  // Bigger on-page canvas
  VIEW_MAX_W: 1200,
  VIEW_MIN_W: 720,
  VIEW_PADDING: 32,

  ASPECT: 4 / 3,
};

// ============ src/gameConstants.js ============
// src/gameConstants.js
const ROUND_SECONDS = 30;
const BANNER_H = 28;
const BANNER_SPEED = 140;

// Wave scaling (casual difficulty - survivable to wave 15+)
function enemyCountForWave(w) { return 3 + w; }
function enemyHealthForWave(w) { return 1 + Math.floor(w / 2); }
function enemyShotIntervalForWave(w) { return Math.max(1.0, 2.5 - w * 0.1); }
function enemyMoveSpeedForWave(w) { return 22 + w * 3; }
function enemyProjectileSpeedForWave(w) { return Math.min(180, 105 + w * 5); }

// ============ src/palette.js ============
const PAL = {
  ocean0: "#0b4a78",
  ocean1: "#0f6399",
  ocean2: "#1679b5",
  foam1:  "#cfefff",
  foam2:  "#9fe3ff",
  beach0: "#d7b67a",
  beach1: "#caa466",
  grass0: "#1f8f2e",
  grass1: "#2db83d",
  grass2: "#157424",
  wall0:  "#2b2f4a",
  wall1:  "#4b4f73",
  wall2:  "#6c6fa3",
  wall3:  "#8b8ec7",
  tower0: "#6b7280",
  tower1: "#9ca3af",
  tower2: "#e5e7eb",
  boat0:  "#7a4a1a",
  boat1:  "#a36a2b",
  boat2:  "#d3a15e",
  sail0:  "#f1f5f9",
  grid:   "rgba(0,0,0,.22)"
};

// ============ src/utils.js ============
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function key(x, y) { return `${x},${y}`; }

function insideEllipse(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return (dx*dx + dy*dy) <= 1;
}

function drawPixelRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x|0, y|0, w|0, h|0);
}

function drawDitheredRect(ctx, x, y, w, h, cA, cB, step = 2) {
  for (let yy = 0; yy < h; yy += step) {
    for (let xx = 0; xx < w; xx += step) {
      ctx.fillStyle = (((xx/step + yy/step) | 0) % 2 === 0) ? cA : cB;
      ctx.fillRect((x+xx)|0, (y+yy)|0, step, step);
    }
  }
}

// Simple deterministic RNG (LCG)
class RNG {
  constructor(seed = 123456789) {
    this.seed = seed >>> 0;
  }
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
}

// ============ src/pieces.js ============
// Tetromino base shapes in tile offsets (x,y)
const BASE = {
  I: [[0,0],[1,0],[2,0],[3,0]],
  O: [[0,0],[1,0],[0,1],[1,1]],
  T: [[1,0],[0,1],[1,1],[2,1]],
  S: [[1,0],[2,0],[0,1],[1,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]],
  J: [[0,0],[0,1],[1,1],[2,1]],
  L: [[2,0],[0,1],[1,1],[2,1]],
};

const TYPES = Object.keys(BASE);

function normalize(offsets) {
  let minX = Infinity, minY = Infinity;
  for (const [x,y] of offsets) { if (x < minX) minX = x; if (y < minY) minY = y; }
  return offsets.map(([x,y]) => [x - minX, y - minY]);
}

function rotate90(offsets) {
  // (x,y) -> (y, -x), then normalize to keep coords >= 0
  const rot = offsets.map(([x,y]) => [y, -x]);
  return normalize(rot);
}

function getOffsets(type, rot) {
  let o = BASE[type].map(p => [...p]);
  const r = ((rot % 4) + 4) % 4;
  for (let i = 0; i < r; i++) o = rotate90(o);
  return o;
}

function nextPiece(rng) {
  const type = TYPES[rng.int(0, TYPES.length - 1)];
  return { type, rot: 0 };
}

function rotatePiece(piece) {
  return { ...piece, rot: (piece.rot + 1) % 4 };
}

// Convenience: create a piece RNG if you want one
function makePieceRng(seed = (Math.random() * 1e9) | 0) {
  return new RNG(seed);
}

// ============ src/mapper.js ============
function createMapper(view) {
  let lastMap = { scale: 1, ox: 0, oy: 0 };

  function setMap(map) {
    lastMap = map || lastMap;
  }

  function clientToInternal(clientX, clientY) {
    const r = view.getBoundingClientRect();
    const vx = ((clientX - r.left) * (view.width / r.width));
    const vy = ((clientY - r.top) * (view.height / r.height));
    const { scale, ox, oy } = lastMap;
    return { ix: (vx - ox) / scale, iy: (vy - oy) / scale };
  }

  return { setMap, clientToInternal };
}

// ============ src/layout.js ============
function generateLayout(state, rng) {
  state.wallTiles.clear();
  if (state.courtyardRegions) state.courtyardRegions.length = 0;
  state.boats.length = 0;

  // Boats around the island perimeter (keep or remove if you want)
  const boatCount = 6;
  for (let i = 0; i < boatCount; i++) {
    const angle = (i / boatCount) * Math.PI * 2 + (rng.next() * 0.35);
    const rr = 1.25 + rng.next() * 0.10;
    const bx = state.cx + Math.cos(angle) * state.rx * rr;
    const by = state.cy + Math.sin(angle) * state.ry * rr;

    state.boats.push({
      x: bx,
      y: by,
      dir: angle + Math.PI,
      bob: rng.next() * Math.PI * 2
    });
  }

  state.renderSeed = rng.seed >>> 0;
}

// ============ src/state.js ============
function createState() {
  return {
    cx: CONFIG.INTERNAL_W * 0.52,
    cy: CONFIG.INTERNAL_H * 0.52,
    rx: CONFIG.INTERNAL_W * 0.37,
    ry: CONFIG.INTERNAL_H * 0.30,

    wallTiles: new Set(),

    courtyardRegions: [],        // from enclosure.js
    courtyardSet: new Set(),     // all courtyard tiles (x,y keys)

    // NEW: courtyard tiles that are not empty (walls/turrets occupy these)
    occupiedCourtyardSet: new Set(),

    boats: [],

    // build piece
    piece: { type: "T", rot: 0 },

    // hover ghost
    hover: { x: -1, y: -1, valid: false, cells: [] },

    // turret placement + combat
    turrets: [],                 // [{ x, y, dir, life, placedWave }]
    turretDir: 0,                // 0=horizontal, 1=vertical
    aimX: 0,
    aimY: 0,
    turretsPlacedThisWave: 0,

    // game flow
    phase: "LOBBY",              // LOBBY | BUILD | TURRET | COMBAT | GAMEOVER
    wave: 1,
    timeLeft: 10,
    timerRunning: false,
    gameOver: false,

    // combat entities
    projectiles: [],             // [{x,y,vx,vy,life,type}]

    // banner
    bannerActive: false,
    bannerY: 0,
    bannerText: "",

    renderSeed: 1,
  };
}

// ============ src/enclosure.js ============
const DIRS = [
  [ 1, 0],
  [-1, 0],
  [ 0, 1],
  [ 0,-1],
];

function inBounds(x, y, W, H) {
  return x >= 0 && y >= 0 && x < W && y < H;
}

function isLandTile(state, tx, ty) {
  const cx = tx * CONFIG.TILE + CONFIG.TILE / 2;
  const cy = ty * CONFIG.TILE + CONFIG.TILE / 2;
  return insideEllipse(cx, cy, state.cx, state.cy, state.rx * 0.98, state.ry * 0.98);
}

/**
 * Flood-fill from the map boundary through ANY non-wall tile (water+land).
 * A land tile becomes "courtyard" only if it is NOT reachable from the boundary
 * because walls fully enclosed it.
 *
 * Produces: state.courtyardRegions = [{ tiles:[{x,y}...], bounds:{minX,maxX,minY,maxY} }, ...]
 */
function recomputeCourtyards(state) {
  const W = Math.floor(CONFIG.INTERNAL_W / CONFIG.TILE);
  const H = Math.floor(CONFIG.INTERNAL_H / CONFIG.TILE);

  const wall = state.wallTiles;

  // Precompute land mask (only used at the end for "courtyard is land-only")
  const land = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      land[y * W + x] = isLandTile(state, x, y) ? 1 : 0;
    }
  }

  // Reachable from boundary through NOT-walls (water+land)
  const reach = new Uint8Array(W * H);
  const qx = new Int16Array(W * H);
  const qy = new Int16Array(W * H);
  let qh = 0, qt = 0;

  function trySeed(x, y) {
    const idx = y * W + x;
    if (reach[idx]) return;
    if (wall.has(key(x, y))) return; // walls block traversal
    reach[idx] = 1;
    qx[qt] = x; qy[qt] = y; qt++;
  }

  // Seed from ALL boundary tiles (not just land)
  for (let x = 0; x < W; x++) {
    trySeed(x, 0);
    trySeed(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    trySeed(0, y);
    trySeed(W - 1, y);
  }

  // BFS
  while (qh < qt) {
    const x = qx[qh], y = qy[qh]; qh++;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inBounds(nx, ny, W, H)) continue;
      const nidx = ny * W + nx;
      if (reach[nidx]) continue;
      if (wall.has(key(nx, ny))) continue;
      reach[nidx] = 1;
      qx[qt] = nx; qy[qt] = ny; qt++;
    }
  }

  // Inside = LAND tiles that are not reachable (and are not walls)
  const inside = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!land[idx]) continue;           // only land can become courtyard
      if (wall.has(key(x, y))) continue;  // walls are not courtyard
      if (!reach[idx]) inside[idx] = 1;   // enclosed land
    }
  }

  // Group inside tiles into connected regions
  const visited = new Uint8Array(W * H);
  const regions = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const startIdx = y * W + x;
      if (!inside[startIdx] || visited[startIdx]) continue;

      let minX = x, maxX = x, minY = y, maxY = y;
      const tiles = [];

      visited[startIdx] = 1;
      qh = 0; qt = 0;
      qx[qt] = x; qy[qt] = y; qt++;

      while (qh < qt) {
        const cx = qx[qh], cy = qy[qh]; qh++;
        tiles.push({ x: cx, y: cy });

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (const [dx, dy] of DIRS) {
          const nx = cx + dx, ny = cy + dy;
          if (!inBounds(nx, ny, W, H)) continue;
          const nidx = ny * W + nx;
          if (!inside[nidx] || visited[nidx]) continue;
          visited[nidx] = 1;
          qx[qt] = nx; qy[qt] = ny; qt++;
        }
      }

      regions.push({ tiles, bounds: { minX, maxX, minY, maxY } });
    }
  }

  // Optional: ignore tiny pockets (prevents 1-tile accidental courtyards)
  const MIN_TILES = 6;
  const filtered = regions.filter(r => r.tiles.length >= MIN_TILES);

  filtered.sort((a, b) => b.tiles.length - a.tiles.length);
  state.courtyardRegions = filtered;

}

// ============ src/courtyard.js ============
// src/courtyard.js

function rebuildCourtyardSet(state) {
  if (!state) return;
  if (!state.courtyardSet) state.courtyardSet = new Set();
  state.courtyardSet.clear();

  const regions = state.courtyardRegions || [];
  for (const r of regions) {
    const tiles = r?.tiles || [];
    for (const t of tiles) state.courtyardSet.add(key(t.x, t.y));
  }
}

// ============ src/wavePrep.js ============
// src/wavePrep.js

function resetFortressForNewGame({ state, newPiece }) {
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

function prepareNextWaveKeepWalls({ state, newPiece }) {
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

// ============ src/buildPhase.js ============
function initBuildPhase({ state, pieceRng, recomputeCourtyards, rebuildCourtyardSet }) {
  function newPiece() {
    state.piece = nextPiece(pieceRng);
  }

  function isLandTile(tx, ty) {
    const cx = tx * CONFIG.TILE + CONFIG.TILE / 2;
    const cy = ty * CONFIG.TILE + CONFIG.TILE / 2;
    return insideEllipse(cx, cy, state.cx, state.cy, state.rx * 0.98, state.ry * 0.98);
  }

  function computePieceCells(anchorTx, anchorTy, piece) {
    const maxTx = Math.floor(CONFIG.INTERNAL_W / CONFIG.TILE) - 1;
    const maxTy = Math.floor(CONFIG.INTERNAL_H / CONFIG.TILE) - 1;

    const offsets = getOffsets(piece.type, piece.rot);
    const cells = offsets.map(([ox, oy]) => ({ x: anchorTx + ox, y: anchorTy + oy }));

    let valid = true;
    for (const c of cells) {
      if (c.x < 0 || c.y < 0 || c.x > maxTx || c.y > maxTy) { valid = false; break; }
      if (!isLandTile(c.x, c.y)) { valid = false; break; }
      if (state.wallTiles.has(key(c.x, c.y))) { valid = false; break; }
    }

    return { cells, valid };
  }

  function setHover(tx, ty) {
    const { cells, valid } = computePieceCells(tx, ty, state.piece);
    state.hover = { x: tx, y: ty, valid, cells };
  }

  function placeAtHover() {
    if (!state.hover.valid) return;

    for (const c of state.hover.cells) state.wallTiles.add(key(c.x, c.y));

    recomputeCourtyards(state);
    rebuildCourtyardSet(state);

    newPiece();

    const { cells, valid } = computePieceCells(state.hover.x, state.hover.y, state.piece);
    state.hover = { ...state.hover, valid, cells };
  }

  function eraseAtHover() {
    const h = state.hover;
    if (h.x < 0 || h.y < 0) return;

    state.wallTiles.delete(key(h.x, h.y));

    recomputeCourtyards(state);
    rebuildCourtyardSet(state);

    const { cells, valid } = computePieceCells(h.x, h.y, state.piece);
    state.hover = { ...h, valid, cells };
  }

  return { newPiece, setHover, placeAtHover, eraseAtHover };
}

// ============ src/turretPhase.js ============
// src/turretPhase.js

function initTurretPhase({ state, recomputeCourtyards, rebuildCourtyardSet }) {
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

// ============ src/combatPhase.js ============
// src/combatPhase.js

function initCombatPhase({
  state,
  combatRng,
  recomputeCourtyards,
  rebuildCourtyardSet,
  onAllWallsDestroyed
}) {
  function isLandPixel(x, y) {
    return insideEllipse(x, y, state.cx, state.cy, state.rx * 1.04, state.ry * 1.05);
  }

  function spawnEnemiesForWave(wave) {
    state.boats.length = 0;

    const n = enemyCountForWave(wave);
    const hp = enemyHealthForWave(wave);
    const spd = enemyMoveSpeedForWave(wave);
    const interval = enemyShotIntervalForWave(wave);

    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + (combatRng.next() * 0.5);
      const rr = 1.35 + combatRng.next() * 0.10;

      const x = state.cx + Math.cos(angle) * state.rx * rr;
      const y = state.cy + Math.sin(angle) * state.ry * rr;

      const dir = combatRng.next() * Math.PI * 2;
      const vx = Math.cos(dir) * spd;
      const vy = Math.sin(dir) * spd;

      state.boats.push({
        x, y, vx, vy,
        dir,
        bob: combatRng.next() * Math.PI * 2,
        hp,
        shotCd: combatRng.next() * interval,
        shotInterval: interval
      });
    }
  }

  function pickRandomWallKey() {
    const size = state.wallTiles.size;
    if (size <= 0) return null;

    let idx = (combatRng.next() * size) | 0;
    for (const k of state.wallTiles) {
      if (idx-- === 0) return k;
    }
    return state.wallTiles.values().next().value || null;
  }

  function enemyFireAtWalls(enemy) {
    const k = pickRandomWallKey();
    if (!k) return;

    const [tx, ty] = k.split(",").map(Number);
    const targetX = tx * CONFIG.TILE + CONFIG.TILE / 2;
    const targetY = ty * CONFIG.TILE + CONFIG.TILE / 2;

    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const d = Math.hypot(dx, dy) || 1;

    const speed = enemyProjectileSpeedForWave(state.wave);

    state.projectiles.push({
      x: enemy.x, y: enemy.y,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed,
      life: 2.5,
      type: "enemy"
    });
  }

  // --- NEW: courtyard validation for turrets during combat ---

  function turretFootprintCells(t) {
    if (t.dir === 0) return [{ x: t.x, y: t.y }, { x: t.x + 1, y: t.y }];      // horizontal 2x1
    return [{ x: t.x, y: t.y }, { x: t.x, y: t.y + 1 }];                       // vertical 1x2
  }

  function turretIsStillOnCourtyard(t) {
    const set = state.courtyardSet;
    if (!set || set.size === 0) return false;

    const cells = turretFootprintCells(t);
    for (const c of cells) {
      if (!set.has(key(c.x, c.y))) return false;
    }
    return true;
  }

  function fireTurretsAt(aimX, aimY) {
    if (!state.turrets || state.turrets.length === 0) return;

    const speed = 240;

    for (const t of state.turrets) {
      // IMPORTANT FIX: do not fire if turret no longer sits fully on courtyard
      if (!turretIsStillOnCourtyard(t)) continue;

      const w = (t.dir === 0) ? 2 : 1;
      const h = (t.dir === 0) ? 1 : 2;
      const ox = (t.x + w / 2) * CONFIG.TILE;
      const oy = (t.y + h / 2) * CONFIG.TILE;

      const dx = aimX - ox;
      const dy = aimY - oy;
      const d = Math.hypot(dx, dy) || 1;

      state.projectiles.push({
        x: ox, y: oy,
        vx: (dx / d) * speed,
        vy: (dy / d) * speed,
        life: 2.0,
        type: "turret"
      });
    }
  }

  function updateCombat(dt) {
    // enemies move + shoot
    for (const b of state.boats) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < 6) { b.x = 6; b.vx *= -1; }
      if (b.x > CONFIG.INTERNAL_W - 6) { b.x = CONFIG.INTERNAL_W - 6; b.vx *= -1; }
      if (b.y < 6) { b.y = 6; b.vy *= -1; }
      if (b.y > CONFIG.INTERNAL_H - 6) { b.y = CONFIG.INTERNAL_H - 6; b.vy *= -1; }

      // land bounce
      if (isLandPixel(b.x, b.y)) {
        const nx = b.x - state.cx;
        const ny = b.y - state.cy;
        const nd = Math.hypot(nx, ny) || 1;
        const ux = nx / nd, uy = ny / nd;

        const dot = b.vx * ux + b.vy * uy;
        if (dot < 0) {
          b.vx = b.vx - 2 * dot * ux;
          b.vy = b.vy - 2 * dot * uy;
        }

        b.x += ux * 8;
        b.y += uy * 8;
      }

      b.dir = Math.atan2(b.vy, b.vx);

      b.shotCd -= dt;
      if (b.shotCd <= 0) {
        b.shotCd = b.shotInterval;
        enemyFireAtWalls(b);
      }
    }

    // projectiles
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (
        p.life <= 0 ||
        p.x < -20 || p.y < -20 ||
        p.x > CONFIG.INTERNAL_W + 20 || p.y > CONFIG.INTERNAL_H + 20
      ) {
        state.projectiles.splice(i, 1);
        continue;
      }

      if (p.type === "enemy") {
        const tx = Math.floor(p.x / CONFIG.TILE);
        const ty = Math.floor(p.y / CONFIG.TILE);
        const k = key(tx, ty);

        if (state.wallTiles.has(k)) {
          state.wallTiles.delete(k);
          state.projectiles.splice(i, 1);

          // Courtyards may change after wall removal
          recomputeCourtyards(state);
          rebuildCourtyardSet(state);

          if (state.wallTiles.size === 0) {
            onAllWallsDestroyed?.();
            return { allDestroyed: false };
          }
        }
        continue;
      }

      // turret projectile hits enemy
      if (p.type === "turret") {
        for (let j = state.boats.length - 1; j >= 0; j--) {
          const b = state.boats[j];
          const dx = b.x - p.x;
          const dy = b.y - p.y;

          if ((dx * dx + dy * dy) <= (10 * 10)) {
            b.hp -= 1;
            state.projectiles.splice(i, 1);

            if (b.hp <= 0) state.boats.splice(j, 1);
            break;
          }
        }
      }
    }

    return { allDestroyed: (state.boats.length === 0) };
  }

  return { spawnEnemiesForWave, fireTurretsAt, updateCombat };
}

// ============ src/flow.js ============
function initFlow({
  state,
  ui,
  buildFreshLayout,
  resetFortressForNewGame,
  prepareNextWaveKeepWalls,
  spawnEnemiesForWave,
  turret
}) {
  function startPhaseBanner(text) {
    state.bannerActive = true;
    state.bannerY = -BANNER_H;
    state.bannerText = text;
    state.timerRunning = false;
  }

  function resetToLobby(randomize = true) {
    state.phase = "LOBBY";
    state.wave = 1;
    ui.setRound(state.wave);
    ui.setActionsForPhase?.(state.phase);
    state.gameOver = false;

    state.timerRunning = false;
    state.timeLeft = ROUND_SECONDS;
    state.bannerActive = false;
    state.turretsPlacedThisWave = 0;

    ui.setTime(state.timeLeft);

    if (randomize) {
      buildFreshLayout();
    }
    resetFortressForNewGame();

    ui.setStatus("Press Start to begin.");
    ui.setStartEnabled(true);
  }

  function beginBuildPhase() {
    state.phase = "BUILD";
    ui.setActionsForPhase?.(state.phase);
    ui.setRound(state.wave);
    state.timeLeft = ROUND_SECONDS;
    ui.setTime(state.timeLeft);
    ui.setStatus(`Wave ${state.wave}: Build walls. Use Rotate / Skip below.`);
    startPhaseBanner("Create your fortress");
  }

  function beginTurretPhase() {
    state.phase = "TURRET";
    ui.setActionsForPhase?.(state.phase);
    state.turretsPlacedThisWave = 0;

    state.timeLeft = ROUND_SECONDS;
    ui.setTime(state.timeLeft);

    // Dynamic caps based on courtyard size
    const maxThisWave = turret?.maxTurretsThisWave?.() ?? 1;
    const maxTotal = turret?.maxTotalTurretsForCourtyard?.() ?? 1;

    ui.setStatus(
      `Place up to ${maxThisWave} turrets. Total cap: ${maxTotal}`
    );

    startPhaseBanner("Place your turrets");
  }

  function beginCombatPhase() {
    state.phase = "COMBAT";
    ui.setActionsForPhase?.(state.phase);
    state.timeLeft = ROUND_SECONDS;
    ui.setTime(state.timeLeft);
    ui.setStatus("Defend your walls — tap/click to fire.");

    spawnEnemiesForWave(state.wave);
    startPhaseBanner("Combat!");
  }

  function endCombatAndStartNextWave() {
    state.wave += 1;
    ui.setRound(state.wave);
    prepareNextWaveKeepWalls();
    beginBuildPhase();
  }

  function startGame(randomize = true) {
    if (state.phase !== "LOBBY" && state.phase !== "GAMEOVER") return;

    state.gameOver = false;
    state.wave = 1;
    ui.setRound(state.wave);

    if (randomize) {
      buildFreshLayout();
    }
    resetFortressForNewGame();

    beginBuildPhase();
    ui.setStartEnabled(false);
  }

  function gameOver(msg) {
    state.phase = "GAMEOVER";
    ui.setActionsForPhase?.(state.phase);
    state.gameOver = true;
    state.timerRunning = false;
    state.bannerActive = false;
    ui.setStatus(msg, true);
    ui.setStartEnabled(true);
  }

  function onPhaseTimerExpired() {
    if (state.phase === "BUILD") {
      if (!state.courtyardRegions || state.courtyardRegions.length === 0) {
        gameOver("Game Over: no courtyard!");
        return;
      }
      beginTurretPhase();
      return;
    }

    if (state.phase === "TURRET") {
      beginCombatPhase();
      return;
    }

    if (state.phase === "COMBAT") {
      endCombatAndStartNextWave();
      return;
    }
  }

  function onBannerFinishedStartTimer() {
    if (state.gameOver) return;
    if (state.phase === "BUILD" || state.phase === "TURRET" || state.phase === "COMBAT") {
      state.timerRunning = true;
      state.timeLeft = ROUND_SECONDS;
      ui.setTime(state.timeLeft);
    }
  }

  return {
    resetToLobby,
    startGame,
    beginBuildPhase,
    beginTurretPhase,
    beginCombatPhase,
    endCombatAndStartNextWave,
    gameOver,
    onPhaseTimerExpired,
    onBannerFinishedStartTimer
  };
}

// ============ src/gameLoop.js ============
function startGameLoop({ state, ui, renderFrame, ctx, buf, vctx, view, mapper, flow, combat, turret }) {
  let lastT = performance.now();

  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    // banner scroll -> start timer for current phase at end
    if (state.bannerActive) {
      state.bannerY += BANNER_SPEED * dt;
      if (state.bannerY >= CONFIG.INTERNAL_H) {
        state.bannerActive = false;
        flow.onBannerFinishedStartTimer();
      }
    }

    // safety net: if turret count reached, force combat
    if (state.phase === "TURRET" && !state.bannerActive && !state.gameOver) {
      const maxThisWave = turret?.maxTurretsThisWave?.() ?? Infinity;
      const maxTotal = turret?.maxTotalTurretsForCourtyard?.() ?? Infinity;
      const placed = state.turretsPlacedThisWave || 0;
      const total = state.turrets?.length || 0;

      if (placed >= maxThisWave || total >= maxTotal) {
        state.timerRunning = false;
        flow.beginCombatPhase();
      }
    }

    // combat updates
    if (state.phase === "COMBAT" && !state.bannerActive && !state.gameOver) {
      const res = combat.updateCombat(dt);
      if (res?.allDestroyed) {
        state.timerRunning = false;
        flow.endCombatAndStartNextWave();
      }
    }

    // phase timer countdown
    if (state.timerRunning && !state.gameOver) {
      state.timeLeft -= dt;

      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        ui.setTime(state.timeLeft);
        state.timerRunning = false;
        flow.onPhaseTimerExpired();
      } else {
        ui.setTime(state.timeLeft);
      }
    }

    const map = renderFrame({ ctx, buf, vctx, view, state, ui }, t);
    if (map) mapper.setMap(map);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

// ============ src/render.js ============
// src/render.js

function torchHash(tx, ty, seed) {
  // deterministic per-tile “spark” chance (no flicker)
  let h = (tx * 73856093) ^ (ty * 19349663) ^ (seed | 0);
  h >>>= 0;
  return h;
}

function renderOcean(ctx, t, ui, rng) {
  drawDitheredRect(ctx, 0, 0, CONFIG.INTERNAL_W, CONFIG.INTERNAL_H, PAL.ocean1, PAL.ocean0, 2);

  for (let y = 0; y < CONFIG.INTERNAL_H; y += 8) {
    const band = (y / 8) % 2 === 0 ? PAL.ocean2 : PAL.ocean1;
    ctx.globalAlpha = 0.12;
    drawPixelRect(ctx, 0, y, CONFIG.INTERNAL_W, 4, band);
    ctx.globalAlpha = 1;
  }

  if (ui.waves) {
    ctx.globalAlpha = 0.28;
    const waveCount = 260;
    for (let i = 0; i < waveCount; i++) {
      const x = (rng.next() * CONFIG.INTERNAL_W) | 0;
      const y = (rng.next() * CONFIG.INTERNAL_H) | 0;
      const w = ((rng.next() * 3) | 0) + 1;
      const phase = Math.sin((t * 0.002) + x * 0.06 + y * 0.04);
      if (phase > 0.65) drawPixelRect(ctx, x, y, w, 1, PAL.foam2);
    }
    ctx.globalAlpha = 1;
  }
}

function renderIsland(ctx, t, ui, state) {
  const { cx, cy, rx, ry } = state;

  for (let y = 0; y < CONFIG.INTERNAL_H; y += 2) {
    for (let x = 0; x < CONFIG.INTERNAL_W; x += 2) {
      if (!insideEllipse(x, y, cx, cy, rx, ry)) continue;
      const n = Math.sin(x * 0.09) + Math.cos(y * 0.07) + Math.sin((x + y) * 0.03);
      const c = (n > 1.1) ? PAL.grass1 : (n < 0.2 ? PAL.grass2 : PAL.grass0);
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const beachOuterRx = rx * 1.05;
  const beachOuterRy = ry * 1.06;
  const beachInnerRx = rx * 0.96;
  const beachInnerRy = ry * 0.96;

  for (let y = 0; y < CONFIG.INTERNAL_H; y += 2) {
    for (let x = 0; x < CONFIG.INTERNAL_W; x += 2) {
      const inOuter = insideEllipse(x, y, cx, cy, beachOuterRx, beachOuterRy);
      const inInner = insideEllipse(x, y, cx, cy, beachInnerRx, beachInnerRy);
      if (inOuter && !inInner) {
        const c = (((x + y) >> 2) % 2 === 0) ? PAL.beach0 : PAL.beach1;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  const foamOuterRx = rx * 1.16;
  const foamOuterRy = ry * 1.18;
  const foamInnerRx = rx * 1.06;
  const foamInnerRy = ry * 1.07;

  for (let y = 0; y < CONFIG.INTERNAL_H; y += 2) {
    for (let x = 0; x < CONFIG.INTERNAL_W; x += 2) {
      const inOuter = insideEllipse(x, y, cx, cy, foamOuterRx, foamOuterRy);
      const inInner = insideEllipse(x, y, cx, cy, foamInnerRx, foamInnerRy);
      if (inOuter && !inInner) {
        const wv = ui.waves ? Math.sin(t * 0.004 + x * 0.12 + y * 0.08) : 0.8;
        const c = (wv > 0.4) ? PAL.foam1 : PAL.foam2;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }
}

function renderBorder(ctx) {
  drawPixelRect(ctx, 0, 0, CONFIG.INTERNAL_W, 10, "#4b5563");
  drawPixelRect(ctx, 0, CONFIG.INTERNAL_H - 10, CONFIG.INTERNAL_W, 10, "#4b5563");
  drawPixelRect(ctx, 0, 0, 10, CONFIG.INTERNAL_H, "#4b5563");
  drawPixelRect(ctx, CONFIG.INTERNAL_W - 10, 0, 10, CONFIG.INTERNAL_H, "#4b5563");

  ctx.globalAlpha = 0.25;
  drawPixelRect(ctx, 10, 10, CONFIG.INTERNAL_W - 20, 2, "#fff");
drawPixelRect(ctx, 10, 10, 2, CONFIG.INTERNAL_H - 20, "#fff");
  ctx.globalAlpha = 1;
}

/**
 * Irregular courtyards (from flood-fill):
 * state.courtyardRegions = [{ tiles:[{x,y},...], bounds:{...} }, ...]
 */
function renderCourtyards(ctx, state) {
  const regions = state.courtyardRegions || [];
  if (!regions.length) return;

  for (const r of regions) {
    // 1) Dark floor tiles
    for (const t of r.tiles) {
      const px = t.x * CONFIG.TILE;
      const py = t.y * CONFIG.TILE;
      drawDitheredRect(ctx, px, py, CONFIG.TILE, CONFIG.TILE, "#0a1630", "#081126", 2);
    }

    // 2) Blue grid lines per tile (only where interior exists)
    ctx.globalAlpha = 0.65;
    for (const t of r.tiles) {
      const px = t.x * CONFIG.TILE;
      const py = t.y * CONFIG.TILE;

      drawPixelRect(ctx, px, py, CONFIG.TILE, 1, "rgba(72, 139, 255, .35)");
      drawPixelRect(ctx, px, py, 1, CONFIG.TILE, "rgba(72, 139, 255, .35)");

      drawPixelRect(ctx, px, py + CONFIG.TILE - 1, CONFIG.TILE, 1, "rgba(72, 139, 255, .18)");
      drawPixelRect(ctx, px + CONFIG.TILE - 1, py, 1, CONFIG.TILE, "rgba(72, 139, 255, .18)");
    }
    ctx.globalAlpha = 1;
  }
}

function renderWalls(ctx, state) {
  for (const k of state.wallTiles) {
    const [tx, ty] = k.split(",").map(Number);
    const x = tx * CONFIG.TILE;
    const y = ty * CONFIG.TILE;

    drawPixelRect(ctx, x, y, CONFIG.TILE, CONFIG.TILE, PAL.wall1);
    drawPixelRect(ctx, x, y + 5, CONFIG.TILE, 3, PAL.wall0);
    drawPixelRect(ctx, x + 1, y + 1, 3, 2, PAL.wall3);
    drawPixelRect(ctx, x + 1, y + 3, 2, 1, PAL.wall2);

    if ((torchHash(tx, ty, state.renderSeed) % 100) < 7) {
      drawPixelRect(ctx, x + 6, y + 2, 1, 2, "#fbbf24");
      drawPixelRect(ctx, x + 6, y + 1, 1, 1, "#fde68a");
    }
  }
}

function renderBoats(ctx, t, ui, state) {
  for (const b of state.boats) {
    const bob = ui.waves ? Math.sin(t * 0.006 + b.bob) * 1.5 : 0;
    const x = b.x;
    const y = b.y + bob;

    const dx = Math.cos(b.dir), dy = Math.sin(b.dir);
    const absx = Math.abs(dx), absy = Math.abs(dy);
    const orient = absx > absy ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N");

    ctx.save();
    ctx.translate(x | 0, y | 0);

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.fillRect(-10, 8, 20, 3);
    ctx.globalAlpha = 1;

    const hull = () => {
      drawPixelRect(ctx, -10, 2, 20, 6, PAL.boat1);
      drawPixelRect(ctx, -8, 1, 16, 1, PAL.boat2);
      drawPixelRect(ctx, -9, 7, 18, 1, PAL.boat0);
      drawPixelRect(ctx, 10, 3, 2, 4, PAL.boat0);
    };

    const sail = () => {
      drawPixelRect(ctx, -2, -10, 2, 12, "#374151");
      drawPixelRect(ctx, 0, -9, 10, 8, PAL.sail0);
      drawPixelRect(ctx, 0, -9, 10, 1, "#e2e8f0");
      drawPixelRect(ctx, 8, -8, 2, 6, "#e2e8f0");
    };

    if (orient === "E") { hull(); sail(); }
    if (orient === "W") { ctx.scale(-1, 1); hull(); sail(); }
    if (orient === "N") { ctx.rotate(-Math.PI / 2); hull(); sail(); }
    if (orient === "S") { ctx.rotate(Math.PI / 2); hull(); sail(); }

    ctx.restore();
  }
}

function renderTurrets(ctx, state) {
  for (const t of (state.turrets || [])) {
    const x = t.x * CONFIG.TILE;
    const y = t.y * CONFIG.TILE;

    const w = (t.dir === 0) ? (CONFIG.TILE * 2) : CONFIG.TILE;
    const h = (t.dir === 0) ? CONFIG.TILE : (CONFIG.TILE * 2);

    const life = (t.life ?? 3);

    // life: 3=green, 2=orange, 1=red
    const topColor =
      life >= 3 ? "#22c55e" :
      life === 2 ? "#f59e0b" :
      "#ef4444";

    drawPixelRect(ctx, x, y, w, h, "#374151");
    drawPixelRect(ctx, x, y + h - 2, w, 2, "#111827");

    drawPixelRect(ctx, x + 2, y + 2, Math.max(1, w - 4), Math.max(1, h - 4), topColor);

    if (t.dir === 0) drawPixelRect(ctx, x + w - 3, y + 3, 3, 2, "#e5e7eb");
    else drawPixelRect(ctx, x + 3, y, 2, 3, "#e5e7eb");
  }
}

// Tetromino ghost hover (state.hover.cells)
function renderHover(ctx, state) {
  const h = state.hover;
  if (!h || h.x < 0 || h.y < 0) return;

  const cells = h.cells || [];
  if (!cells.length) return;

  // Only show the wall-piece ghost in BUILD (turret ghost can stay as-is if you want)
  // If you want both, remove this phase check.
  if (state.phase !== "BUILD" && state.phase !== "TURRET") return;

  // Strong contrast colors
  const ok = !!h.valid;
  const outline = ok ? "#e5e7eb" : "#ff4d4d";  // bright white vs strong red
  const fillA    = ok ? "rgba(15, 23, 42, 0.55)" : "rgba(127, 29, 29, 0.55)"; // dark navy / dark red
  const fillB    = ok ? "rgba(59, 130, 246, 0.25)" : "rgba(248, 113, 113, 0.25)"; // blue / red tint

  for (const c of cells) {
    const px = c.x * CONFIG.TILE;
    const py = c.y * CONFIG.TILE;

    // 1) dark fill (covers grass clearly)
    ctx.globalAlpha = 1;
    ctx.fillStyle = fillA;
    ctx.fillRect(px, py, CONFIG.TILE, CONFIG.TILE);

    // 2) subtle checker (16-bit vibe + readability)
    ctx.fillStyle = fillB;
    ctx.fillRect(px, py, CONFIG.TILE, 1);
    ctx.fillRect(px, py, 1, CONFIG.TILE);
    ctx.fillRect(px + CONFIG.TILE - 1, py, 1, CONFIG.TILE);
    ctx.fillRect(px, py + CONFIG.TILE - 1, CONFIG.TILE, 1);

    // 3) bright outline (most important part)
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, CONFIG.TILE - 2, CONFIG.TILE - 2);
  }
}


function renderGridOverlay(ctx) {
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = PAL.grid;
  ctx.lineWidth = 1;

  for (let x = 0; x <= CONFIG.INTERNAL_W; x += CONFIG.TILE) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, CONFIG.INTERNAL_H);
    ctx.stroke();
  }

  for (let y = 0; y <= CONFIG.INTERNAL_H; y += CONFIG.TILE) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(CONFIG.INTERNAL_W, y + 0.5);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

function renderBanner(ctx, state) {
  if (!state.bannerActive) return;

  const h = 28;
  const y = (state.bannerY | 0);

  ctx.globalAlpha = 0.92;
  drawPixelRect(ctx, 0, y, CONFIG.INTERNAL_W, h, "#111827");
  ctx.globalAlpha = 1;

  drawPixelRect(ctx, 0, y, CONFIG.INTERNAL_W, 1, "#e5e7eb");
  drawPixelRect(ctx, 0, y + h - 1, CONFIG.INTERNAL_W, 1, "#e5e7eb");

  ctx.globalAlpha = 0.25;
  drawPixelRect(ctx, 0, y + 4, CONFIG.INTERNAL_W, 1, "#60a5fa");
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText(state.bannerText || "", (CONFIG.INTERNAL_W / 2) + 1, y + (h / 2) + 1);

  ctx.fillStyle = "#fbbf24";
  ctx.fillText(state.bannerText || "", (CONFIG.INTERNAL_W / 2), y + (h / 2));
  ctx.restore();
}

function renderProjectiles(ctx, state) {
  const ps = state.projectiles || [];
  for (const p of ps) {
    const x = (p.x | 0);
    const y = (p.y | 0);
    const c = (p.type === "enemy") ? "#fb7185" : "#fbbf24";
    drawPixelRect(ctx, x - 1, y - 1, 3, 3, c);
  }
}

function renderAimCursor(ctx, state) {
  if (state.phase !== "COMBAT") return;

  const x = state.aimX | 0;
  const y = state.aimY | 0;

  drawPixelRect(ctx, x - 6, y, 13, 1, "#e5e7eb");
  drawPixelRect(ctx, x, y - 6, 1, 13, "#e5e7eb");
  drawPixelRect(ctx, x - 1, y - 1, 3, 3, "#fbbf24");
}

function renderFrame({ ctx, buf, vctx, view, state, ui }, t) {
  const rng = new RNG(state.renderSeed);

  ctx.clearRect(0, 0, CONFIG.INTERNAL_W, CONFIG.INTERNAL_H);

  renderOcean(ctx, t, ui, rng);
  renderIsland(ctx, t, ui, state);

  renderCourtyards(ctx, state);
  renderWalls(ctx, state);
  renderTurrets(ctx, state);

  renderBoats(ctx, t, ui, state);
  renderProjectiles(ctx, state);
  renderAimCursor(ctx, state);

  if (ui.grid) renderGridOverlay(ctx);

  renderBorder(ctx);
  renderHover(ctx, state);

  // Banner on top of everything
  renderBanner(ctx, state);

  // Upscale to view
  vctx.imageSmoothingEnabled = false;
  const vw = view.width, vh = view.height;

  const scale = Math.floor(Math.min(vw / CONFIG.INTERNAL_W, vh / CONFIG.INTERNAL_H));
  const dw = CONFIG.INTERNAL_W * scale;
  const dh = CONFIG.INTERNAL_H * scale;
  const ox = ((vw - dw) / 2) | 0;
  const oy = ((vh - dh) / 2) | 0;

  vctx.clearRect(0, 0, vw, vh);
  vctx.drawImage(buf, 0, 0, CONFIG.INTERNAL_W, CONFIG.INTERNAL_H, ox, oy, dw, dh);

  if (ui.scanlines) {
    vctx.globalAlpha = 0.18;
    for (let y = oy; y < oy + dh; y += 3) vctx.fillRect(ox, y, dw, 1);
    vctx.globalAlpha = 1;
  }

  return { scale, ox, oy };
}

// ============ src/ui.js ============
function initUI({ onRestart, onStart, onRotate, onSkip }) {
    const btnRestart = document.getElementById("btnRestart");
    const btnStart = document.getElementById("btnStart");
    const btnRotate = document.getElementById("btnRotate");
    const btnErase = document.getElementById("btnErase");
    const btnSkip = document.getElementById("btnSkip");

    const chkGrid = document.getElementById("chkGrid");
    const chkScanlines = document.getElementById("chkScanlines");
    const chkWaves = document.getElementById("chkWaves");

    const txtTime = document.getElementById("txtTime");
    const txtRound = document.getElementById("txtRound");
    const txtStatus = document.getElementById("txtStatus");
    const timerBar = document.getElementById("timerBar");
    const timerDisplay = txtTime?.parentElement;

    let eraseMode = false;

    function setEraseMode(on) {
        eraseMode = !!on;
        if (btnErase) btnErase.setAttribute("aria-pressed", eraseMode ? "true" : "false");
    }

    function setActionsForPhase(phase) {
        const placing = phase === "BUILD" || phase === "TURRET";
        if (btnRotate) btnRotate.disabled = !placing;
        if (btnErase) btnErase.disabled = !placing;
        if (btnSkip) btnSkip.disabled = !placing;
        if (!placing) setEraseMode(false);
    }

    const ui = {
        get grid() { return chkGrid?.checked ?? false; },
        get scanlines() { return chkScanlines?.checked ?? false; },
        get waves() { return chkWaves?.checked ?? true; },

        get isEraseMode() { return eraseMode; },
        setEraseMode,
        setActionsForPhase,

        setTime(seconds) {
            if (txtTime) txtTime.textContent = seconds.toFixed(1);

            // Update timer bar width
            const percent = Math.max(0, (seconds / ROUND_SECONDS) * 100);
            if (timerBar) timerBar.style.width = `${percent}%`;

            // Update warning/danger states
            const isWarning = seconds <= 10 && seconds > 5;
            const isDanger = seconds <= 5;

            if (timerDisplay) {
                timerDisplay.classList.toggle("warning", isWarning);
                timerDisplay.classList.toggle("danger", isDanger);
            }
            if (timerBar) {
                timerBar.classList.toggle("warning", isWarning);
                timerBar.classList.toggle("danger", isDanger);
            }
        },

        setRound(n) {
            if (txtRound) txtRound.textContent = String(n);
        },

        setStatus(msg, isGameOver = false) {
            if (!txtStatus) return;
            txtStatus.textContent = msg || "";
            txtStatus.classList.toggle("gameover", !!isGameOver);
        },

        setStartEnabled(enabled) {
            if (btnStart) btnStart.disabled = !enabled;
        }
    };

    btnRestart?.addEventListener("click", () => onRestart?.());
    btnStart?.addEventListener("click", () => onStart?.());
    btnRotate?.addEventListener("click", () => onRotate?.());
    btnSkip?.addEventListener("click", () => onSkip?.());
    btnErase?.addEventListener("click", () => setEraseMode(!eraseMode));

    return ui;
}

// ============ src/input.js ============
// src/input.js

function initInput({ view, state, mapper, build, turret, combat, flow, ui }) {
  // Mobile placement aids (BUILD/TURRET only):
  //   - lift the anchor TOUCH_LIFT_TILES tiles above the finger so the preview isn't covered
  //   - clamp anchor onto the island ellipse so dragging into water "skates" along the coast
  const TOUCH_LIFT_TILES = 5;
  const ISLAND_PROJECT_FACTOR = 0.96; // just inside the 0.98 placement boundary

  function internalToTile(ix, iy) {
    return { tx: Math.floor(ix / CONFIG.TILE), ty: Math.floor(iy / CONFIG.TILE) };
  }

  function projectOntoIsland(ix, iy) {
    const cx = state.cx, cy = state.cy;
    const rx = (state.rx || 0) * ISLAND_PROJECT_FACTOR;
    const ry = (state.ry || 0) * ISLAND_PROJECT_FACTOR;
    if (rx <= 0 || ry <= 0) return { ix, iy };

    const dx = ix - cx;
    const dy = iy - cy;
    const norm = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    if (norm <= 1) return { ix, iy };

    return { ix: cx + dx / norm, iy: cy + dy / norm };
  }

  function isPlacementPhase() {
    return state.phase === "BUILD" || state.phase === "TURRET";
  }

  function touchAdjustmentsFor(e) {
    if (!e || e.pointerType === "mouse" || !isPlacementPhase()) return null;
    return { yOffsetPixels: -TOUCH_LIFT_TILES * CONFIG.TILE, clamp: true };
  }

  function setHoverFromClient(clientX, clientY, adj = null) {
    let { ix, iy } = mapper.clientToInternal(clientX, clientY);

    if (adj) {
      iy += adj.yOffsetPixels || 0;
      if (adj.clamp) {
        const p = projectOntoIsland(ix, iy);
        ix = p.ix;
        iy = p.iy;
      }
    }

    const { tx, ty } = internalToTile(ix, iy);

    const maxTx = Math.floor(CONFIG.INTERNAL_W / CONFIG.TILE) - 1;
    const maxTy = Math.floor(CONFIG.INTERNAL_H / CONFIG.TILE) - 1;

    if (tx < 0 || ty < 0 || tx > maxTx || ty > maxTy) {
      state.hover = { x: -1, y: -1, valid: false, cells: [] };
      return;
    }

    if (state.phase === "BUILD") build.setHover(tx, ty);
    else if (state.phase === "TURRET") turret.setHover(tx, ty);
    else state.hover = { x: -1, y: -1, valid: false, cells: [] };
  }

  // Check if turret phase should end early (all caps reached)
  const shouldEndTurretPhaseEarly = () => {
    if (state.phase !== "TURRET") return false;

    const perWaveCap =
      typeof turret?.maxTurretsThisWave === "function"
        ? turret.maxTurretsThisWave()
        : Infinity;
    if ((state.turretsPlacedThisWave || 0) >= perWaveCap) return true;

    const totalCap =
      typeof turret?.maxTotalTurretsForCourtyard === "function"
        ? turret.maxTotalTurretsForCourtyard()
        : Infinity;
    if ((state.turrets?.length || 0) >= totalCap) return true;

    return false;
  };

  // Reusable handlers (also called from on-screen buttons via main.js)
  function rotate() {
    if (state.gameOver || state.bannerActive) return;

    if (state.phase === "BUILD") {
      state.piece = rotatePiece(state.piece);
      const h = state.hover;
      if (h?.x >= 0 && h?.y >= 0) build.setHover(h.x, h.y);
      return;
    }

    if (state.phase === "TURRET") {
      state.turretDir = (state.turretDir || 0) ^ 1;
      const h = state.hover;
      if (h?.x >= 0 && h?.y >= 0) turret.setHover(h.x, h.y);
    }
  }

  function skip() {
    if (state.gameOver || state.bannerActive) return;

    if (state.phase === "BUILD") {
      // Don't allow skip without a courtyard - would cause game over
      if (!state.courtyardRegions || state.courtyardRegions.length === 0) return;
      state.timerRunning = false;
      flow.beginTurretPhase();
      return;
    }

    if (state.phase === "TURRET") {
      state.timerRunning = false;
      flow.beginCombatPhase();
    }
  }

  // --- Hold-to-place / hold-to-fire state ---------------------------------
  // Touch flow:
  //   - BUILD/TURRET: pointerdown shows preview only; pointerup commits place/erase.
  //     A second finger anywhere on the canvas while the first is held = rotate.
  //   - COMBAT: pointerdown fires once, then continues at FIRE_INTERVAL_MS until release.
  // Mouse flow keeps the original click-to-place behavior, but also supports
  // hold-to-fire in COMBAT (consistent feel across input types).
  let activePointer = null;
  let fireTimer = null;
  const FIRE_INTERVAL_MS = 220;

  function startContinuousFire() {
    if (fireTimer) return;
    fireTimer = setInterval(() => {
      if (state.gameOver || state.bannerActive || state.phase !== "COMBAT") {
        stopContinuousFire();
        return;
      }
      combat.fireTurretsAt(state.aimX, state.aimY);
    }, FIRE_INTERVAL_MS);
  }

  function stopContinuousFire() {
    if (fireTimer) {
      clearInterval(fireTimer);
      fireTimer = null;
    }
  }

  function commitPlacement(isErase) {
    if (state.gameOver || state.bannerActive) return;

    if (state.phase === "BUILD") {
      if (isErase) build.eraseAtHover();
      else build.placeAtHover();
      return;
    }

    if (state.phase === "TURRET") {
      if (isErase) turret.eraseAtAnchor();
      else turret.placeAtHover();

      if (shouldEndTurretPhaseEarly()) {
        state.timerRunning = false;
        flow.beginCombatPhase();
      }
    }
  }

  view.addEventListener("pointermove", (e) => {
    const { ix, iy } = mapper.clientToInternal(e.clientX, e.clientY);
    state.aimX = ix;
    state.aimY = iy;

    if (state.gameOver || state.bannerActive) return;

    if (isPlacementPhase()) {
      setHoverFromClient(e.clientX, e.clientY, touchAdjustmentsFor(e));
    }
  });

  view.addEventListener("contextmenu", (e) => e.preventDefault());

  view.addEventListener("pointerdown", (e) => {
    // Second finger during a placement hold → rotate (no need to release).
    if (
      activePointer &&
      activePointer.id !== e.pointerId &&
      activePointer.kind === "place"
    ) {
      e.preventDefault();
      rotate();
      return;
    }

    // Aim/hover should reflect the actual tap location even on touch
    // (touch devices don't get a pointermove before pointerdown).
    const { ix, iy } = mapper.clientToInternal(e.clientX, e.clientY);
    state.aimX = ix;
    state.aimY = iy;

    if (state.gameOver || state.bannerActive) return;

    const isTouch = e.pointerType !== "mouse";
    const isErase = e.button === 2 || (ui?.isEraseMode === true);

    if (state.phase === "COMBAT") {
      // Mouse: only respond to left button. Touch/pen: any.
      if (!isTouch && e.button !== 0) return;
      view.setPointerCapture?.(e.pointerId);
      activePointer = { id: e.pointerId, kind: "fire" };
      combat.fireTurretsAt(state.aimX, state.aimY);
      startContinuousFire();
      return;
    }

    if (isPlacementPhase()) {
      view.setPointerCapture?.(e.pointerId);
      setHoverFromClient(e.clientX, e.clientY, touchAdjustmentsFor(e));

      if (isTouch) {
        // Touch: just show preview; commit on release.
        activePointer = { id: e.pointerId, kind: "place", erase: isErase };
        return;
      }

      // Mouse: place immediately (original click-to-place feel).
      activePointer = { id: e.pointerId, kind: "press" };
      commitPlacement(isErase);
    }
  });

  view.addEventListener("pointerup", (e) => {
    if (!activePointer || activePointer.id !== e.pointerId) return;

    const ap = activePointer;
    activePointer = null;
    view.releasePointerCapture?.(e.pointerId);

    if (ap.kind === "fire") {
      stopContinuousFire();
      return;
    }

    if (ap.kind === "place") {
      // Place at the *release* tile, allowing drag-to-position.
      setHoverFromClient(e.clientX, e.clientY, touchAdjustmentsFor(e));
      const isErase = ap.erase || (ui?.isEraseMode === true);
      commitPlacement(isErase);
    }
    // "press" (mouse): already placed on pointerdown.
  });

  view.addEventListener("pointercancel", (e) => {
    if (!activePointer || activePointer.id !== e.pointerId) return;
    activePointer = null;
    stopContinuousFire();
  });

  window.addEventListener("keydown", (e) => {
    if (state.gameOver) return;
    if (state.bannerActive) return;

    const key = e.key.toLowerCase();

    // Space or Enter to skip current phase
    if (key === " " || key === "enter") {
      e.preventDefault();
      skip();
      return;
    }

    // R to rotate
    if (key === "r") {
      rotate();
    }
  });

  return { rotate, skip };
}

// ============ src/main.js ============
// src/main.js



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

// flow and input are referenced by UI callbacks, so define them before initUI
let flow = null;
let input = null;

const ui = initUI({
  onRestart: () => flow?.resetToLobby(),
  onStart: () => flow?.startGame(),
  onRotate: () => input?.rotate(),
  onSkip: () => input?.skip(),
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
input = initInput({ view, state, mapper, build, turret, combat, flow, ui });

// Resize view (CSS handles visual scaling via `width: min(940px, 100%)`)
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

})();

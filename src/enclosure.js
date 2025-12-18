import { CONFIG } from "./config.js";
import { key, insideEllipse } from "./utils.js";

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
export function recomputeCourtyards(state) {
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

import { CONFIG } from "./config.js";
import { insideEllipse, key } from "./utils.js";
import { nextPiece, getOffsets } from "./pieces.js";

export function initBuildPhase({ state, pieceRng, recomputeCourtyards, rebuildCourtyardSet }) {
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

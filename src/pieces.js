import { RNG } from "./utils.js";

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

export function getOffsets(type, rot) {
  let o = BASE[type].map(p => [...p]);
  const r = ((rot % 4) + 4) % 4;
  for (let i = 0; i < r; i++) o = rotate90(o);
  return o;
}

export function nextPiece(rng) {
  const type = TYPES[rng.int(0, TYPES.length - 1)];
  return { type, rot: 0 };
}

export function rotatePiece(piece) {
  return { ...piece, rot: (piece.rot + 1) % 4 };
}

// Convenience: create a piece RNG if you want one
export function makePieceRng(seed = (Math.random() * 1e9) | 0) {
  return new RNG(seed);
}

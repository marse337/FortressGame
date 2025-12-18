import { CONFIG } from "./config.js";

export function createState() {
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

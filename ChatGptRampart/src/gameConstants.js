// src/gameConstants.js
export const ROUND_SECONDS = 30;
export const BANNER_H = 28;
export const BANNER_SPEED = 140;

// Wave scaling (casual difficulty - survivable to wave 15+)
export function enemyCountForWave(w) { return 3 + w; }
export function enemyHealthForWave(w) { return 1 + Math.floor(w / 2); }
export function enemyShotIntervalForWave(w) { return Math.max(1.0, 2.5 - w * 0.1); }
export function enemyMoveSpeedForWave(w) { return 22 + w * 3; }
export function enemyProjectileSpeedForWave(w) { return Math.min(180, 105 + w * 5); }

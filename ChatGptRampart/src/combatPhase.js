// src/combatPhase.js
import { CONFIG } from "./config.js";
import { insideEllipse, key } from "./utils.js";
import {
  enemyCountForWave,
  enemyHealthForWave,
  enemyMoveSpeedForWave,
  enemyShotIntervalForWave,
  enemyProjectileSpeedForWave
} from "./gameConstants.js";

export function initCombatPhase({
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

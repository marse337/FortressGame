// src/input.js
import { CONFIG } from "./config.js";
import { rotatePiece } from "./pieces.js";

export function initInput({ view, state, mapper, build, turret, combat, flow, ui }) {
  function internalToTile(ix, iy) {
    return { tx: Math.floor(ix / CONFIG.TILE), ty: Math.floor(iy / CONFIG.TILE) };
  }

  function setHoverFromClient(clientX, clientY) {
    const { ix, iy } = mapper.clientToInternal(clientX, clientY);
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

  view.addEventListener("pointermove", (e) => {
    const { ix, iy } = mapper.clientToInternal(e.clientX, e.clientY);
    state.aimX = ix;
    state.aimY = iy;

    if (state.gameOver || state.bannerActive) return;

    if (state.phase === "BUILD" || state.phase === "TURRET") {
      setHoverFromClient(e.clientX, e.clientY);
    }
  });

  view.addEventListener("contextmenu", (e) => e.preventDefault());

  view.addEventListener("pointerdown", (e) => {
    // Touch devices don't get pointermove before pointerdown, so make sure
    // the aim/hover reflects the actual tap location.
    const { ix, iy } = mapper.clientToInternal(e.clientX, e.clientY);
    state.aimX = ix;
    state.aimY = iy;

    if (state.gameOver) return;
    if (state.bannerActive) return;

    if (state.phase === "COMBAT" && (e.button === 0 || e.pointerType !== "mouse")) {
      combat.fireTurretsAt(state.aimX, state.aimY);
      return;
    }

    const isErase = e.button === 2 || (ui?.isEraseMode === true);

    if (state.phase === "BUILD") {
      view.setPointerCapture?.(e.pointerId);
      setHoverFromClient(e.clientX, e.clientY);
      if (isErase) build.eraseAtHover();
      else build.placeAtHover();
      return;
    }

    if (state.phase === "TURRET") {
      view.setPointerCapture?.(e.pointerId);
      setHoverFromClient(e.clientX, e.clientY);

      if (isErase) turret.eraseAtAnchor();
      else turret.placeAtHover();

      if (shouldEndTurretPhaseEarly()) {
        state.timerRunning = false;
        flow.beginCombatPhase();
      }
    }
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

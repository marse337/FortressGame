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

    if (state.phase === "BUILD" || state.phase === "TURRET") {
      setHoverFromClient(e.clientX, e.clientY);
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

    if (state.phase === "BUILD" || state.phase === "TURRET") {
      view.setPointerCapture?.(e.pointerId);
      setHoverFromClient(e.clientX, e.clientY);

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
      setHoverFromClient(e.clientX, e.clientY);
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

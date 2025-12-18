import { BANNER_SPEED } from "./gameConstants.js";
import { CONFIG } from "./config.js";

export function startGameLoop({ state, ui, renderFrame, ctx, buf, vctx, view, mapper, flow, combat, turret }) {
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

import { ROUND_SECONDS, BANNER_H } from "./gameConstants.js";

export function initFlow({
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
    ui.setRound(state.wave);
    state.timeLeft = ROUND_SECONDS;
    ui.setTime(state.timeLeft);
    ui.setStatus(`Wave ${state.wave}: Build walls (R rotate, Space skip)`);
    startPhaseBanner("Create your fortress");
  }

  function beginTurretPhase() {
    state.phase = "TURRET";
    state.turretsPlacedThisWave = 0;

    state.timeLeft = ROUND_SECONDS;
    ui.setTime(state.timeLeft);

    // Dynamic caps based on courtyard size
    const maxThisWave = turret?.maxTurretsThisWave?.() ?? 1;
    const maxTotal = turret?.maxTotalTurretsForCourtyard?.() ?? 1;

    ui.setStatus(
      `Place up to ${maxThisWave} turrets (R rotate, Space skip). Total cap: ${maxTotal}`
    );

    startPhaseBanner("Place your turrets");
  }

  function beginCombatPhase() {
    state.phase = "COMBAT";
    state.timeLeft = ROUND_SECONDS;
    ui.setTime(state.timeLeft);
    ui.setStatus("Defend your walls (aim cursor, click to fire)");

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

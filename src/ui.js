import { ROUND_SECONDS } from "./gameConstants.js";

export function initUI({ onRestart, onStart }) {
    const btnRestart = document.getElementById("btnRestart");
    const btnStart = document.getElementById("btnStart");

    const chkGrid = document.getElementById("chkGrid");
    const chkScanlines = document.getElementById("chkScanlines");
    const chkWaves = document.getElementById("chkWaves");

    const txtTime = document.getElementById("txtTime");
    const txtRound = document.getElementById("txtRound");
    const txtStatus = document.getElementById("txtStatus");
    const timerBar = document.getElementById("timerBar");
    const timerDisplay = txtTime?.parentElement;

    const ui = {
        get grid() { return chkGrid?.checked ?? false; },
        get scanlines() { return chkScanlines?.checked ?? false; },
        get waves() { return chkWaves?.checked ?? true; },

        setTime(seconds) {
            if (txtTime) txtTime.textContent = seconds.toFixed(1);

            // Update timer bar width
            const percent = Math.max(0, (seconds / ROUND_SECONDS) * 100);
            if (timerBar) timerBar.style.width = `${percent}%`;

            // Update warning/danger states
            const isWarning = seconds <= 10 && seconds > 5;
            const isDanger = seconds <= 5;

            if (timerDisplay) {
                timerDisplay.classList.toggle("warning", isWarning);
                timerDisplay.classList.toggle("danger", isDanger);
            }
            if (timerBar) {
                timerBar.classList.toggle("warning", isWarning);
                timerBar.classList.toggle("danger", isDanger);
            }
        },

        setRound(n) {
            if (txtRound) txtRound.textContent = String(n);
        },

        setStatus(msg, isGameOver = false) {
            if (!txtStatus) return;
            txtStatus.textContent = msg || "";
            txtStatus.classList.toggle("gameover", !!isGameOver);
        },

        setStartEnabled(enabled) {
            if (btnStart) btnStart.disabled = !enabled;
        }
    };

    btnRestart?.addEventListener("click", () => onRestart?.());
    btnStart?.addEventListener("click", () => onStart?.());

    return ui;
}

// ===============================
// RUN OVERLAY – SCRIPT.JS (V1.2)
// Stops at finish + shows "Run complete"
// Green fill stays slightly behind runner back foot
// ===============================

console.log("SCRIPT LOADED");
window.onerror = (msg, src, line, col) =>
  console.log("ERROR:", msg, "line:", line, "col:", col);

// ====== CONFIG (EDIT THESE) ======
const GOAL_TIME_MINUTES = .1;   // planned run time
const START_PROGRESS = 0.0;      // 0 = start, 1 = finish
const BACK_FOOT_OFFSET_PX = 18;  // pull green line back behind runner
// ===============================

const GOAL_TIME_SECONDS = GOAL_TIME_MINUTES * 60;

const runner = document.getElementById("runner");
const trackProgress = document.getElementById("trackProgress");
const completeBadge = document.getElementById("completeBadge");

const trackEl = document.querySelector(".track");
const trackAreaEl = document.querySelector(".track-area");

const startTime = Date.now();
let completed = false;

function render(progress) {
  progress = Math.max(0, Math.min(1, progress));

  // Measure track + area FIRST
  const trackRect = trackEl.getBoundingClientRect();
  const areaRect = trackAreaEl.getBoundingClientRect();

  // Runner position: place runner at the progress point along the track
  const trackLeftPx = trackRect.left - areaRect.left;
  const x = trackLeftPx + (progress * trackRect.width);
  runner.style.left = `${x}px`;

  // Green bar: width based on track width, pulled back a bit
  const greenWidthPx = Math.max(
    0,
    progress * trackRect.width - BACK_FOOT_OFFSET_PX
  );
  trackProgress.style.width = `${greenWidthPx}px`;
}

function showComplete() {
  completeBadge.style.display = "block";
  completeBadge.style.animation = "popIn 250ms ease-out";
}

function tick() {
  if (completed) return;

  const elapsedSeconds = (Date.now() - startTime) / 1000;
  const progress = START_PROGRESS + (elapsedSeconds / GOAL_TIME_SECONDS);

  if (progress >= 1) {
    render(1);
    showComplete();
    completed = true;
    return;
  }

  render(progress);
  requestAnimationFrame(tick);
}

tick();








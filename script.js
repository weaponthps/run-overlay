// V1: fake demo numbers + simple runner movement (time-based)
// Later we'll replace with real values and SVG path positioning.

const runner = document.getElementById("runner");

// SETTINGS (edit these)
const GOAL_TIME_SECONDS = 40 * 60; // 40 minutes
const START_PROGRESS = 0.0;        // 0.0 = start, 1.0 = finish

// Internal state
const startTime = Date.now();
let paused = false;
let pausedAt = 0;
let totalPausedMs = 0;

function render(progress) {
  const leftPercent = 10 + progress * 80; // 10% to 90%
  runner.style.left = `${leftPercent}%`;
}

function tick() {
  if (!paused) {
    const elapsedMs = Date.now() - startTime - totalPausedMs;
    const elapsedSeconds = elapsedMs / 1000;

    let progress = START_PROGRESS + (elapsedSeconds / GOAL_TIME_SECONDS);
    progress = Math.max(0, Math.min(1, progress)); // clamp 0..1

    render(progress);
  }
  requestAnimationFrame(tick);
}

tick();


// Demo: animate progress slowly so you can SEE it working
setInterval(() => {
  progress += 0.05;
  if (progress > 1) progress = 0;
  render();
}, 300);


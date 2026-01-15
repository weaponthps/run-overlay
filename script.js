// ===============================
// RUN OVERLAY – SCRIPT.JS (V1)
// ===============================

// ====== CONFIG (EDIT THESE) ======
const GOAL_TIME_MINUTES = 1;   // total planned run time
const START_PROGRESS = 0.0;     // 0 = start, 1 = finish

// ===============================

// Convert goal time to seconds
const GOAL_TIME_SECONDS = GOAL_TIME_MINUTES * 60;

// Grab runner element
const runner = document.getElementById("runner");

// Internal timing state
const startTime = Date.now();

// Render function: moves runner left → right
function render(progress) {
  // Clamp progress between 0 and 1
  progress = Math.max(0, Math.min(1, progress));

  // Move runner from 10% to 90% across the overlay
  const leftPercent = 10 + progress * 80;
  runner.style.left = `${leftPercent}%`;
}

// Main animation loop
function tick() {
  const now = Date.now();
  const elapsedMs = now - startTime;
  const elapsedSeconds = elapsedMs / 1000;

  // Calculate progress based on time
  const progress = START_PROGRESS + (elapsedSeconds / GOAL_TIME_SECONDS);

  render(progress);

  // Keep animating
  requestAnimationFrame(tick);
}

// Start animation
tick();


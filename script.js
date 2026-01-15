// ===============================
// RUN OVERLAY – SCRIPT.JS (V1)
// ===============================

// ====== CONFIG (EDIT THESE) ======
const GOAL_TIME_MINUTES = 5;   // total planned run time
const START_PROGRESS = 0.0;     // 0 = start, 1 = finish

// ===============================

// Convert goal time to seconds
const GOAL_TIME_SECONDS = GOAL_TIME_MINUTES * 60;

// Grab runner element
const runner = document.getElementById("runner");
const trackProgress = document.getElementById("trackProgress");

// Internal timing state
const startTime = Date.now();

// Render function: moves runner left → right
function render(progress) {
  progress = Math.max(0, Math.min(1, progress));

  const TRACK_START_PERCENT = 0;
  const TRACK_END_PERCENT = 92;

  const leftPercent =
    TRACK_START_PERCENT +
    progress * (TRACK_END_PERCENT - TRACK_START_PERCENT);

  runner.style.left = `${leftPercent}%`;

  // Green fill matches progress (0% -> 100%)
  trackProgress.style.width = `${progress * 100}%`;
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






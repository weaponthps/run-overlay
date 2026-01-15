// ===============================
// RUN OVERLAY – SCRIPT.JS (V1.1)
// Stops at finish + shows "Run complete"
// ===============================

// ====== CONFIG (EDIT THESE) ======
const GOAL_TIME_MINUTES = .5;   // planned run time
const START_PROGRESS = 0.0;     // 0 = start, 1 = finish
// ===============================

const GOAL_TIME_SECONDS = GOAL_TIME_MINUTES * 60;

const runner = document.getElementById("runner");
const trackProgress = document.getElementById("trackProgress");
const completeBadge = document.getElementById("completeBadge");

const startTime = Date.now();
let completed = false;

// Adjust these if you tweak the track layout
const TRACK_START_PERCENT = 0;
const TRACK_END_PERCENT = 92;

const trackEl = document.querySelector(".track");
const trackAreaEl = document.querySelector(".track-area");

function render(progress) {
  progress = Math.max(0, Math.min(1, progress));

  // Fill bar is always perfect: 0% -> 100% of the track
  trackProgress.style.width = `${progress * 100}%`;

  // Now place the runner based on the actual track element position/width
  const trackRect = trackEl.getBoundingClientRect();
  const areaRect = trackAreaEl.getBoundingClientRect();

  // x position in pixels relative to the track-area
  const trackLeftPx = trackRect.left - areaRect.left;
  const x = trackLeftPx + (progress * trackRect.width);

  runner.style.left = `${x}px`;
}


function showComplete() {
  completeBadge.style.display = "block";
  completeBadge.style.animation = "popIn 250ms ease-out";
}

function tick() {
  if (completed) return; // hard stop animation loop once complete

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


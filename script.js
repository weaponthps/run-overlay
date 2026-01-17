// ===============================
// RUN OVERLAY – SCRIPT.JS (V1.3)
// Start button controls animation
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

let lastRunId = null;

console.log("SCRIPT LOADED", new Date().toISOString());
window.onerror = (msg, src, line, col) =>
  console.log("ERROR:", msg, "line:", line, "col:", col);

// ====== CONFIG (EDIT THESE) ======
let totalMiles = 4;
let goalTimeMinutes = 40;
let goalTimeSeconds = goalTimeMinutes * 60;

const START_PROGRESS = 0.0;       // 0 = start
const BACK_FOOT_OFFSET_PX = 22;   // green ends behind runner
// ===============================

const goalTimeSeconds = GOAL_TIME_MINUTES * 60;

const runner = document.getElementById("runner");
const trackProgress = document.getElementById("trackProgress");
const completeBadge = document.getElementById("completeBadge");
const startBtn = document.getElementById("startBtn");
const mileMarkersEl = document.getElementById("mileMarkers");

// ----- Firebase init -----
const firebaseConfig = {
  // paste from Firebase console
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, "runOverlay/state");

// ----- Overlay state -----
let totalMiles = 4;
let goalTimeMinutes = 40;
let goalTimeSeconds = goalTimeMinutes * 60;

let running = false;
let startTime = null;     // epoch ms (from Firebase when running)
let lastRunId = null;

// Update the static labels (distance/time)
function updatePlanUI() {
  document.getElementById("totalDistance").textContent = `${totalMiles.toFixed(1)} mi`;

  // show minutes as MM:SS style if you want; for now simple:
  document.getElementById("goalTime").textContent = `${goalTimeMinutes}:00`;
}

// Reset visuals to “ready”
function resetOverlayVisuals() {
  running = false;
  startTime = null;

  completeBadge.style.display = "none";
  trackProgress.style.width = "0px";
  render(0);

  startBtn.style.display = "block";
  startBtn.textContent = "Start";
}

// Start visuals based on Firebase start time
function startRunFromFirebase(startTimeEpochMs) {
  completeBadge.style.display = "none";
  trackProgress.style.width = "0px";

  buildMileMarkers();

  startTime = startTimeEpochMs;
  running = true;

  startBtn.style.display = "none";

  render(0);
  requestAnimationFrame(tick);
}

// Real-time listener
onValue(stateRef, (snapshot) => {
  const s = snapshot.val();
  if (!s) return;

  // 1) Apply plan updates
  const newMiles = Number(s.planMiles ?? totalMiles);
  const newMinutes = Number(s.planMinutes ?? goalTimeMinutes);

  const planChanged = (newMiles !== totalMiles) || (newMinutes !== goalTimeMinutes);
  if (planChanged) {
    totalMiles = newMiles;
    goalTimeMinutes = newMinutes;
    goalTimeSeconds = goalTimeMinutes * 60;

    updatePlanUI();
    buildMileMarkers();

    // If not running, keep runner at start
    if (!running) render(0);
  }

  // 2) Handle start/reset
  const status = String(s.status ?? "ready");
  const runId = Number(s.runId ?? 0);
  const startMs = Number(s.startTimeEpochMs ?? 0);

  if (status === "ready") {
    resetOverlayVisuals();
    lastRunId = runId;
    return;
  }

  if (status === "running") {
    // Only start if this is a new run
    if (runId !== lastRunId) {
      lastRunId = runId;
      startRunFromFirebase(startMs);
    }
  }
});

const trackEl = document.querySelector(".track");
const trackAreaEl = document.querySelector(".track-area");

// Animation state
let running = false;
let startTime = null;

function buildMileMarkers() {
  if (!mileMarkersEl) return;
  mileMarkersEl.innerHTML = "";

  const trackRect = trackEl.getBoundingClientRect();
  const areaRect = trackAreaEl.getBoundingClientRect();
  const trackLeftPx = trackRect.left - areaRect.left;

  mileMarkersEl.style.left = `${trackLeftPx}px`;
  mileMarkersEl.style.width = `${trackRect.width}px`;

  for (let mile = 1; mile <= totalMiles; mile++) {
    const ratio = mile / totalMiles;
    const xPx = ratio * trackRect.width;

    const marker = document.createElement("div");
    marker.className = "mile-marker";
    marker.dataset.mile = String(mile);
    marker.style.left = `${xPx}px`;

    marker.innerHTML = `
      <div class="tick"></div>
      <div class="label">${mile}</div>
    `;

    mileMarkersEl.appendChild(marker);
  }
}

function updateMileMarkerStates(progress) {
  const markers = document.querySelectorAll(".mile-marker");
  markers.forEach((marker) => {
    const mile = Number(marker.dataset.mile);
    const mileProgress = mile / totalMiles;

    if (progress >= mileProgress) marker.classList.add("completed");
    else marker.classList.remove("completed");
  });
}

function render(progress) {
  progress = Math.max(0, Math.min(1, progress));

  // Measure geometry
  const trackRect = trackEl.getBoundingClientRect();
  const areaRect = trackAreaEl.getBoundingClientRect();

  // Runner position
  const trackLeftPx = trackRect.left - areaRect.left;
  const x = trackLeftPx + progress * trackRect.width;
  runner.style.left = `${x}px`;

  // Green fill (behind runner)
  const greenWidthPx = Math.max(0, progress * trackRect.width - BACK_FOOT_OFFSET_PX);
  trackProgress.style.width = `${greenWidthPx}px`;

  // Mile markers completion
  updateMileMarkerStates(progress);
}

function showComplete() {
  completeBadge.style.display = "block";
  completeBadge.style.animation = "popIn 250ms ease-out";
}

function tick() {
  if (!running) return;

  const elapsedSeconds = (Date.now() - startTime) / 1000;
  const progress = elapsedSeconds / goalTimeSeconds;


  if (progress >= 1) {
    console.log("COMPLETE");
    render(1);
    showComplete();
    running = false;
    // show start button again (optional)
    startBtn.style.display = "block";
    startBtn.textContent = "Restart";
    return;
  }

  render(progress);
  requestAnimationFrame(tick);
}

function startRun() {
  console.log("START CLICKED");

  // Reset visuals
  completeBadge.style.display = "none";
  trackProgress.style.width = "0px";

  // Ensure layout is measured correctly at start time
  buildMileMarkers();

  // Start timing
  startTime = Date.now();
  running = true;

  // Hide button while running
  startBtn.style.display = "none";

  // Render first frame immediately so you SEE it start
  render(START_PROGRESS);

  requestAnimationFrame(tick);
}

// Initialize once everything is laid out
window.addEventListener("load", () => {
  console.log("WINDOW LOADED");

  buildMileMarkers();
  render(START_PROGRESS);

  startBtn.addEventListener("click", startRun);

  window.addEventListener("resize", () => {
    buildMileMarkers();
    // keep current frame stable; if running we'll re-render on next tick
    if (!running) render(START_PROGRESS);
  });
});



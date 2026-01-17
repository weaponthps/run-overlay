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

const GOAL_TIME_SECONDS = GOAL_TIME_MINUTES * 60;

const runner = document.getElementById("runner");
const trackProgress = document.getElementById("trackProgress");
const completeBadge = document.getElementById("completeBadge");
const startBtn = document.getElementById("startBtn");
const mileMarkersEl = document.getElementById("mileMarkers");

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

  for (let mile = 1; mile <= TOTAL_MILES; mile++) {
    const ratio = mile / TOTAL_MILES;
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
    const mileProgress = mile / TOTAL_MILES;

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
  const progress = START_PROGRESS + elapsedSeconds / GOAL_TIME_SECONDS;

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


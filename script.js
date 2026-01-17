// ===============================
// RUN OVERLAY – SCRIPT.JS (V2.0)
// Firebase RTDB real-time control (Apply / Start / Reset)
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

console.log("SCRIPT LOADED", new Date().toISOString());
window.onerror = (msg, src, line, col) =>
  console.log("ERROR:", msg, "line:", line, "col:", col);

// ====== FIREBASE CONFIG (PASTE YOURS HERE) ======
const firebaseConfig = {
  apiKey: "AIzaSyCl6se0G2WrDNkwh0sTEOW0uFBvx-V6cQo",
  authDomain: "run-overlay.firebaseapp.com",
  databaseURL: "https://run-overlay-default-rtdb.firebaseio.com",
  projectId: "run-overlay",
  storageBucket: "run-overlay.firebasestorage.app",
  messagingSenderId: "511176060158",
  appId: "1:511176060158:web:a1e016f482a027556449af",
  measurementId: "G-CB6KRXGDLX"
};
// ===============================================

// ====== OVERLAY CONFIG (VISUAL TUNING) ======
const START_PROGRESS = 0.0;     // 0 = start
const BACK_FOOT_OFFSET_PX = 22; // green ends behind runner
// ============================================

// ----- DOM -----
const runner = document.getElementById("runner");
const trackProgress = document.getElementById("trackProgress");
const completeBadge = document.getElementById("completeBadge");
const startBtn = document.getElementById("startBtn");
const mileMarkersEl = document.getElementById("mileMarkers");

const totalDistanceEl = document.getElementById("totalDistance");
const goalTimeEl = document.getElementById("goalTime");

const trackEl = document.querySelector(".track");
const trackAreaEl = document.querySelector(".track-area");

// ----- Firebase init -----
if (!firebaseConfig || !firebaseConfig.projectId) {
  console.log("Firebase config missing. Paste firebaseConfig into script.js.");
}

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, "runOverlay/state");

// ----- Run Plan + State (driven by Firebase) -----
let totalMiles = 4;
let goalTimeMinutes = 40;
let goalTimeSeconds = goalTimeMinutes * 60;

let running = false;
let startTimeEpochMs = 0; // from Firebase when running
let lastRunId = null;

// ----- Helpers -----
function formatGoalTime(minutes) {
  // V1: show "MM:00" (you can upgrade to mm:ss later)
  const m = Math.max(0, Math.floor(minutes));
  return `${m}:00`;
}

function updatePlanUI() {
  if (totalDistanceEl) totalDistanceEl.textContent = `${totalMiles.toFixed(1)} mi`;
  if (goalTimeEl) goalTimeEl.textContent = formatGoalTime(goalTimeMinutes);
}

function buildMileMarkers() {
  if (!mileMarkersEl) return;
  mileMarkersEl.innerHTML = "";

  const trackRect = trackEl.getBoundingClientRect();
  const areaRect = trackAreaEl.getBoundingClientRect();
  const trackLeftPx = trackRect.left - areaRect.left;

  mileMarkersEl.style.left = `${trackLeftPx}px`;
  mileMarkersEl.style.width = `${trackRect.width}px`;

  const milesInt = Math.max(1, Math.round(totalMiles));

  for (let mile = 1; mile <= milesInt; mile++) {
    const ratio = mile / milesInt;
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
  const milesInt = Math.max(1, Math.round(totalMiles));

  markers.forEach((marker) => {
    const mile = Number(marker.dataset.mile);
    const mileProgress = mile / milesInt;

    if (progress >= mileProgress) marker.classList.add("completed");
    else marker.classList.remove("completed");
  });
}

function render(progress) {
  progress = Math.max(0, Math.min(1, progress));

  const trackRect = trackEl.getBoundingClientRect();
  const areaRect = trackAreaEl.getBoundingClientRect();

  // Runner position
  const trackLeftPx = trackRect.left - areaRect.left;
  const x = trackLeftPx + progress * trackRect.width;
  runner.style.left = `${x}px`;

  // Green fill ends behind runner
  const greenWidthPx = Math.max(0, progress * trackRect.width - BACK_FOOT_OFFSET_PX);
  trackProgress.style.width = `${greenWidthPx}px`;

  updateMileMarkerStates(progress);
}

function showComplete() {
  completeBadge.style.display = "block";
  completeBadge.style.animation = "popIn 250ms ease-out";
}

function resetOverlayVisuals() {
  running = false;
  startTimeEpochMs = 0;

  completeBadge.style.display = "none";
  trackProgress.style.width = "0px";

  // Put runner at start
  render(START_PROGRESS);

  // Show Start button locally (optional)
  if (startBtn) {
    startBtn.style.display = "block";
    startBtn.textContent = "Start";
  }
}

function startRunLocallyFrom(startMs) {
  // Reset visuals for a clean run
  completeBadge.style.display = "none";
  trackProgress.style.width = "0px";

  buildMileMarkers();

  startTimeEpochMs = startMs;
  running = true;

  // Hide Start button while running
  if (startBtn) startBtn.style.display = "none";

  // Render first frame
  render(START_PROGRESS);

  requestAnimationFrame(tick);
}

function tick() {
  if (!running) return;

  const elapsedSeconds = (Date.now() - startTimeEpochMs) / 1000;
  const progress = START_PROGRESS + elapsedSeconds / goalTimeSeconds;

  if (progress >= 1) {
    render(1);
    showComplete();
    running = false;

    // Optional: show button again locally
    if (startBtn) {
      startBtn.style.display = "block";
      startBtn.textContent = "Restart";
    }
    return;
  }

  render(progress);
  requestAnimationFrame(tick);
}

// ----- Firebase listener -----
function attachFirebaseListener() {
  onValue(stateRef, (snapshot) => {
    const s = snapshot.val();
    console.log("FIREBASE STATE:", s);
    if (!s) return;

    // Plan updates
    const newMiles = Number(s.planMiles ?? totalMiles);
    const newMinutes = Number(s.planMinutes ?? goalTimeMinutes);

    const planChanged = newMiles !== totalMiles || newMinutes !== goalTimeMinutes;
    if (planChanged) {
      totalMiles = Math.max(1, newMiles);
      goalTimeMinutes = Math.max(1, newMinutes);
      goalTimeSeconds = goalTimeMinutes * 60;

      updatePlanUI();
      buildMileMarkers();

      if (!running) render(START_PROGRESS);
    }

    // State transitions
    const status = String(s.status ?? "ready");
    const runId = Number(s.runId ?? 0);
    const startMs = Number(s.startTimeEpochMs ?? 0);

    if (status === "ready") {
      resetOverlayVisuals();
      lastRunId = runId;
      return;
    }

    if (status === "running") {
      // Only start if this is a new run, OR we aren't already running
      if (runId !== lastRunId || !running) {
        lastRunId = runId;
        if (startMs > 0) startRunLocallyFrom(startMs);
      }
    }
  });
}

// ----- Local Start button writes to Firebase -----
async function writeStartToFirebase() {
  const now = Date.now();
  const nextRunId = (lastRunId ?? 0) + 1;

  await update(stateRef, {
    status: "running",
    startTimeEpochMs: now,
    runId: nextRunId,
    updatedAtEpochMs: now,
  });
}

async function writeResetToFirebase() {
  const now = Date.now();
  await update(stateRef, {
    status: "ready",
    startTimeEpochMs: 0,
    updatedAtEpochMs: now,
  });
}

// ----- Initialize -----
window.addEventListener("load", () => {
  console.log("WINDOW LOADED");

  // Initial UI
  updatePlanUI();
  buildMileMarkers();
  render(START_PROGRESS);

  // Listen to Firebase
  console.log("ATTACHING FIREBASE LISTENER NOW");
  attachFirebaseListener();

  // Local button behavior (writes to Firebase so overlay + TikTok stay consistent)
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      console.log("START CLICKED (writing to Firebase)");
      writeStartToFirebase().catch((e) => console.log("Start write failed:", e));
    });
  }

  // Optional: simple keyboard reset for local testing (R key)
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "r") {
      writeResetToFirebase().catch((err) => console.log("Reset failed:", err));
    }
  });

  // Rebuild markers on resize
  window.addEventListener("resize", () => {
    buildMileMarkers();
    if (!running) render(START_PROGRESS);
  });
});



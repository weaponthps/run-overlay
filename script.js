// ===============================
// RUN OVERLAY – SCRIPT.JS (V2.1 CLEAN)
// Firebase RTDB real-time control (Apply / Start / Reset)
// + Mile markers support 0.1 .. 26 miles
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

console.log("SCRIPT LOADED", new Date().toISOString());
window.onerror = (msg, src, line, col) =>
  console.log("ERROR:", msg, "line:", line, "col:", col);

// ====== FIREBASE CONFIG ======
const firebaseConfig = {
  apiKey: "AIzaSyCl6se0G2WrDNkwh0sTEOW0uFBvx-V6cQo",
  authDomain: "run-overlay.firebaseapp.com",
  databaseURL: "https://run-overlay-default-rtdb.firebaseio.com",
  projectId: "run-overlay",
  storageBucket: "run-overlay.firebasestorage.app",
  messagingSenderId: "511176060158",
  appId: "1:511176060158:web:a1e016f482a027556449af",
  measurementId: "G-CB6KRXGDLX",
};

// ====== VISUAL TUNING ======
const START_PROGRESS = 0.0;      // 0 = start
const BACK_FOOT_OFFSET_PX = 22;  // green ends behind runner

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
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, "runOverlay/state");

console.log("FIREBASE INIT OK. DB:", firebaseConfig.databaseURL);
console.log("LISTENING TO PATH: runOverlay/state");

// ----- Run Plan + State (from Firebase) -----
let totalMiles = 3.0;        // default until Firebase arrives
let goalTimeMinutes = 30;    // default until Firebase arrives
let goalTimeSeconds = goalTimeMinutes * 60;

let running = false;
let startTimeEpochMs = 0;
let lastRunId = null;

// ---------- Helpers ----------
function formatGoalTime(minutes) {
  const m = Math.max(0, Math.floor(minutes));
  return `${m}:00`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function updatePlanUI() {
  if (totalDistanceEl) totalDistanceEl.textContent = `${Number(totalMiles).toFixed(1)} mi`;
  if (goalTimeEl) goalTimeEl.textContent = formatGoalTime(goalTimeMinutes);
}

// Mile marker strategy:
// - < 1 mi : 0.1 ticks
// - 1–10  : 1 mi ticks
// - > 10  : 5 mi ticks (up to 26)
function getMarkerSpec(miles) {
  if (miles < 1) return { step: 0.1, maxLabel: miles };
  if (miles <= 10) return { step: 1, maxLabel: Math.floor(miles) };
  return { step: 5, maxLabel: Math.floor(miles / 5) * 5 };
}

function buildMileMarkers() {
  if (!mileMarkersEl || !trackEl || !trackAreaEl) return;

  mileMarkersEl.innerHTML = "";

  const trackRect = trackEl.getBoundingClientRect();
  const areaRect = trackAreaEl.getBoundingClientRect();
  const trackLeftPx = trackRect.left - areaRect.left;

  mileMarkersEl.style.left = `${trackLeftPx}px`;
  mileMarkersEl.style.width = `${trackRect.width}px`;

  const miles = clamp(Number(totalMiles) || 0.1, 0.1, 26);
  const { step, maxLabel } = getMarkerSpec(miles);

  // Build ticks: step, step*2, ... up to maxLabel (never include 0)
  for (let label = step; label <= maxLabel + 1e-9; label += step) {
    const ratio = clamp(label / miles, 0, 1);
    const xPx = ratio * trackRect.width;

    const marker = document.createElement("div");
    marker.className = "mile-marker";
    marker.dataset.mile = String(label);
    marker.style.left = `${xPx}px`;

    const labelText = step < 1 ? label.toFixed(1) : String(Math.round(label));

    marker.innerHTML = `
      <div class="tick"></div>
      <div class="label">${labelText}</div>
    `;

    mileMarkersEl.appendChild(marker);
  }
}

function updateMileMarkerStates(progress) {
  const miles = clamp(Number(totalMiles) || 0.1, 0.1, 26);
  const markers = document.querySelectorAll(".mile-marker");

  markers.forEach((marker) => {
    const labelMiles = Number(marker.dataset.mile);
    const mileProgress = clamp(labelMiles / miles, 0, 1);

    if (progress >= mileProgress) marker.classList.add("completed");
    else marker.classList.remove("completed");
  });
}

function render(progress) {
  progress = clamp(progress, 0, 1);

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

  buildMileMarkers();
  render(START_PROGRESS);

  if (startBtn) {
    startBtn.style.display = "block";
    startBtn.textContent = "Start";
  }
}

function startRunLocallyFrom(startMs) {
  completeBadge.style.display = "none";
  trackProgress.style.width = "0px";

  buildMileMarkers();

  startTimeEpochMs = startMs;
  running = true;

  if (startBtn) startBtn.style.display = "none";

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
  onValue(
    stateRef,
    (snapshot) => {
      const s = snapshot.val();
      console.log("FIREBASE STATE:", s);

      if (!s) return;

      const newMiles = clamp(Number(s.planMiles ?? totalMiles), 0.1, 26);
      const newMinutes = Math.max(1, Number(s.planMinutes ?? goalTimeMinutes));

      const planChanged = newMiles !== totalMiles || newMinutes !== goalTimeMinutes;
      if (planChanged) {
        totalMiles = newMiles;
        goalTimeMinutes = newMinutes;
        goalTimeSeconds = goalTimeMinutes * 60;

        updatePlanUI();
        buildMileMarkers();

        if (!running) render(START_PROGRESS);
      }

      const status = String(s.status ?? "ready");
      const runId = Number(s.runId ?? 0);
      const startMs = Number(s.startTimeEpochMs ?? 0);

      if (status === "ready") {
        resetOverlayVisuals();
        lastRunId = runId;
        return;
      }

      if (status === "running") {
        if (runId !== lastRunId || !running) {
          lastRunId = runId;
          if (startMs > 0) startRunLocallyFrom(startMs);
        }
      }
    },
    (error) => {
      console.log("FIREBASE onValue ERROR:", error);
    }
  );
}

// ----- Writes -----
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

  updatePlanUI();
  buildMileMarkers();
  render(START_PROGRESS);

  console.log("ATTACHING FIREBASE LISTENER NOW");
  attachFirebaseListener();

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      console.log("START CLICKED (writing to Firebase)");
      writeStartToFirebase().catch((e) => console.log("Start write failed:", e));
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "r") {
      writeResetToFirebase().catch((err) => console.log("Reset failed:", err));
    }
  });

  window.addEventListener("resize", () => {
    buildMileMarkers();
    if (!running) render(START_PROGRESS);
  });
});

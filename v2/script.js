import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

// ✅ Paste your existing Firebase config here (same as V1)
const firebaseConfig = {
  apiKey: "PASTE_YOURS",
  authDomain: "PASTE_YOURS",
  databaseURL: "PASTE_YOURS",
  projectId: "PASTE_YOURS",
  storageBucket: "PASTE_YOURS",
  messagingSenderId: "PASTE_YOURS",
  appId: "PASTE_YOURS",
  measurementId: "PASTE_YOURS",
};

const PATH = "runOverlayV2/state";

// --- overlay tuning ---
const BACK_FOOT_OFFSET_PX = 22;
const TRACK_VISUAL_MAX_MILES = 1.0; // runner traverses full bar every 1 mile (loops visually)
const CHECKPOINT_EVERY_MS = 10_000;

// calories model (simple baseline; we can incorporate incline later)
const BODY_WEIGHT_LB = 160;
const CAL_PER_LB_PER_MILE = 0.63; // ~100.8 cal/mi at 160lb

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, PATH);

// DOM
const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const speedEl = $("speed");
const inclineEl = $("incline");
const distanceEl = $("distance");
const paceEl = $("pace");
const caloriesEl = $("calories");
const runnerEl = $("runner");
const trackProgressEl = $("trackProgress");

const trackEl = document.querySelector(".track");
const trackAreaEl = document.querySelector(".track-area");

// Firebase-driven inputs + persisted checkpoint
let status = "ready";
let speedMph = 3.0;
let inclinePct = 0.0;

let distanceCheckpoint = 0;
let caloriesCheckpoint = 0;
let checkpointEpochMs = 0;

// Local live accumulation
let running = false;
let distanceLive = 0;
let caloriesLive = 0;

let lastFrameMs = 0;
let lastCheckpointWriteMs = 0;

// Helpers
function fmtMph(n){ return `${Number(n||0).toFixed(1)} mph`; }
function fmtIncline(n){ return `${Number(n||0).toFixed(1)}%`; }
function fmtMiles(n){ return `${Number(n||0).toFixed(2)} mi`; }

function fmtPaceFromMph(mph){
  mph = Number(mph || 0);
  if (mph <= 0.05) return `--`;
  const minutesPerMile = 60 / mph;
  const m = Math.floor(minutesPerMile);
  const s = Math.round((minutesPerMile - m) * 60);
  const ss = String(s).padStart(2, "0");
  return `${m}:${ss} min/mi`;
}

function calcCaloriesFromMiles(miles){
  const total = BODY_WEIGHT_LB * miles * CAL_PER_LB_PER_MILE;
  return Math.round(total);
}

function updateHud(){
  if (statusEl) statusEl.textContent = status;
  if (speedEl) speedEl.textContent = fmtMph(speedMph);
  if (inclineEl) inclineEl.textContent = fmtIncline(inclinePct);
  if (distanceEl) distanceEl.textContent = fmtMiles(distanceLive);
  if (paceEl) paceEl.textContent = fmtPaceFromMph(speedMph);
  if (caloriesEl) caloriesEl.textContent = `${caloriesLive} cal`;
}

function renderTrack(){
  // Visual loop: show progress across the bar every TRACK_VISUAL_MAX_MILES miles
  const loopMiles = Math.max(0.1, TRACK_VISUAL_MAX_MILES);
  const loopProgress = (distanceLive % loopMiles) / loopMiles; // 0..1

  const trackRect = trackEl.getBoundingClientRect();
  const areaRect = trackAreaEl.getBoundingClientRect();

  const trackLeftPx = trackRect.left - areaRect.left;
  const x = trackLeftPx + loopProgress * trackRect.width;
  runnerEl.style.left = `${x}px`;

  const greenWidthPx = Math.max(0, loopProgress * trackRect.width - BACK_FOOT_OFFSET_PX);
  trackProgressEl.style.width = `${greenWidthPx}px`;
}

async function writeCheckpoint(){
  const now = Date.now();
  await update(stateRef, {
    distanceMilesCheckpoint: distanceLive,
    caloriesCheckpoint: caloriesLive,
    checkpointEpochMs: now,
    updatedAtEpochMs: now
  });
  lastCheckpointWriteMs = now;
}

function startLocalFromCheckpoint(){
  // base the live values off the last persisted checkpoint
  distanceLive = Number(distanceCheckpoint || 0);
  caloriesLive = Number(caloriesCheckpoint || 0);

  running = (status === "running");
  lastFrameMs = performance.now();
  updateHud();
  renderTrack();
}

function tick(nowMs){
  if (!running){
    // still render (so speed changes show)
    updateHud();
    renderTrack();
    requestAnimationFrame(tick);
    return;
  }

  const dtSec = (nowMs - lastFrameMs) / 1000;
  lastFrameMs = nowMs;

  // integrate distance
  const milesPerSec = (Number(speedMph || 0) / 3600);
  distanceLive += milesPerSec * dtSec;

  // calories derived from distance (baseline)
  caloriesLive = calcCaloriesFromMiles(distanceLive);

  updateHud();
  renderTrack();

  // periodic checkpoint write
  const wallNow = Date.now();
  if (wallNow - lastCheckpointWriteMs > CHECKPOINT_EVERY_MS) {
    writeCheckpoint().catch(()=>{ /* ignore transient errors */ });
  }

  requestAnimationFrame(tick);
}

// Firebase listener
onValue(stateRef, (snap) => {
  const s = snap.val();
  if (!s) return;

  status = String(s.status ?? "ready");
  speedMph = Number(s.speedMph ?? speedMph);
  inclinePct = Number(s.inclinePct ?? inclinePct);

  distanceCheckpoint = Number(s.distanceMilesCheckpoint ?? distanceCheckpoint);
  caloriesCheckpoint = Number(s.caloriesCheckpoint ?? caloriesCheckpoint);
  checkpointEpochMs = Number(s.checkpointEpochMs ?? checkpointEpochMs);

  const shouldRun = (status === "running");
  const statusChanged = (shouldRun !== running);

  // If we just transitioned into running, initialize local values from checkpoint.
  // If we transitioned to ready, stop locally but keep live totals visible.
  if (statusChanged) {
    running = shouldRun;
    if (running) {
      startLocalFromCheckpoint();
    } else {
      // stop: keep current totals but stop integrating
      updateHud();
      renderTrack();
    }
  } else {
    // same status; update HUD (speed/incline changes show immediately)
    updateHud();
  }
}, (err) => {
  console.log("Firebase listener error:", err?.message || err);
});

// Kick off initial render loop
window.addEventListener("load", () => {
  updateHud();
  renderTrack();
  requestAnimationFrame(tick);

  window.addEventListener("resize", () => renderTrack());
});

// Run Overlay V2 — Dashboard overlay
// Firebase RTDB: runOverlayV2/state

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

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

const WEIGHT_LB = 160;

// Calories per mile rule-of-thumb for running/walking:
// ~0.63 * bodyweight (lb) per mile
const CAL_PER_MILE = 0.63 * WEIGHT_LB; // 100.8 cal/mi at 160 lb

let liveSpeedMph = 0;     // updated from Firebase
let liveInclinePct = 0;   // updated from Firebase

let running = false;
let startEpochMs = 0;
let pausedTotalMs = 0;
let pauseStartedMs = 0;

let rafId = null;

function getElapsedSeconds() {
  if (!startEpochMs) return 0;

  const now = Date.now();

  // if paused, don't count time since pause started
  const pauseExtra = pauseStartedMs ? (now - pauseStartedMs) : 0;

  const activeMs = (now - startEpochMs) - pausedTotalMs - pauseExtra;
  return Math.max(0, activeMs / 1000);
}

// very simple incline multiplier (keeps things reasonable)
function inclineFactor(pct) {
  // 0% => 1.00
  // 10% => 1.30  (noticeable but not insane)
  return 1 + (Math.max(0, pct) * 0.03);
}

function computeDistanceMiles(elapsedSec, mph) {
  return (mph * elapsedSec) / 3600;
}

function computeCalories(distanceMi, inclinePct) {
  return distanceMi * CAL_PER_MILE * inclineFactor(inclinePct);
}

function tickLive() {
  if (!running) return;

  const elapsedSec = getElapsedSeconds();

  const distMi = computeDistanceMiles(elapsedSec, liveSpeedMph);
  const cals = computeCalories(distMi, liveInclinePct);

  // Update whatever you display:
  const distEl = document.getElementById("distNum"); // if you have it
  if (distEl) distEl.textContent = distMi.toFixed(2);

  if (calNumEl) calNumEl.textContent = String(Math.round(cals));

  // If you have the auto-fit function:
  if (calNumEl && calBox) fitNumberToBox(calNumEl, calBox, { max: 190, min: 80 });

  rafId = requestAnimationFrame(tickLive);
}

// --- Model assumptions (you can tweak later) ---
const USER_WEIGHT_LB = 160; // you asked to assume this
// Calories model: very simple and stable for streaming:
// ~100 cal per mile at 160 lb, with incline multiplier.
function caloriesPerMile(inclinePct){
  // multiplier nudges calories up with incline.
  // 0% => 1.00x, 5% => 1.25x, 10% => 1.50x
  const m = 1 + (Math.max(0, inclinePct) * 0.05);
  // base at 160lb
  const base = 100;
  return base * m * (USER_WEIGHT_LB / 160);
}

// --- DOM ---
const timeEl = document.getElementById("timeElapsed");
const speedEl = document.getElementById("speed");
const inclineEl = document.getElementById("incline");
const calEl = document.getElementById("calories");
const statusPill = document.getElementById("statusPill");
const debugEl = document.getElementById("debug");

const speedBox = document.getElementById("speedBox");
const inclineBox = document.getElementById("inclineBox");
const calBox = document.getElementById("calBox");

const speedNumEl = document.getElementById("speedNum");
const inclineNumEl = document.getElementById("inclineNum");
const calNumEl = document.getElementById("calNum");

const speedMeterFill = document.getElementById("speedMeterFill");
const inclineMeterFill = document.getElementById("inclineMeterFill");

// ========= STREAM UX HELPERS =========

// Auto-fit the number to its container width (no libraries)
function fitNumberToBox(numEl, boxEl, { max = 180, min = 70 } = {}) {
  if (!numEl || !boxEl) return;

  // Temporarily set to max and shrink until it fits
  let size = max;
  numEl.style.fontSize = size + "px";

  // Allow a bit of padding so it doesn't kiss the edges
  const targetWidth = boxEl.clientWidth * 0.60; // 60% because emoji takes space
  const maxIters = 40;

  let i = 0;
  while (i < maxIters && numEl.scrollWidth > targetWidth && size > min) {
    size -= 3;
    numEl.style.fontSize = size + "px";
    i++;
  }
}

// Flash glow on value change
function popChanged(el) {
  if (!el) return;
  el.classList.remove("changed");
  // force reflow so animation re-triggers
  void el.offsetWidth;
  el.classList.add("changed");
}

// Speed zone logic (mph)
function setSpeedZone(speedBox, mph) {
  if (!speedBox) return;

  speedBox.classList.remove("zone-walk", "zone-jog", "zone-run", "zone-sprint");

  if (mph < 3.0) speedBox.classList.add("zone-walk");
  else if (mph < 5.0) speedBox.classList.add("zone-jog");
  else if (mph < 7.5) speedBox.classList.add("zone-run");
  else speedBox.classList.add("zone-sprint");
}

// Meter helper (0..1)
function setMeter(fillEl, ratio01) {
  if (!fillEl) return;
  const r = Math.max(0, Math.min(1, ratio01));
  fillEl.style.width = (r * 100).toFixed(1) + "%";
}

// --- Firebase init ---
console.log("V2 OVERLAY script.js LOADED", new Date().toISOString());
window.onerror = (msg, src, line, col) => console.log("ERROR:", msg, "line:", line, "col:", col);

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, "runOverlayV2/state");

// --- Local state (authoritative totals live here, persisted occasionally) ---
let status = "ready";         // ready | running | paused
let speedMph = 0;
let inclinePct = 0;

let elapsedMs = 0;            // total elapsed time while running
let distanceMi = 0;           // accumulated
let calories = 0;             // accumulated

let lastTickMs = 0;           // local ticking reference
let lastPersistMs = 0;        // throttled writes back to Firebase

function fmtMMSS(ms){
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function setStatusPill(s){
  if (!statusPill) return;
  statusPill.textContent = s.toUpperCase();
}

function render(){
  if (timeEl) timeEl.textContent = fmtMMSS(elapsedMs);
  if (speedEl) speedEl.textContent = Number(speedMph).toFixed(1);
  if (inclineEl) inclineEl.textContent = Number(inclinePct).toFixed(1);
  if (calEl) calEl.textContent = String(Math.round(calories));
  setStatusPill(status);
}

function tick(nowMs){
  requestAnimationFrame(tick);

  if (status !== "running") {
    lastTickMs = nowMs;
    return;
  }

  if (!lastTickMs) lastTickMs = nowMs;
  const dtMs = Math.max(0, nowMs - lastTickMs);
  lastTickMs = nowMs;

  // integrate time
  elapsedMs += dtMs;

  // integrate distance (mph -> miles per ms)
  const milesThisTick = (speedMph * (dtMs / 3600000)); // 3,600,000 ms per hour
  distanceMi += milesThisTick;

  // integrate calories
  const cpm = caloriesPerMile(inclinePct);
  calories += milesThisTick * cpm;

  render();

  // persist totals back to Firebase every ~2 seconds while running
  if (!lastPersistMs) lastPersistMs = nowMs;
  if (nowMs - lastPersistMs >= 2000) {
    lastPersistMs = nowMs;
    const payload = {
      // checkpoint data (for control panel display)
      checkpoint: {
        elapsedMs: Math.round(elapsedMs),
        distanceMi: Number(distanceMi.toFixed(4)),
        calories: Number(calories.toFixed(2)),
        atEpochMs: Date.now()
      }
    };
    update(stateRef, payload).catch(e => console.log("Persist failed:", e));
  }
}

// Listen to control state
onValue(stateRef, (snap) => {
  const s = snap.val();
  console.log("OVERLAY V2 STATE:", s);

  if (!s) {
    // If no state exists yet, create a default record once.
    update(stateRef, {
      status: "ready",
      speedMph: 0,
      inclinePct: 0,
      checkpoint: { elapsedMs: 0, distanceMi: 0, calories: 0, atEpochMs: Date.now() }
    }).catch(()=>{});
    return;
  }

  liveSpeedMph = Number(s.speedMph ?? 0);
liveInclinePct = Number(s.inclinePct ?? 0);

const status = String(s.status ?? "stopped");

// Start
if (status === "running" && !running) {
  running = true;

  // If you store a start time in Firebase, use it:
  startEpochMs = Number(s.startEpochMs ?? Date.now());

  pausedTotalMs = 0;
  pauseStartedMs = 0;

  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tickLive);
}

// Pause
if (status === "paused" && running && !pauseStartedMs) {
  pauseStartedMs = Date.now();
}

// Resume
if (status === "running" && running && pauseStartedMs) {
  pausedTotalMs += (Date.now() - pauseStartedMs);
  pauseStartedMs = 0;
}

// Stop/Reset
if ((status === "stopped" || status === "ready") && running) {
  running = false;
  cancelAnimationFrame(rafId);
  rafId = null;
}
  
  // Read control values
  status = String(s.status ?? "ready");
  speedMph = Number(s.speedMph ?? 0);
  inclinePct = Number(s.inclinePct ?? 0);

  // If overlay gets reset command, zero out totals locally
  if (s.command === "reset") {
    elapsedMs = 0;
    distanceMi = 0;
    calories = 0;
    lastTickMs = 0;
    lastPersistMs = 0;

    // acknowledge reset so it doesn't re-trigger
    update(stateRef, { command: "" }).catch(()=>{});
  }

  // If the overlay is paused/resumed, do not “jump” dt
  if (status !== "running") {
    lastTickMs = 0;
  }

  if (debugEl) {
    debugEl.textContent = `speed=${speedMph.toFixed(1)} incline=${inclinePct.toFixed(1)} dist=${distanceMi.toFixed(2)}mi`;
  }

  // Example: called when new state arrives from Firebase
function applyStateToUI(state) {
  // Pull values (adjust names to your RTDB schema)
  const mph = Number(state.speedMph ?? 0);
  const incline = Number(state.inclinePct ?? 0);
  const cal = Number(state.calories ?? 0);

  // SPEED
  if (speedNumEl) {
    const next = mph.toFixed(1);
    if (speedNumEl.textContent !== next) popChanged(speedBox);
    speedNumEl.textContent = next;
    fitNumberToBox(speedNumEl, speedBox);
    setSpeedZone(speedBox, mph);
    setMeter(speedMeterFill, Math.min(1, mph / 10)); // assumes 0–10mph typical
  }

  // INCLINE
  if (inclineNumEl) {
    const next = incline.toFixed(1);
    if (inclineNumEl.textContent !== next) popChanged(inclineBox);
    inclineNumEl.textContent = next;
    fitNumberToBox(inclineNumEl, inclineBox);
    setMeter(inclineMeterFill, Math.min(1, incline / 15)); // assumes 0–15%
  }

  // CALORIES
  if (calNumEl) {
    const next = String(Math.round(cal));
    if (calNumEl.textContent !== next) popChanged(calBox);
    calNumEl.textContent = next;
    fitNumberToBox(calNumEl, calBox, { max: 190, min: 80 });
  }
}

applyStateToUI(s);
  
  render();
}, (err) => console.log("onValue error:", err));

// start animation loop
render();
requestAnimationFrame(tick);

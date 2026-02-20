// Run Overlay V2 — Dashboard overlay
// Firebase RTDB path: runOverlayV2/state

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

/* ============================
   FIREBASE CONFIG
============================ */
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

/* ============================
   MODEL ASSUMPTIONS
============================ */
// calories model tuned for streaming stability
// base ~100 cal/mi @ 160lb, with incline multiplier
const USER_WEIGHT_LB = 160;
const BASE_CAL_PER_MILE_AT_160 = 100;

function caloriesPerMile(inclinePct) {
  // 0% => 1.00x, 5% => 1.25x, 10% => 1.50x
  const inclineMult = 1 + (Math.max(0, inclinePct) * 0.05);
  const weightMult = USER_WEIGHT_LB / 160;
  return BASE_CAL_PER_MILE_AT_160 * inclineMult * weightMult;
}

/* ============================
   DOM
============================ */
const timeEl = document.getElementById("timeElapsed");

const speedBox = document.getElementById("speedBox");
const inclineBox = document.getElementById("inclineBox");
const calBox = document.getElementById("calBox");

const speedNumEl = document.getElementById("speedNum");
const inclineNumEl = document.getElementById("inclineNum");
const calNumEl = document.getElementById("calNum");

const speedMeterFill = document.getElementById("speedMeterFill");
const inclineMeterFill = document.getElementById("inclineMeterFill");

const statusPill = document.getElementById("statusPill");
const debugEl = document.getElementById("debug");

console.log("V2 OVERLAY script.js LOADED", new Date().toISOString());
console.log("DOM CHECK:", {
  timeEl: !!timeEl,
  speedNumEl: !!speedNumEl,
  inclineNumEl: !!inclineNumEl,
  calNumEl: !!calNumEl,
  speedBox: !!speedBox,
  inclineBox: !!inclineBox,
  calBox: !!calBox
});

window.onerror = (msg, src, line, col) =>
  console.log("ERROR:", msg, "line:", line, "col:", col);

/* ============================
   UX HELPERS
============================ */
function fitNumberToBox(numEl, boxEl, { max = 180, min = 70, targetPct = 0.62 } = {}) {
  if (!numEl || !boxEl) return;

  let size = max;
  numEl.style.fontSize = size + "px";

  const targetWidth = boxEl.clientWidth * targetPct; // leave room for emoji
  const maxIters = 60;

  let i = 0;
  while (i < maxIters && numEl.scrollWidth > targetWidth && size > min) {
    size -= 3;
    numEl.style.fontSize = size + "px";
    i++;
  }
}

function popChanged(el) {
  if (!el) return;
  el.classList.remove("changed");
  void el.offsetWidth;
  el.classList.add("changed");
}

function setSpeedZone(boxEl, mph) {
  if (!boxEl) return;
  boxEl.classList.remove("zone-walk", "zone-jog", "zone-run", "zone-sprint");

  if (mph < 3.0) boxEl.classList.add("zone-walk");
  else if (mph < 5.0) boxEl.classList.add("zone-jog");
  else if (mph < 7.5) boxEl.classList.add("zone-run");
  else boxEl.classList.add("zone-sprint");
}

function setMeter(fillEl, ratio01) {
  if (!fillEl) return;
  const r = Math.max(0, Math.min(1, ratio01));
  fillEl.style.width = (r * 100).toFixed(1) + "%";
}

function fmtMMSS(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function setStatusPillText(s) {
  if (!statusPill) return;
  statusPill.textContent = String(s || "--").toUpperCase();
}

/* ============================
   FIREBASE INIT
============================ */
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, "runOverlayV2/state");

/* ============================
   LOCAL STATE (authoritative totals)
============================ */
let status = "ready"; // ready | running | paused
let speedMph = 0;
let inclinePct = 0;

let elapsedMs = 0;
let distanceMi = 0;
let calories = 0;

let lastTickMs = 0;
let lastPersistMs = 0;

/* ============================
   RENDER UI
============================ */
function renderUI() {
  if (timeEl) timeEl.textContent = fmtMMSS(elapsedMs);

  // SPEED
  if (speedNumEl) {
    const next = Number(speedMph).toFixed(1);
    if (speedNumEl.textContent !== next) popChanged(speedBox);
    speedNumEl.textContent = next;
    fitNumberToBox(speedNumEl, speedBox, { max: 210, min: 90 });
    setSpeedZone(speedBox, Number(speedMph));
    setMeter(speedMeterFill, Math.min(1, Number(speedMph) / 10));
  }

  // INCLINE
  if (inclineNumEl) {
    const next = Number(inclinePct).toFixed(1);
    if (inclineNumEl.textContent !== next) popChanged(inclineBox);
    inclineNumEl.textContent = next;
    fitNumberToBox(inclineNumEl, inclineBox, { max: 210, min: 90, targetPct: 0.70 });
    setMeter(inclineMeterFill, Math.min(1, Number(inclinePct) / 15));
  }

  // CALORIES
  if (calNumEl) {
    const next = String(Math.round(calories));
    if (calNumEl.textContent !== next) popChanged(calBox);
    calNumEl.textContent = next;
    fitNumberToBox(calNumEl, calBox, { max: 220, min: 90, targetPct: 0.62 });
  }

  setStatusPillText(status);

  if (debugEl) {
    debugEl.textContent = `speed=${Number(speedMph).toFixed(1)} incline=${Number(inclinePct).toFixed(
      1
    )} dist=${distanceMi.toFixed(2)}mi cal=${Math.round(calories)}`;
  }
}

/* ============================
   MAIN TICK LOOP
============================ */
function tick(nowMs) {
  requestAnimationFrame(tick);

  if (status !== "running") {
    lastTickMs = 0; // prevent big jump on resume
    return;
  }

  if (!lastTickMs) lastTickMs = nowMs;
  const dtMs = Math.max(0, nowMs - lastTickMs);
  lastTickMs = nowMs;

  // integrate time
  elapsedMs += dtMs;

  // integrate distance
  const milesThisTick = Number(speedMph) * (dtMs / 3600000); // mph * hours
  distanceMi += milesThisTick;

  // integrate calories
  calories += milesThisTick * caloriesPerMile(Number(inclinePct));

  renderUI();

  // persist checkpoint every ~2 seconds
  if (!lastPersistMs) lastPersistMs = nowMs;
  if (nowMs - lastPersistMs >= 2000) {
    lastPersistMs = nowMs;
    update(stateRef, {
      checkpoint: {
        elapsedMs: Math.round(elapsedMs),
        distanceMi: Number(distanceMi.toFixed(4)),
        calories: Number(calories.toFixed(2)),
        atEpochMs: Date.now()
      }
    }).catch((e) => console.log("Persist failed:", e));
  }
}

/* ============================
   FIREBASE LISTENER
============================ */
onValue(
  stateRef,
  (snap) => {
    const s = snap.val();
    console.log("OVERLAY V2 STATE:", s);

    if (!s) {
      // initialize default state once
      update(stateRef, {
        status: "ready",
        speedMph: 0,
        inclinePct: 0,
        command: "",
        checkpoint: { elapsedMs: 0, distanceMi: 0, calories: 0, atEpochMs: Date.now() }
      }).catch(() => {});
      return;
    }

    // Apply controls from Firebase
    status = String(s.status ?? "ready");
    speedMph = Number(s.speedMph ?? 0);
    inclinePct = Number(s.inclinePct ?? 0);

    // Handle reset command (one-shot)
    if (s.command === "reset") {
      elapsedMs = 0;
      distanceMi = 0;
      calories = 0;
      lastTickMs = 0;
      lastPersistMs = 0;

      update(stateRef, { command: "" }).catch(() => {});
    }

    renderUI();
  },
  (err) => console.log("onValue error:", err)
);

/* ============================
   START LOOP
============================ */
renderUI();
requestAnimationFrame(tick);

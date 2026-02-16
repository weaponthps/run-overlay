// ===============================
// RUN OVERLAY V2 — script.js
// Reads runOverlayV2/state from Firebase RTDB
// ===============================

console.log("✅ V2 OVERLAY script.js LOADED (top of file)", new Date().toISOString());

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

console.log("OVERLAY V2 SCRIPT LOADED", new Date().toISOString());

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

// Path for V2
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, "runOverlayV2/state");

// Visual tuning
const START_PROGRESS = 0.0;
const BACK_FOOT_OFFSET_PX = 22;

// DOM
const timerEl = document.getElementById("timer");
const runnerEl = document.getElementById("runner");
const trackProgressEl = document.getElementById("trackProgress");
const mileMarkersEl = document.getElementById("mileMarkers");
const completeBadgeEl = document.getElementById("completeBadge");

const goalMilesEl = document.getElementById("goalMiles");
const goalTimeEl = document.getElementById("goalTime");
const paceEl = document.getElementById("pace");
const caloriesEl = document.getElementById("calories");

const localStartBtn = document.getElementById("localStartBtn");

const trackEl = document.querySelector(".track");
const trackAreaEl = document.querySelector(".track-area");

const speedEl = document.getElementById("speed");
const inclineEl = document.getElementById("incline");
const distanceEl = document.getElementById("distance");

// State
let status = "ready";           // ready | running | stopped
let speedMph = 0;
let inclinePct = 0;

let totalMiles = 0;             // open-ended distance
let totalCalories = 0;

let goalMiles = 4;              // used only for UI display + marker spacing
let goalMinutes = 40;

let startEpochMs = 0;
let lastTickEpochMs = 0;

// Calories calibration:
// You wanted 6 miles ≈ 605 cal => about 100.83 cal/mile.
const CAL_PER_MILE = 605 / 6;

// ---------- Helpers ----------
function pad2(n){ return String(n).padStart(2,"0"); }

function formatHMS(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}

function formatGoalTime(min){
  const m = Math.max(0, Math.floor(min));
  return `${m} MIN`;
}

function paceFromTotals(){
  if (totalMiles <= 0) return "--:-- MIN/MI";
  const mins = (elapsedMs()/60000) / totalMiles; // minutes per mile
  const mm = Math.floor(mins);
  const ss = Math.floor((mins - mm)*60);
  return `${pad2(mm)}:${pad2(ss)} MIN/MI`;
}

function elapsedMs(){
  if (!startEpochMs) return 0;
  return Date.now() - startEpochMs;
}

// Marker strategy:
// We’ll draw markers up to goalMiles (1..26), and allow fractional goalMiles too.
// If goalMiles < 1 => markers every 0.1
// 1..10 => every 1
// >10 => every 5
function markerStep(miles){
  if (miles < 1) return 0.1;
  if (miles <= 10) return 1;
  return 5;
}

function buildMileMarkers(){
  if (!mileMarkersEl) return;
  mileMarkersEl.innerHTML = "";

  const trackRect = trackEl.getBoundingClientRect();
  const areaRect = trackAreaEl.getBoundingClientRect();
  const trackLeftPx = trackRect.left - areaRect.left;

  mileMarkersEl.style.left = `${trackLeftPx}px`;
  mileMarkersEl.style.width = `${trackRect.width}px`;

  const gm = Math.max(0.1, Number(goalMiles) || 4);
  const step = markerStep(gm);

  for (let v = step; v <= gm + 1e-9; v += step){
    const ratio = v / gm;
    const xPx = ratio * trackRect.width;

    const marker = document.createElement("div");
    marker.className = "mile-marker";
    marker.dataset.value = String(v);
    marker.style.left = `${xPx}px`;

    const label = (step === 0.1) ? v.toFixed(1) : String(Math.round(v));
    marker.innerHTML = `<div class="tick"></div><div class="label">${label}</div>`;
    mileMarkersEl.appendChild(marker);
  }
}

function updateMarkerStates(){
  // “completed” relative to goalMiles scale (purely visual)
  const gm = Math.max(0.1, Number(goalMiles) || 4);
  const progress = Math.min(1, totalMiles / gm);

  document.querySelectorAll(".mile-marker").forEach((m)=>{
    const v = Number(m.dataset.value);
    const mp = v / gm;
    if (progress >= mp) m.classList.add("completed");
    else m.classList.remove("completed");
  });
}

function renderRunner(){
  const gm = Math.max(0.1, Number(goalMiles) || 4);
  const progress = Math.max(0, Math.min(1, totalMiles / gm));

  const trackRect = trackEl.getBoundingClientRect();
  const areaRect = trackAreaEl.getBoundingClientRect();

  const trackLeftPx = trackRect.left - areaRect.left;
  const x = trackLeftPx + progress * trackRect.width;
  runnerEl.style.left = `${x}px`;

  const greenWidthPx = Math.max(0, progress * trackRect.width - BACK_FOOT_OFFSET_PX);
  trackProgressEl.style.width = `${greenWidthPx}px`;

  updateMarkerStates();
}

function showComplete(){
  completeBadgeEl.style.display = "block";
  completeBadgeEl.style.animation = "popIn 250ms ease-out";
}
function hideComplete(){
  completeBadgeEl.style.display = "none";
}

// ---------- Main loop ----------
function tick(){
  // Timer display
  timerEl.textContent = formatHMS(elapsedMs());

  // UI numbers
  goalMilesEl.textContent = `${Number(goalMiles).toFixed(1)} MI`;
  goalTimeEl.textContent = formatGoalTime(goalMinutes);
  paceEl.textContent = paceFromTotals();

  caloriesEl.textContent = String(Math.round(totalCalories));

  // Runner
  renderRunner();

  requestAnimationFrame(tick);
}

// ---------- Firebase listener ----------
function attach(){
  onValue(stateRef, (snap)=>{
    const s = snap.val();
    console.log("OVERLAY V2 STATE:", s);
    if (!s) return;

    status = String(s.status ?? "ready");
    speedMph = Number(s.speedMph ?? 0);
    inclinePct = Number(s.inclinePct ?? 0);

    totalMiles = Number(s.totalMiles ?? 0);
    totalCalories = Number(s.totalCalories ?? 0);

    goalMiles = Number(s.goalMiles ?? 4);
    goalMinutes = Number(s.goalMinutes ?? 40);

    if (speedEl && s.speedMph != null) speedEl.textContent = `${Number(s.speedMph).toFixed(1)} mph`;
    if (inclineEl && s.inclinePct != null) inclineEl.textContent = `${Number(s.inclinePct).toFixed(1)} %`;
    if (distanceEl && s.distanceMi != null) distanceEl.textContent = `${Number(s.distanceMi).toFixed(2)} mi`;

    startEpochMs = Number(s.startEpochMs ?? 0);
    lastTickEpochMs = Number(s.lastTickEpochMs ?? 0);

    // complete badge: show only if control says complete OR you reached goalMiles (optional)
    if (status === "complete") showComplete();
    else hideComplete();

    // markers depend on goalMiles
    buildMileMarkers();
  }, (err)=>{
    console.log("OVERLAY V2 onValue ERROR:", err);
  });
}

// Optional local start button for testing: writes a “start” to Firebase
async function localStart(){
  const now = Date.now();
  await update(stateRef, {
    status: "running",
    startEpochMs: now,
    lastTickEpochMs: now,
    // You can keep existing totals if you want, or reset them:
    // totalMiles: 0,
    // totalCalories: 0,
  });
}

window.addEventListener("load", ()=>{
  buildMileMarkers();
  attach();
  tick();

  if (localStartBtn){
    localStartBtn.addEventListener("click", ()=>{
      localStart().catch(e => console.log("localStart failed:", e));
    });
  }

  window.addEventListener("resize", ()=>{
    buildMileMarkers();
    renderRunner();
  });
});

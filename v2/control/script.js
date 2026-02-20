// Run Overlay V2 — Control Panel
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, "runOverlayV2/state");

// DOM
const statusEl = document.getElementById("status");
const speedEl = document.getElementById("speed");
const inclineEl = document.getElementById("incline");

const cpTime = document.getElementById("cpTime");
const cpDist = document.getElementById("cpDist");
const cpCal  = document.getElementById("cpCal");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const resetBtn = document.getElementById("resetBtn");
const msgEl = document.getElementById("msg");

let current = {
  status: "ready",
  speedMph: 0,
  inclinePct: 0
};

function setMsg(t){
  if (msgEl) msgEl.textContent = t || "";
}

function clamp(n, lo, hi){
  return Math.max(lo, Math.min(hi, n));
}

function fmtMMSS(ms){
  const totalSec = Math.max(0, Math.floor(ms/1000));
  const m = Math.floor(totalSec/60);
  const s = totalSec%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

async function writePatch(patch){
  const now = Date.now();
  await update(stateRef, { ...patch, updatedAtEpochMs: now });
}

function wireButtons(){
  document.querySelectorAll("button[data-speed]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const delta = Number(btn.dataset.speed);
      const next = clamp((current.speedMph ?? 0) + delta, 0, 15);
      current.speedMph = next;
      try {
        await writePatch({ speedMph: next });
        setMsg(`Speed -> ${next.toFixed(1)} mph`);
      } catch(e){ setMsg(`Write failed: ${e}`); }
    });
  });

  document.querySelectorAll("button[data-inc]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const delta = Number(btn.dataset.inc);
      const next = clamp((current.inclinePct ?? 0) + delta, 0, 15);
      current.inclinePct = next;
      try {
        await writePatch({ inclinePct: next });
        setMsg(`Incline -> ${next.toFixed(1)}%`);
      } catch(e){ setMsg(`Write failed: ${e}`); }
    });
  });

  startBtn.addEventListener("click", async ()=>{
    try{
      await writePatch({ status: "running" });
      setMsg("Started");
    }catch(e){ setMsg(`Write failed: ${e}`); }
  });

  pauseBtn.addEventListener("click", async ()=>{
    try{
      await writePatch({ status: "paused" });
      setMsg("Paused");
    }catch(e){ setMsg(`Write failed: ${e}`); }
  });

  resumeBtn.addEventListener("click", async ()=>{
    try{
      await writePatch({ status: "running" });
      setMsg("Resumed");
    }catch(e){ setMsg(`Write failed: ${e}`); }
  });

  resetBtn.addEventListener("click", async ()=>{
    try{
      await writePatch({ command: "reset", status: "ready" });
      setMsg("Reset requested");
    }catch(e){ setMsg(`Write failed: ${e}`); }
  });
}

onValue(stateRef, (snap)=>{
  const s = snap.val();
  if (!s) return;

  current.status = String(s.status ?? "ready");
  current.speedMph = Number(s.speedMph ?? 0);
  current.inclinePct = Number(s.inclinePct ?? 0);

  if (statusEl) statusEl.textContent = current.status;
  if (speedEl) speedEl.textContent = current.speedMph.toFixed(1);
  if (inclineEl) inclineEl.textContent = current.inclinePct.toFixed(1);

  const cp = s.checkpoint || {};
  if (cpTime) cpTime.textContent = `Time: ${fmtMMSS(Number(cp.elapsedMs ?? 0))}`;
  if (cpDist) cpDist.textContent = `Distance: ${Number(cp.distanceMi ?? 0).toFixed(2)} mi`;
  if (cpCal)  cpCal.textContent  = `Calories: ${Math.round(Number(cp.calories ?? 0))}`;

}, (err)=>{
  setMsg(`Listener error: ${err}`);
});

wireButtons();

// Initialize state if empty (safe)
writePatch({
  status: "ready",
  speedMph: 0,
  inclinePct: 0,
  command: "",
  checkpoint: { elapsedMs: 0, distanceMi: 0, calories: 0, atEpochMs: Date.now() }
}).catch(()=>{});

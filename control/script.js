import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, update, set } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

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

const PATH = "runOverlayV2/state";

const el = (id) => document.getElementById(id);
const msgEl = el("msg");

function msg(t){ if (msgEl) msgEl.textContent = t; }

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function round1(n){ return Math.round(n * 10) / 10; }

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, PATH);

let state = {
  status: "ready",
  speedMph: 3.0,
  inclinePct: 0.0,
  distanceMilesCheckpoint: 0,
  caloriesCheckpoint: 0,
  checkpointEpochMs: 0,
  runStartEpochMs: 0,
};

function render(){
  el("status").textContent = state.status ?? "--";
  el("speedVal").textContent = (state.speedMph ?? 0).toFixed(1);
  el("inclineVal").textContent = (state.inclinePct ?? 0).toFixed(1);

  el("cpDistance").textContent = `${(state.distanceMilesCheckpoint ?? 0).toFixed(2)} mi`;
  el("cpCalories").textContent = `${Math.round(state.caloriesCheckpoint ?? 0)} cal`;
}

function attachListener(){
  onValue(stateRef, (snap) => {
    const s = snap.val();
    if (!s) {
      msg("State is empty. Initializing…");
      set(stateRef, state).then(()=>msg("Initialized.")).catch(e=>msg(`Init failed: ${e.message}`));
      return;
    }
    state = { ...state, ...s };
    render();
    msg("");
  }, (err) => {
    msg(`Listener error: ${err.message}`);
  });
}

async function patch(p){
  const now = Date.now();
  await update(stateRef, { ...p, updatedAtEpochMs: now });
}

function bind(){
  el("speedUp").addEventListener("click", async () => {
    const next = clamp(round1((state.speedMph ?? 0) + 0.1), 0, 20);
    await patch({ speedMph: next });
  });

  el("speedDown").addEventListener("click", async () => {
    const next = clamp(round1((state.speedMph ?? 0) - 0.1), 0, 20);
    await patch({ speedMph: next });
  });

  el("inclineUp").addEventListener("click", async () => {
    const next = clamp(round1((state.inclinePct ?? 0) + 0.5), 0, 30);
    await patch({ inclinePct: next });
  });

  el("inclineDown").addEventListener("click", async () => {
    const next = clamp(round1((state.inclinePct ?? 0) - 0.5), 0, 30);
    await patch({ inclinePct: next });
  });

  el("startBtn").addEventListener("click", async () => {
    const now = Date.now();
    await patch({
      status: "running",
      runStartEpochMs: state.runStartEpochMs || now,
      // do NOT reset checkpoints here; overlay owns accumulation
    });
  });

  el("stopBtn").addEventListener("click", async () => {
    await patch({ status: "ready" });
  });

  el("resetBtn").addEventListener("click", async () => {
    const now = Date.now();
    await patch({
      status: "ready",
      speedMph: state.speedMph ?? 3.0,
      inclinePct: state.inclinePct ?? 0.0,
      distanceMilesCheckpoint: 0,
      caloriesCheckpoint: 0,
      checkpointEpochMs: now,
      runStartEpochMs: 0,
    });
  });
}

window.addEventListener("load", () => {
  attachListener();
  bind();
  render();
});

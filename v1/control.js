import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

// ✅ Paste same config you used in script.js
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, "runOverlay/state");

const milesInput = document.getElementById("miles");
const minutesInput = document.getElementById("minutes");

const applyBtn = document.getElementById("applyBtn");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");

const statusBox = document.getElementById("statusBox");

let lastRunId = 0;

function readInputs() {
  const rawMiles = Number(milesInput.value);
  const planMiles = Math.min(26, Math.max(0.1, rawMiles));

  const planMinutes = Math.max(1, Number(minutesInput.value));

  return { planMiles, planMinutes };
}


async function applyPlan() {
  const now = Date.now();
  const { planMiles, planMinutes } = readInputs();
  await update(stateRef, {
    planMiles,
    planMinutes,
    updatedAtEpochMs: now,
  });
}

async function startRun() {
  const now = Date.now();
  const { planMiles, planMinutes } = readInputs();
  await update(stateRef, {
    planMiles,
    planMinutes,
    status: "running",
    startTimeEpochMs: now,
    runId: (lastRunId || 0) + 1,
    updatedAtEpochMs: now,
  });
}

async function resetRun() {
  const now = Date.now();
  await update(stateRef, {
    status: "ready",
    startTimeEpochMs: 0,
    updatedAtEpochMs: now,
  });
}

applyBtn.addEventListener("click", () => applyPlan().catch(e => statusBox.textContent = "Apply error: " + e));
startBtn.addEventListener("click", () => startRun().catch(e => statusBox.textContent = "Start error: " + e));
resetBtn.addEventListener("click", () => resetRun().catch(e => statusBox.textContent = "Reset error: " + e));

onValue(stateRef, (snap) => {
  const s = snap.val();
  if (!s) {
    statusBox.textContent = "No state found at runOverlay/state (null). Create it in Firebase Data tab.";
    return;
  }

  lastRunId = Number(s.runId ?? 0);

  // Keep UI in sync with database
  if (typeof s.planMiles !== "undefined") milesInput.value = s.planMiles;
  if (typeof s.planMinutes !== "undefined") minutesInput.value = s.planMinutes;

  statusBox.textContent =
    `Connected ✅\n` +
    `status: ${s.status}\n` +
    `planMiles: ${s.planMiles}\n` +
    `planMinutes: ${s.planMinutes}\n` +
    `runId: ${s.runId}\n` +
    `startTimeEpochMs: ${s.startTimeEpochMs}`;
});

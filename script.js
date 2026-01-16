// ===============================
// RUN OVERLAY – SCRIPT.JS (V1.2)
// Stops at finish + shows "Run complete"
// Green fill stays slightly behind runner back foot
// ===============================

console.log("SCRIPT LOADED");
window.onerror = (msg, src, line, col) =>
  console.log("ERROR:", msg, "line:", line, "col:", col);

// ====== CONFIG (EDIT THESE) ======
const GOAL_TIME_MINUTES = .1;   // planned run time
const START_PROGRESS = 0.0;      // 0 = start, 1 = finish
const BACK_FOOT_OFFSET_PX = 18;  // pull green line back behind runner
const TOTAL_MILES = 4; // set 1 to 10 (or more)
// ===============================

const GOAL_TIME_SECONDS = GOAL_TIME_MINUTES * 60;

const runner = document.getElementById("runner");
const trackProgress = document.getElementById("trackProgress");
const completeBadge = document.getElementById("completeBadge");
const mileMarkersEl = document.getElementById("mileMarkers");

const trackEl = document.querySelector(".track");
const trackAreaEl = document.querySelector(".track-area");

const startTime = Date.now();
let completed = false;

function render(progress) {
  progress = Math.max(0, Math.min(1, progress));

  // Measure track + area FIRST
  const trackRect = trackEl.getBoundingClientRect();
  const areaRect = trackAreaEl.getBoundingClientRect();

  // Runner position: place runner at the progress point along the track
  const trackLeftPx = trackRect.left - areaRect.left;
  const x = trackLeftPx + (progress * trackRect.width);
  runner.style.left = `${x}px`;

  // Green bar: width based on track width, pulled back a bit
  const greenWidthPx = Math.max(
    0,
    progress * trackRect.width - BACK_FOOT_OFFSET_PX
  );
  trackProgress.style.width = `${greenWidthPx}px`;

  // Update mile marker completion states
const markers = document.querySelectorAll(".mile-marker");

markers.forEach(marker => {
  const mile = Number(marker.dataset.mile);
  const mileProgress = mile / TOTAL_MILES;

  if (progress >= mileProgress) {
    marker.classList.add("completed");
  } else {
    marker.classList.remove("completed");
  }
});

}

function showComplete() {
  completeBadge.style.display = "block";
  completeBadge.style.animation = "popIn 250ms ease-out";
}

function tick() {
  if (completed) return;

  const elapsedSeconds = (Date.now() - startTime) / 1000;
  const progress = START_PROGRESS + (elapsedSeconds / GOAL_TIME_SECONDS);

  if (progress >= 1) {
    render(1);
    showComplete();
    completed = true;
    return;
  }

  render(progress);
  requestAnimationFrame(tick);
}


function buildMileMarkers() {
  // Clear old markers
  mileMarkersEl.innerHTML = "";

  // Measure track + track-area
  const trackRect = trackEl.getBoundingClientRect();
  const areaRect = trackAreaEl.getBoundingClientRect();

  // Position the markers container to align exactly with the track
  const trackLeftPx = trackRect.left - areaRect.left;
  mileMarkersEl.style.left = `${trackLeftPx}px`;
  mileMarkersEl.style.width = `${trackRect.width}px`;

  // Create ticks for 1..TOTAL_MILES
  for (let mile = 1; mile <= TOTAL_MILES; mile++) {
    const ratio = mile / TOTAL_MILES;        // 0..1
    const xPx = ratio * trackRect.width;     // pixel position

    const marker = document.createElement("div");
    marker.className = "mile-marker";
    marker.dataset.mile = mile; // store mile number

    marker.style.left = `${xPx}px`;

    marker.innerHTML = `
      <div class="tick"></div>
      <div class="label">${mile}</div>
    `;

    mileMarkersEl.appendChild(marker);
  }
}

window.addEventListener("resize", buildMileMarkers);

buildMileMarkers();

tick();










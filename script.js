// V1: fake demo numbers + simple runner movement (time-based)
// Later we'll replace with real values and SVG path positioning.

const runner = document.getElementById("runner");

let progress = 0.20; // start at 20%

function render() {
  // Move runner left->right across the card (10% to 90%)
  const leftPercent = 10 + progress * 80;
  runner.style.left = `${leftPercent}%`;
}

render();

// Demo: animate progress slowly so you can SEE it working
setInterval(() => {
  progress += 0.01;
  if (progress > 1) progress = 0;
  render();
}, 300);

/**
 * Build a self-contained replay HTML download (same shape as Python html_builder).
 */

import { sessionMeta } from "./fit-loader.js";

const REPLAY_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #1a1a2e; color: #eee; height: 100vh; display: flex; flex-direction: column; }
header { padding: 12px 20px; background: #16213e; border-bottom: 1px solid #0f3460; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
header h1 { font-size: 16px; font-weight: 600; }
header span { font-size: 13px; color: #94a3b8; }
.map-wrap { flex: 1; min-height: 0; position: relative; }
#map { width: 100%; height: 100%; }
.chart-wrap { background: #16213e; border-top: 1px solid #0f3460; padding: 12px 20px 8px; }
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 10px; flex-wrap: wrap; }
.chart-header h2 { font-size: 13px; font-weight: 600; color: #eee; }
.chart-hint { font-size: 11px; color: #94a3b8; }
.chart-toggles { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.chart-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #cbd5e1; cursor: pointer; user-select: none; }
.chart-toggle input { accent-color: #e94560; cursor: pointer; }
.chart-toggle input:disabled { cursor: not-allowed; opacity: 0.5; }
.swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.swatch-speed { background: #2ecc71; }
.swatch-hr { background: #e94560; }
.chart-stage { position: relative; }
#speed-chart { width: 100%; height: 160px; display: block; cursor: crosshair; }
#chart-cursor { position: absolute; top: 0; left: 0; width: 0; height: 100%; pointer-events: none; will-change: transform; }
.chart-cursor-line { position: absolute; top: 12px; bottom: 28px; left: -1px; width: 2px; background: #94a3b8; }
.chart-cursor-dot { position: absolute; left: -5px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #fff; transform: translateY(-50%); }
.chart-cursor-dot-speed { background: #2ecc71; }
.chart-cursor-dot-hr { background: #e94560; }
.panel { background: #16213e; border-top: 1px solid #0f3460; padding: 16px 20px 20px; }
.stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
.stat { background: #1a1a2e; border-radius: 8px; padding: 12px; text-align: center; }
.stat .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
.stat .value { font-size: 24px; font-weight: 700; margin-top: 4px; }
.stat .unit { font-size: 12px; color: #64748b; }
.controls { display: flex; align-items: center; gap: 12px; }
.controls label { font-size: 12px; color: #94a3b8; min-width: 42px; }
#play-btn { width: 40px; height: 40px; border: none; border-radius: 50%; background: #e94560; color: #fff; font-size: 16px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
#play-btn:hover { background: #ff6b81; }
input[type=range] { flex: 1; -webkit-appearance: none; height: 6px; border-radius: 3px; background: #0f3460; outline: none; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #e94560; cursor: pointer; }
.speed-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.speed-row .label { font-size: 12px; color: #94a3b8; min-width: 52px; }
.speed-btns { display: flex; gap: 6px; flex-wrap: wrap; }
.speed-btns button { padding: 6px 12px; border: 1px solid #0f3460; border-radius: 6px; background: #1a1a2e; color: #94a3b8; font-size: 12px; cursor: pointer; }
.speed-btns button:hover { border-color: #e94560; color: #eee; }
.speed-btns button.active { background: #e94560; border-color: #e94560; color: #fff; }
.boat-div-icon { background: transparent !important; border: none !important; }
.boat-marker { position: relative; width: 90px; height: 40px; margin: 0; padding: 0; }
.speed-badge { position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; background: rgba(22,33,62,0.95); border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.45); pointer-events: none; }
.dot-marker { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); background: #e94560; border: 3px solid #fff; border-radius: 50%; width: 16px; height: 16px; box-sizing: border-box; box-shadow: 0 0 8px rgba(233,69,96,0.6); }`;

let cachedStandaloneJs = null;

async function loadStandaloneJs() {
  if (cachedStandaloneJs) return cachedStandaloneJs;
  const res = await fetch(new URL("./replay-standalone.js", import.meta.url));
  if (!res.ok) throw new Error("Could not load replay-standalone.js");
  cachedStandaloneJs = await res.text();
  return cachedStandaloneJs;
}

export async function buildReplayHtml(points, title, dateLabel) {
  const meta = sessionMeta(points, dateLabel);
  const jsBody = await loadStandaloneJs();
  const js = jsBody.replace("__POINTS_JSON__", JSON.stringify(points));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>${REPLAY_CSS}</style>
</head>
<body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <span>${escapeHtml(meta.date)} · ${meta.start}–${meta.end} HKT · ${meta.totalKm} km</span>
</header>
<div class="map-wrap">
  <div id="map"></div>
</div>
<div class="chart-wrap">
  <div class="chart-header">
    <h2>Timeline</h2>
    <div class="chart-toggles">
      <label class="chart-toggle"><input type="checkbox" id="toggle-speed" checked> <span class="swatch swatch-speed"></span> Speed</label>
      <label class="chart-toggle"><input type="checkbox" id="toggle-hr"> <span class="swatch swatch-hr"></span> Heart rate</label>
    </div>
    <span class="chart-hint">Space play/pause · ←→ step · 1–5 speed · click chart</span>
  </div>
  <div class="chart-stage">
    <canvas id="speed-chart"></canvas>
    <div id="chart-cursor">
      <div class="chart-cursor-line"></div>
      <div class="chart-cursor-dot chart-cursor-dot-speed"></div>
      <div class="chart-cursor-dot chart-cursor-dot-hr" hidden></div>
    </div>
  </div>
</div>
<div class="panel">
  <div class="stats">
    <div class="stat"><div class="label">Time</div><div class="value" id="v-time">--:--:--</div></div>
    <div class="stat"><div class="label">Speed</div><div class="value" id="v-speed">0.0</div><div class="unit">km/h</div></div>
    <div class="stat"><div class="label">Heart Rate</div><div class="value" id="v-hr">—</div><div class="unit">bpm</div></div>
    <div class="stat"><div class="label">Stroke Rate</div><div class="value" id="v-cadence">—</div><div class="unit">spm</div></div>
    <div class="stat"><div class="label">Distance</div><div class="value" id="v-dist">0.00</div><div class="unit">km</div></div>
  </div>
  <div class="controls">
    <button id="play-btn" title="Play / Pause">▶</button>
    <label>${meta.start}</label>
    <input type="range" id="slider" min="0" max="${meta.sliderMax}" value="0" step="1">
    <label>${meta.end}</label>
  </div>
  <div class="speed-row">
    <span class="label">Speed</span>
    <div class="speed-btns" id="speed-btns">
      <button data-rate="0.25">0.25×</button>
      <button data-rate="0.5">0.5×</button>
      <button data-rate="1" class="active">1×</button>
      <button data-rate="2">2×</button>
      <button data-rate="4">4×</button>
    </div>
  </div>
</div>
<script>
${js}
</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function downloadText(filename, text, mime = "text/html;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

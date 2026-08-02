const POINTS = __POINTS_JSON__;

// --- Map ---
const map = L.map("map", { zoomControl: true });
L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { attribution: "Esri, Maxar, Earthstar Geographics", maxZoom: 19 }
).addTo(map);

const trail = L.polyline([], { color: "#00d4aa", weight: 4, opacity: 0.85, smoothFactor: 0 }).addTo(map);
L.polyline(POINTS.map((p) => [p.lat, p.lon]), { color: "#475569", weight: 3, opacity: 0.35, smoothFactor: 0 }).addTo(map);

// iconAnchor is the red-dot center so lat/lon sits on the route (badge floats above)
const dotIcon = L.divIcon({
  className: "boat-div-icon",
  html: '<div class="boat-marker"><div class="speed-badge" id="map-speed">0.0 km/h</div><div class="dot-marker"></div></div>',
  iconSize: [90, 40],
  iconAnchor: [45, 32],
});
const dot = L.marker([POINTS[0].lat, POINTS[0].lon], { icon: dotIcon, zIndexOffset: 1000 }).addTo(map);
const mapSpeedEl = () => dot.getElement()?.querySelector("#map-speed");

map.fitBounds(L.latLngBounds(POINTS.map((p) => [p.lat, p.lon])), { padding: [40, 40] });

// --- Timeline chart (speed / HR / stroke-rate overlays) ---
const chartCanvas = document.getElementById("speed-chart");
const chartCursor = document.getElementById("chart-cursor");
const chartCursorDotSpeed = chartCursor.querySelector(".chart-cursor-dot-speed");
const chartCursorDotHr = chartCursor.querySelector(".chart-cursor-dot-hr");
const chartCursorDotCadence = chartCursor.querySelector(".chart-cursor-dot-cadence");
const toggleSpeed = document.getElementById("toggle-speed");
const toggleHr = document.getElementById("toggle-hr");
const toggleCadence = document.getElementById("toggle-cadence");
const chartCtx = chartCanvas.getContext("2d");

const HAS_HR = POINTS.some((p) => Number(p.hr) > 0);
const HAS_CADENCE = POINTS.some((p) => Number(p.cadence) > 0);
const maxSpeedRaw = Math.max(...POINTS.map((p) => p.speed), 1);
const maxHrRaw = Math.max(...POINTS.map((p) => Number(p.hr) || 0), 1);
const maxCadRaw = Math.max(...POINTS.map((p) => Number(p.cadence) || 0), 1);
const CHART = {
  padL: 56,
  padR: 16,
  padT: 10,
  padB: 28,
  maxSpeed: Math.ceil(maxSpeedRaw + 1),
  maxHr: Math.max(120, Math.ceil(maxHrRaw / 10) * 10 + 10),
  maxCadence: Math.max(40, Math.ceil(maxCadRaw / 10) * 10 + 10),
};
let chartGeomCache = null;
let showSpeed = true;
let showHr = HAS_HR;
let showCadence = false;

function setupToggle(el, hasData, checked, onTitle, offTitle) {
  if (!el) return;
  el.disabled = !hasData;
  el.checked = hasData && checked;
  el.title = hasData ? onTitle : offTitle;
  const lab = el.closest("label");
  if (lab) {
    lab.title = el.title;
    lab.style.opacity = hasData ? "" : "0.55";
  }
}

if (toggleSpeed) toggleSpeed.checked = true;
setupToggle(toggleHr, HAS_HR, HAS_HR, "Show heart rate on the chart", "No heart rate in this file");
setupToggle(
  toggleCadence,
  HAS_CADENCE,
  false,
  "Show stroke rate on the chart",
  "No stroke rate in this file"
);

function anySeriesOn() {
  return showSpeed || (showHr && HAS_HR) || (showCadence && HAS_CADENCE);
}

function ensureOneSeries() {
  if (anySeriesOn()) return;
  showSpeed = true;
  if (toggleSpeed) toggleSpeed.checked = true;
}

/** Left axis prefers speed → HR → cadence. Right axis is the other metric when 2+ series. */
function axisRoles() {
  const left = showSpeed ? "speed" : showHr && HAS_HR ? "hr" : showCadence && HAS_CADENCE ? "cadence" : null;
  let right = null;
  if (showSpeed && showHr && HAS_HR) right = "hr";
  else if (showSpeed && showCadence && HAS_CADENCE && !(showHr && HAS_HR)) right = "cadence";
  else if (!showSpeed && showHr && HAS_HR && showCadence && HAS_CADENCE) right = "cadence";
  return { left, right };
}

function chartGeom() {
  const dpr = window.devicePixelRatio || 1;
  const rect = chartCanvas.getBoundingClientRect();
  const { left, right } = axisRoles();
  const padR = right ? 56 : 12;
  const padL = left ? 56 : 12;
  if (
    !chartGeomCache ||
    chartGeomCache.w !== rect.width ||
    chartGeomCache.h !== rect.height ||
    chartGeomCache.padR !== padR ||
    chartGeomCache.padL !== padL
  ) {
    CHART.padR = padR;
    CHART.padL = padL;
    chartCanvas.width = rect.width * dpr;
    chartCanvas.height = rect.height * dpr;
    chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    chartGeomCache = {
      w: rect.width,
      h: rect.height,
      padR,
      padL,
      plotW: rect.width - CHART.padL - CHART.padR,
      plotH: rect.height - CHART.padT - CHART.padB,
    };
    drawChartBase();
  }
  return chartGeomCache;
}

function progressToX(progress, plotW) {
  return CHART.padL + progress * plotW;
}

function speedToY(speed, plotH) {
  return CHART.padT + plotH - (speed / CHART.maxSpeed) * plotH;
}

function hrToY(hr, plotH) {
  return CHART.padT + plotH - (hr / CHART.maxHr) * plotH;
}

function cadenceToY(cad, plotH) {
  return CHART.padT + plotH - (cad / CHART.maxCadence) * plotH;
}

function seriesToY(kind, value, plotH) {
  if (kind === "speed") return speedToY(value, plotH);
  if (kind === "hr") return hrToY(value, plotH);
  return cadenceToY(value, plotH);
}

function xToProgress(x, plotW) {
  return Math.max(0, Math.min(1, (x - CHART.padL) / plotW));
}

function drawSeries(getY, color, fill) {
  const { plotW, plotH } = chartGeomCache;
  if (fill) {
    chartCtx.fillStyle = fill;
    chartCtx.beginPath();
    chartCtx.moveTo(progressToX(0, plotW), CHART.padT + plotH);
    for (let i = 0; i < POINTS.length; i++) {
      chartCtx.lineTo(progressToX(i / (POINTS.length - 1), plotW), getY(POINTS[i], plotH));
    }
    chartCtx.lineTo(progressToX(1, plotW), CHART.padT + plotH);
    chartCtx.closePath();
    chartCtx.fill();
  }
  chartCtx.strokeStyle = color;
  chartCtx.lineWidth = 1.5;
  chartCtx.beginPath();
  for (let i = 0; i < POINTS.length; i++) {
    const x = progressToX(i / (POINTS.length - 1), plotW);
    const y = getY(POINTS[i], plotH);
    if (i === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  }
  chartCtx.stroke();
}

function drawVerticalUnit(text, x, yCenter, color) {
  chartCtx.save();
  chartCtx.fillStyle = color;
  chartCtx.font = "600 11px -apple-system, BlinkMacSystemFont, sans-serif";
  chartCtx.textAlign = "center";
  chartCtx.textBaseline = "middle";
  chartCtx.translate(x, yCenter);
  chartCtx.rotate(-Math.PI / 2);
  chartCtx.fillText(text, 0, 0);
  chartCtx.restore();
}

function drawAxisTicks(kind, side) {
  const { plotW, plotH } = chartGeomCache;
  const isLeft = side === "left";
  let maxV;
  let step;
  let color;
  if (kind === "speed") {
    maxV = CHART.maxSpeed;
    step = 4;
    color = "#cbd5e1";
  } else if (kind === "hr") {
    maxV = CHART.maxHr;
    step = maxV > 160 ? 20 : 10;
    color = "#fda4af";
  } else {
    maxV = CHART.maxCadence;
    step = maxV > 80 ? 20 : 10;
    color = "#7dd3fc";
  }
  chartCtx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
  chartCtx.textBaseline = "middle";
  chartCtx.fillStyle = color;
  chartCtx.textAlign = isLeft ? "right" : "left";
  for (let tick = 0; tick <= maxV; tick += step) {
    const y = seriesToY(kind, tick, plotH);
    if (isLeft && kind === "speed") {
      chartCtx.strokeStyle = "rgba(15, 52, 96, 0.85)";
      chartCtx.beginPath();
      chartCtx.moveTo(CHART.padL, y);
      chartCtx.lineTo(CHART.padL + plotW, y);
      chartCtx.stroke();
    } else if (isLeft && kind !== "speed") {
      chartCtx.strokeStyle = "rgba(15, 52, 96, 0.85)";
      chartCtx.beginPath();
      chartCtx.moveTo(CHART.padL, y);
      chartCtx.lineTo(CHART.padL + plotW, y);
      chartCtx.stroke();
    }
    const x = isLeft ? CHART.padL - 10 : CHART.padL + plotW + 10;
    chartCtx.fillText(String(tick), x, y);
  }
}

function drawChartBase() {
  const { w, h, plotW, plotH } = chartGeomCache;
  chartCtx.clearRect(0, 0, w, h);

  chartCtx.fillStyle = "#12122a";
  chartCtx.fillRect(CHART.padL, CHART.padT, plotW, plotH);
  chartCtx.strokeStyle = "#0f3460";
  chartCtx.lineWidth = 1;
  chartCtx.strokeRect(CHART.padL + 0.5, CHART.padT + 0.5, plotW - 1, plotH - 1);

  const { left, right } = axisRoles();
  if (left) drawAxisTicks(left, "left");
  if (right) drawAxisTicks(right, "right");

  const midY = CHART.padT + plotH / 2;
  const unitMeta = {
    speed: { label: "km/h", color: "#86efac" },
    hr: { label: "bpm", color: "#fda4af" },
    cadence: { label: "spm", color: "#7dd3fc" },
  };
  if (left && unitMeta[left]) {
    drawVerticalUnit(unitMeta[left].label, 12, midY, unitMeta[left].color);
  }
  if (right && unitMeta[right]) {
    drawVerticalUnit(unitMeta[right].label, w - 12, midY, unitMeta[right].color);
  }

  const tickCount = 6;
  chartCtx.textAlign = "center";
  chartCtx.textBaseline = "alphabetic";
  chartCtx.fillStyle = "#94a3b8";
  chartCtx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
  for (let t = 0; t <= tickCount; t++) {
    const idx = Math.round((t / tickCount) * (POINTS.length - 1));
    chartCtx.fillText(
      POINTS[idx].t.slice(0, 5),
      progressToX(idx / (POINTS.length - 1), plotW),
      h - 6
    );
  }

  chartCtx.save();
  chartCtx.beginPath();
  chartCtx.rect(CHART.padL, CHART.padT, plotW, plotH);
  chartCtx.clip();
  if (showSpeed) {
    drawSeries((p, ph) => speedToY(p.speed, ph), "#2ecc71", "rgba(46, 204, 113, 0.12)");
  }
  if (showHr && HAS_HR) {
    drawSeries((p, ph) => hrToY(p.hr || 0, ph), "#e94560", null);
  }
  if (showCadence && HAS_CADENCE) {
    drawSeries((p, ph) => cadenceToY(p.cadence || 0, ph), "#38bdf8", null);
  }
  chartCtx.restore();

  if (!anySeriesOn()) {
    chartCtx.fillStyle = "#94a3b8";
    chartCtx.textAlign = "center";
    chartCtx.textBaseline = "middle";
    chartCtx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
    chartCtx.fillText(
      "Enable Speed, Heart rate, and/or Stroke rate above",
      CHART.padL + plotW / 2,
      CHART.padT + plotH / 2
    );
  }
}

function redrawChart() {
  chartGeomCache = null;
  chartGeom();
  const i = +slider.value;
  const p = POINTS[i];
  moveChartCursor(i / (POINTS.length - 1), p.speed, p.hr || 0, p.cadence || 0);
}

function moveChartCursor(progress, speed, hr, cadence) {
  const { plotW, plotH } = chartGeom();
  chartCursor.style.transform = `translateX(${progressToX(progress, plotW)}px)`;
  if (chartCursorDotSpeed) {
    chartCursorDotSpeed.hidden = !showSpeed;
    if (showSpeed) chartCursorDotSpeed.style.top = `${speedToY(speed, plotH)}px`;
  }
  if (chartCursorDotHr) {
    chartCursorDotHr.hidden = !(showHr && HAS_HR);
    if (showHr && HAS_HR) chartCursorDotHr.style.top = `${hrToY(hr || 0, plotH)}px`;
  }
  if (chartCursorDotCadence) {
    chartCursorDotCadence.hidden = !(showCadence && HAS_CADENCE);
    if (showCadence && HAS_CADENCE) {
      chartCursorDotCadence.style.top = `${cadenceToY(cadence || 0, plotH)}px`;
    }
  }
}

if (toggleSpeed) {
  toggleSpeed.addEventListener("change", () => {
    showSpeed = toggleSpeed.checked;
    ensureOneSeries();
    if (toggleSpeed) toggleSpeed.checked = showSpeed;
    redrawChart();
  });
}
if (toggleHr) {
  toggleHr.addEventListener("change", () => {
    if (!HAS_HR) {
      toggleHr.checked = false;
      return;
    }
    showHr = toggleHr.checked;
    ensureOneSeries();
    if (toggleSpeed) toggleSpeed.checked = showSpeed;
    redrawChart();
  });
}
if (toggleCadence) {
  toggleCadence.addEventListener("change", () => {
    if (!HAS_CADENCE) {
      toggleCadence.checked = false;
      return;
    }
    showCadence = toggleCadence.checked;
    ensureOneSeries();
    if (toggleSpeed) toggleSpeed.checked = showSpeed;
    redrawChart();
  });
}

// --- Playback state ---
function stateAtElapsed(elapsed) {
  let lo = 0;
  let hi = POINTS.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (POINTS[mid].elapsed <= elapsed) lo = mid;
    else hi = mid;
  }
  const a = POINTS[lo];
  const b = POINTS[Math.min(lo + 1, POINTS.length - 1)];
  const span = Math.max(b.elapsed - a.elapsed, 0.001);
  const frac = Math.max(0, Math.min(1, (elapsed - a.elapsed) / span));
  const aHr = a.hr || 0;
  const bHr = b.hr || 0;
  return {
    idx: lo,
    frac,
    progress: (lo + frac) / (POINTS.length - 1),
    elapsed,
    lat: a.lat + (b.lat - a.lat) * frac,
    lon: a.lon + (b.lon - a.lon) * frac,
    speed: a.speed + (b.speed - a.speed) * frac,
    distance: a.distance + (b.distance - a.distance) * frac,
    cadence: frac < 0.5 ? a.cadence : b.cadence,
    hr: aHr + (bHr - aHr) * frac,
    time: frac < 0.5 ? a.t : b.t,
  };
}

let trailCacheIdx = -1;
let trailCacheLatLngs = [];

function resetTrailCache(idx) {
  trailCacheIdx = idx;
  trailCacheLatLngs = POINTS.slice(0, idx + 1).map((p) => [p.lat, p.lon]);
}

function updateTrail(state) {
  if (state.idx < trailCacheIdx) resetTrailCache(state.idx);
  if (state.idx > trailCacheIdx) {
    for (let i = trailCacheIdx + 1; i <= state.idx; i++) {
      trailCacheLatLngs.push([POINTS[i].lat, POINTS[i].lon]);
    }
    trailCacheIdx = state.idx;
  }
  trail.setLatLngs(trailCacheLatLngs.concat([[state.lat, state.lon]]));
}

const slider = document.getElementById("slider");
const playBtn = document.getElementById("play-btn");
const speedBtns = document.getElementById("speed-btns");
const SESSION_DURATION = POINTS[POINTS.length - 1].elapsed;
const BASE_PLAY_SECONDS = 120;
const SPEED_KEYS = { 1: 0.25, 2: 0.5, 3: 1, 4: 2, 5: 4 };

let playing = false;
let playbackRate = 1;
let playStartWall = 0;
let playStartElapsed = 0;
/** Exact session elapsed (seconds) for resume / scrub — not just slider index. */
let resumeElapsed = 0;
let rafId = null;
let lastStatsIdx = -1;

function applyState(state, syncSlider) {
  updateTrail(state);
  dot.setLatLng([state.lat, state.lon]);
  const badge = mapSpeedEl();
  if (badge) badge.textContent = `${state.speed.toFixed(1)} km/h`;
  moveChartCursor(state.progress, state.speed, state.hr || 0, state.cadence || 0);

  if (syncSlider) slider.value = state.idx;

  if (state.idx !== lastStatsIdx) {
    lastStatsIdx = state.idx;
    document.getElementById("v-time").textContent = state.time;
    document.getElementById("v-cadence").textContent = state.cadence > 0 ? state.cadence : "—";
  }
  document.getElementById("v-speed").textContent = state.speed.toFixed(1);
  document.getElementById("v-dist").textContent = (state.distance / 1000).toFixed(2);
  const hrEl = document.getElementById("v-hr");
  if (hrEl) {
    const hr = state.hr || 0;
    hrEl.textContent = hr > 0 ? String(Math.round(hr)) : "—";
  }
}

function update(i) {
  const p = POINTS[i];
  lastStatsIdx = -1;
  resetTrailCache(i);
  resumeElapsed = p.elapsed;
  applyState(
    {
      idx: i,
      frac: 0,
      progress: i / (POINTS.length - 1),
      lat: p.lat,
      lon: p.lon,
      speed: p.speed,
      distance: p.distance,
      cadence: p.cadence,
      hr: p.hr || 0,
      time: p.t,
    },
    true
  );
}

function setPlaying(on) {
  playing = on;
  playBtn.textContent = on ? "⏸" : "▶";
  playBtn.title = on ? "Pause" : "Play";
}

function elapsedNow() {
  const wallSec = (performance.now() - playStartWall) / 1000 * playbackRate;
  return Math.min(SESSION_DURATION, playStartElapsed + (wallSec / BASE_PLAY_SECONDS) * SESSION_DURATION);
}

function pause() {
  if (playing) {
    const elapsed = elapsedNow();
    const state = stateAtElapsed(elapsed);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    setPlaying(false);
    // Keep exact pause time + interpolated position (no snap-jump)
    resumeElapsed = elapsed;
    slider.value = state.idx;
    applyState(state, true);
    return;
  }
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  setPlaying(false);
}

function syncPlayAnchor() {
  playStartElapsed = playing ? elapsedNow() : resumeElapsed;
  playStartWall = performance.now();
  if (playing) resumeElapsed = playStartElapsed;
}

function setPlaybackRate(rate) {
  playbackRate = rate;
  speedBtns.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", +btn.dataset.rate === rate);
  });
  if (playing) syncPlayAnchor();
}

function tick() {
  if (!playing) return;
  const elapsed = elapsedNow();
  resumeElapsed = elapsed;
  if (elapsed >= SESSION_DURATION) {
    pause();
    update(POINTS.length - 1);
    return;
  }
  applyState(stateAtElapsed(elapsed), false);
  rafId = requestAnimationFrame(tick);
}

function play() {
  // At end → restart from beginning; otherwise resume exact pause/scrub time
  if (resumeElapsed >= SESSION_DURATION - 1e-6) {
    resumeElapsed = 0;
    slider.value = 0;
    update(0);
    playStartElapsed = 0;
  } else {
    playStartElapsed = resumeElapsed;
  }
  playStartWall = performance.now();
  lastStatsIdx = -1;
  setPlaying(true);
  rafId = requestAnimationFrame(tick);
}

function scrubTo(idx) {
  // Sync to live playback position first (slider is stale while playing)
  if (playing) pause();
  const i = Math.max(0, Math.min(POINTS.length - 1, idx));
  slider.value = i;
  update(i); // sets resumeElapsed to that sample
}

/** Step ←/→ from the true current sample (pause anchor if mid-play). */
function stepBy(delta) {
  if (playing) pause();
  const base = stateAtElapsed(resumeElapsed).idx;
  scrubTo(base + delta);
}

// --- Event listeners ---
playBtn.addEventListener("click", () => (playing ? pause() : play()));
slider.addEventListener("input", (e) => {
  if (playing) pause();
  update(+e.target.value);
});
speedBtns.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-rate]");
  if (btn) setPlaybackRate(+btn.dataset.rate);
});
chartCanvas.addEventListener("click", (e) => {
  const rect = chartCanvas.getBoundingClientRect();
  const { plotW } = chartGeom();
  const idx = Math.round(xToProgress(e.clientX - rect.left, plotW) * (POINTS.length - 1));
  if (playing) pause();
  slider.value = idx;
  update(idx);
});
window.addEventListener("resize", () => {
  chartGeomCache = null;
  chartGeom();
  const p = POINTS[+slider.value];
  moveChartCursor(+slider.value / (POINTS.length - 1), p.speed, p.hr || 0, p.cadence || 0);
});
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select")) return;
  if (e.code === "Space") {
    e.preventDefault();
    playing ? pause() : play();
  } else if (e.code === "ArrowLeft") {
    e.preventDefault();
    stepBy(-1);
  } else if (e.code === "ArrowRight") {
    e.preventDefault();
    stepBy(1);
  } else if (SPEED_KEYS[e.key]) {
    e.preventDefault();
    setPlaybackRate(SPEED_KEYS[e.key]);
  }
});

chartGeom();
update(0);
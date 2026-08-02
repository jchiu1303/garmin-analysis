/**
 * Interactive map + speed chart playback.
 * Requires Leaflet global `L` and DOM ids matching the player section.
 */

export function createReplay(POINTS) {
  if (!POINTS?.length) throw new Error("No points");

  const map = L.map("map", { zoomControl: true });
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Esri, Maxar, Earthstar Geographics", maxZoom: 19 }
  ).addTo(map);

  const trail = L.polyline([], {
    color: "#00d4aa",
    weight: 4,
    opacity: 0.85,
    smoothFactor: 0,
  }).addTo(map);
  L.polyline(
    POINTS.map((p) => [p.lat, p.lon]),
    { color: "#475569", weight: 3, opacity: 0.35, smoothFactor: 0 }
  ).addTo(map);

  const dotIcon = L.divIcon({
    className: "",
    html: '<div class="boat-marker"><div class="speed-badge" id="map-speed">0.0 km/h</div><div class="dot-marker"></div></div>',
    iconSize: [90, 48],
    iconAnchor: [45, 30],
  });
  const dot = L.marker([POINTS[0].lat, POINTS[0].lon], {
    icon: dotIcon,
    zIndexOffset: 1000,
  }).addTo(map);
  const mapSpeedEl = () => dot.getElement()?.querySelector("#map-speed");

  map.fitBounds(L.latLngBounds(POINTS.map((p) => [p.lat, p.lon])), {
    padding: [40, 40],
  });

  const chartCanvas = document.getElementById("speed-chart");
  const chartCursor = document.getElementById("chart-cursor");
  const chartCursorDot = chartCursor.querySelector(".chart-cursor-dot");
  const chartCtx = chartCanvas.getContext("2d");
  const CHART = {
    padL: 44,
    padR: 16,
    padT: 12,
    padB: 28,
    maxSpeed: Math.ceil(Math.max(...POINTS.map((p) => p.speed)) + 1),
  };
  let chartGeomCache = null;

  function chartGeom() {
    const dpr = window.devicePixelRatio || 1;
    const rect = chartCanvas.getBoundingClientRect();
    if (
      !chartGeomCache ||
      chartGeomCache.w !== rect.width ||
      chartGeomCache.h !== rect.height
    ) {
      chartCanvas.width = rect.width * dpr;
      chartCanvas.height = rect.height * dpr;
      chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      chartGeomCache = {
        w: rect.width,
        h: rect.height,
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

  function xToProgress(x, plotW) {
    return Math.max(0, Math.min(1, (x - CHART.padL) / plotW));
  }

  function drawChartBase() {
    const { w, h, plotW, plotH } = chartGeomCache;
    chartCtx.clearRect(0, 0, w, h);
    chartCtx.fillStyle = "#1a1a2e";
    chartCtx.fillRect(CHART.padL, CHART.padT, plotW, plotH);

    chartCtx.strokeStyle = "#0f3460";
    chartCtx.lineWidth = 1;
    for (let tick = 0; tick <= CHART.maxSpeed; tick += 4) {
      const y = speedToY(tick, plotH);
      chartCtx.beginPath();
      chartCtx.moveTo(CHART.padL, y);
      chartCtx.lineTo(CHART.padL + plotW, y);
      chartCtx.stroke();
      chartCtx.fillStyle = "#64748b";
      chartCtx.font = "10px sans-serif";
      chartCtx.textAlign = "right";
      chartCtx.fillText(String(tick), CHART.padL - 6, y + 3);
    }

    const tickCount = 6;
    chartCtx.textAlign = "center";
    chartCtx.fillStyle = "#94a3b8";
    for (let t = 0; t <= tickCount; t++) {
      const idx = Math.round((t / tickCount) * (POINTS.length - 1));
      chartCtx.fillText(
        POINTS[idx].t.slice(0, 5),
        progressToX(idx / (POINTS.length - 1), plotW),
        h - 8
      );
    }

    chartCtx.fillStyle = "rgba(46, 204, 113, 0.12)";
    chartCtx.beginPath();
    chartCtx.moveTo(progressToX(0, plotW), speedToY(0, plotH));
    for (let i = 0; i < POINTS.length; i++) {
      chartCtx.lineTo(
        progressToX(i / (POINTS.length - 1), plotW),
        speedToY(POINTS[i].speed, plotH)
      );
    }
    chartCtx.lineTo(progressToX(1, plotW), speedToY(0, plotH));
    chartCtx.closePath();
    chartCtx.fill();

    chartCtx.strokeStyle = "#2ecc71";
    chartCtx.lineWidth = 1.5;
    chartCtx.beginPath();
    for (let i = 0; i < POINTS.length; i++) {
      const x = progressToX(i / (POINTS.length - 1), plotW);
      const y = speedToY(POINTS[i].speed, plotH);
      if (i === 0) chartCtx.moveTo(x, y);
      else chartCtx.lineTo(x, y);
    }
    chartCtx.stroke();

    chartCtx.fillStyle = "#eee";
    chartCtx.font = "11px sans-serif";
    chartCtx.textAlign = "left";
    chartCtx.fillText("km/h", 6, CHART.padT + 10);
    chartCtx.fillStyle = "#94a3b8";
    chartCtx.fillText("HKT", CHART.padL + plotW / 2 - 10, h - 22);
  }

  function moveChartCursor(progress, speed) {
    const { plotW, plotH } = chartGeom();
    chartCursor.style.transform = `translateX(${progressToX(progress, plotW)}px)`;
    chartCursorDot.style.top = `${speedToY(speed, plotH)}px`;
  }

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

  slider.max = String(POINTS.length - 1);
  slider.value = "0";

  let playing = false;
  let playbackRate = 1;
  let playStartWall = 0;
  let playStartElapsed = 0;
  let rafId = null;
  let lastStatsIdx = -1;

  function applyState(state, syncSlider) {
    updateTrail(state);
    dot.setLatLng([state.lat, state.lon]);
    const badge = mapSpeedEl();
    if (badge) badge.textContent = `${state.speed.toFixed(1)} km/h`;
    moveChartCursor(state.progress, state.speed);

    if (syncSlider) slider.value = String(state.idx);

    if (state.idx !== lastStatsIdx) {
      lastStatsIdx = state.idx;
      document.getElementById("v-time").textContent = state.time;
      document.getElementById("v-cadence").textContent =
        state.cadence > 0 ? String(state.cadence) : "—";
    }
    document.getElementById("v-speed").textContent = state.speed.toFixed(1);
    document.getElementById("v-dist").textContent = (
      state.distance / 1000
    ).toFixed(2);
  }

  function update(i) {
    const p = POINTS[i];
    lastStatsIdx = -1;
    resetTrailCache(i);
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
    const wallSec =
      ((performance.now() - playStartWall) / 1000) * playbackRate;
    return Math.min(
      SESSION_DURATION,
      playStartElapsed + (wallSec / BASE_PLAY_SECONDS) * SESSION_DURATION
    );
  }

  function pause() {
    if (playing) {
      const state = stateAtElapsed(elapsedNow());
      slider.value = String(state.idx);
      applyState(state, false);
    }
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    setPlaying(false);
  }

  function syncPlayAnchor() {
    playStartElapsed = playing
      ? elapsedNow()
      : POINTS[+slider.value].elapsed;
    playStartWall = performance.now();
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
    if (elapsed >= SESSION_DURATION) {
      pause();
      update(POINTS.length - 1);
      return;
    }
    applyState(stateAtElapsed(elapsed), false);
    rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (+slider.value >= POINTS.length - 1) {
      slider.value = "0";
      update(0);
      playStartElapsed = 0;
    } else {
      playStartElapsed = POINTS[+slider.value].elapsed;
    }
    playStartWall = performance.now();
    lastStatsIdx = -1;
    setPlaying(true);
    rafId = requestAnimationFrame(tick);
  }

  function scrubTo(idx) {
    const i = Math.max(0, Math.min(POINTS.length - 1, idx));
    pause();
    slider.value = String(i);
    update(i);
  }

  const onPlayClick = () => (playing ? pause() : play());
  const onSlider = (e) => {
    pause();
    update(+e.target.value);
  };
  const onSpeed = (e) => {
    const btn = e.target.closest("button[data-rate]");
    if (btn) setPlaybackRate(+btn.dataset.rate);
  };
  const onChartClick = (e) => {
    const rect = chartCanvas.getBoundingClientRect();
    const { plotW } = chartGeom();
    const idx = Math.round(
      xToProgress(e.clientX - rect.left, plotW) * (POINTS.length - 1)
    );
    pause();
    slider.value = String(idx);
    update(idx);
  };
  const onResize = () => {
    chartGeomCache = null;
    chartGeom();
    moveChartCursor(
      +slider.value / (POINTS.length - 1),
      POINTS[+slider.value].speed
    );
    map.invalidateSize();
  };
  const onKey = (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.code === "Space") {
      e.preventDefault();
      playing ? pause() : play();
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      scrubTo(+slider.value - 1);
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      scrubTo(+slider.value + 1);
    } else if (SPEED_KEYS[e.key]) {
      e.preventDefault();
      setPlaybackRate(SPEED_KEYS[e.key]);
    }
  };

  playBtn.addEventListener("click", onPlayClick);
  slider.addEventListener("input", onSlider);
  speedBtns.addEventListener("click", onSpeed);
  chartCanvas.addEventListener("click", onChartClick);
  window.addEventListener("resize", onResize);
  document.addEventListener("keydown", onKey);

  // Leaflet needs visible container
  requestAnimationFrame(() => {
    map.invalidateSize();
    chartGeom();
    update(0);
  });

  return {
    destroy() {
      pause();
      playBtn.removeEventListener("click", onPlayClick);
      slider.removeEventListener("input", onSlider);
      speedBtns.removeEventListener("click", onSpeed);
      chartCanvas.removeEventListener("click", onChartClick);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
      map.remove();
    },
    map,
  };
}

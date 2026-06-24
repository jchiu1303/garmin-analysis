#!/usr/bin/env python3
"""Generate an interactive HTML map replay from a Garmin FIT file."""

import argparse
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import fitparse

HK = ZoneInfo("Asia/Hong_Kong")


def load_points(fit_path: Path) -> list[dict]:
    points = []
    start_ts = None
    for record in fitparse.FitFile(str(fit_path)).get_messages("record"):
        f = {x.name: x.value for x in record}
        lat, lon = f.get("position_lat"), f.get("position_long")
        if not lat or not lon:
            continue
        ts = f["timestamp"].replace(tzinfo=timezone.utc).astimezone(HK)
        if start_ts is None:
            start_ts = ts
        spd_ms = f.get("enhanced_speed") or f.get("speed") or 0
        points.append(
            {
                "t": ts.strftime("%H:%M:%S"),
                "elapsed": round((ts - start_ts).total_seconds(), 1),
                "lat": round(lat * 180 / 2**31, 6),
                "lon": round(lon * 180 / 2**31, 6),
                "speed": round(spd_ms * 3.6, 2),
                "cadence": f.get("cadence") or 0,
                "distance": round(f.get("distance") or 0, 1),
            }
        )
    return points


def demo_points(count: int = 360, duration_sec: float = 2400) -> list[dict]:
    """Synthetic paddling loop — not real GPS data."""
    start = datetime(2026, 1, 15, 10, 0, 0, tzinfo=HK)
    cx, cy = 22.3180, 114.1680
    lat_amp, lon_amp = 0.006, 0.010
    points = []
    distance = 0.0

    for i in range(count):
        frac = i / max(count - 1, 1)
        elapsed = frac * duration_sec
        ts = start + timedelta(seconds=elapsed)
        angle = frac * 2 * math.pi * 1.2
        lat = cx + lat_amp * math.cos(angle)
        lon = cy + lon_amp * math.sin(angle)
        speed = max(0, 3 + 8 * abs(math.sin(angle * 2.5)) + 2 * math.sin(frac * 24))
        if i > 0:
            prev = points[-1]
            dlat = (lat - prev["lat"]) * 111_000
            dlon = (lon - prev["lon"]) * 111_000 * math.cos(math.radians(lat))
            distance += math.hypot(dlat, dlon)
        cadence = int(38 + 12 * abs(math.sin(angle * 1.8))) if speed > 2 else 0
        points.append(
            {
                "t": ts.strftime("%H:%M:%S"),
                "elapsed": round(elapsed, 1),
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "speed": round(speed, 2),
                "cadence": cadence,
                "distance": round(distance, 1),
            }
        )
    return points


def generate_html(points: list[dict], title: str, date_label: str) -> str:
    meta = {
        "date": date_label,
        "start": points[0]["t"],
        "end": points[-1]["t"],
        "total_km": round(points[-1]["distance"] / 1000, 2),
        "count": len(points),
    }
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #1a1a2e; color: #eee; height: 100vh; display: flex; flex-direction: column; }}
  header {{ padding: 12px 20px; background: #16213e; border-bottom: 1px solid #0f3460; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }}
  header h1 {{ font-size: 16px; font-weight: 600; }}
  header span {{ font-size: 13px; color: #94a3b8; }}
  .map-wrap {{ flex: 1; min-height: 0; position: relative; }}
  #map {{ width: 100%; height: 100%; }}
  .chart-wrap {{ background: #16213e; border-top: 1px solid #0f3460; padding: 12px 20px 8px; }}
  .chart-header {{ display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }}
  .chart-header h2 {{ font-size: 13px; font-weight: 600; color: #eee; }}
  .chart-header span {{ font-size: 11px; color: #94a3b8; }}
  .chart-stage {{ position: relative; }}
  #speed-chart {{ width: 100%; height: 160px; display: block; cursor: crosshair; }}
  #chart-cursor {{ position: absolute; top: 0; left: 0; width: 0; height: 100%; pointer-events: none; will-change: transform; }}
  .chart-cursor-line {{ position: absolute; top: 12px; bottom: 28px; left: -1px; width: 2px; background: #e94560; box-shadow: 0 0 6px rgba(233,69,96,0.5); }}
  .chart-cursor-dot {{ position: absolute; left: -5px; width: 10px; height: 10px; border-radius: 50%; background: #e94560; border: 2px solid #fff; box-shadow: 0 0 6px rgba(233,69,96,0.6); transform: translateY(-50%); }}
  .panel {{ background: #16213e; border-top: 1px solid #0f3460; padding: 16px 20px 20px; }}
  .stats {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }}
  .stat {{ background: #1a1a2e; border-radius: 8px; padding: 12px; text-align: center; }}
  .stat .label {{ font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }}
  .stat .value {{ font-size: 24px; font-weight: 700; margin-top: 4px; }}
  .stat .unit {{ font-size: 12px; color: #64748b; }}
  .controls {{ display: flex; align-items: center; gap: 12px; }}
  .controls label {{ font-size: 12px; color: #94a3b8; min-width: 42px; }}
  #play-btn {{ width: 40px; height: 40px; border: none; border-radius: 50%; background: #e94560; color: #fff; font-size: 16px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }}
  #play-btn:hover {{ background: #ff6b81; }}
  #play-btn:disabled {{ background: #475569; cursor: default; }}
  input[type=range] {{ flex: 1; -webkit-appearance: none; height: 6px; border-radius: 3px; background: #0f3460; outline: none; }}
  input[type=range]::-webkit-slider-thumb {{ -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #e94560; cursor: pointer; }}
  .speed-row {{ display: flex; align-items: center; gap: 8px; margin-top: 12px; }}
  .speed-row .label {{ font-size: 12px; color: #94a3b8; min-width: 52px; }}
  .speed-btns {{ display: flex; gap: 6px; flex-wrap: wrap; }}
  .speed-btns button {{ padding: 6px 12px; border: 1px solid #0f3460; border-radius: 6px; background: #1a1a2e; color: #94a3b8; font-size: 12px; cursor: pointer; }}
  .speed-btns button:hover {{ border-color: #e94560; color: #eee; }}
  .speed-btns button.active {{ background: #e94560; border-color: #e94560; color: #fff; }}
  .boat-marker {{ display: flex; flex-direction: column; align-items: center; gap: 4px; }}
  .speed-badge {{ padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; background: rgba(22,33,62,0.95); border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.45); }}
  .dot-marker {{ background: #e94560; border: 3px solid #fff; border-radius: 50%; width: 16px; height: 16px; box-shadow: 0 0 8px rgba(233,69,96,0.6); }}
</style>
</head>
<body>
<header>
  <h1>{title}</h1>
  <span>{meta["date"]} · {meta["start"]}–{meta["end"]} HKT · {meta["total_km"]} km</span>
</header>
<div class="map-wrap">
  <div id="map"></div>
</div>
<div class="chart-wrap">
  <div class="chart-header">
    <h2>Speed over time</h2>
    <span>Click chart to jump · synced with map</span>
  </div>
  <div class="chart-stage">
    <canvas id="speed-chart"></canvas>
    <div id="chart-cursor">
      <div class="chart-cursor-line"></div>
      <div class="chart-cursor-dot"></div>
    </div>
  </div>
</div>
<div class="panel">
  <div class="stats">
    <div class="stat"><div class="label">Time</div><div class="value" id="v-time">--:--:--</div></div>
    <div class="stat"><div class="label">Speed</div><div class="value" id="v-speed">0.0</div><div class="unit">km/h</div></div>
    <div class="stat"><div class="label">Stroke Rate</div><div class="value" id="v-cadence">—</div><div class="unit">spm</div></div>
    <div class="stat"><div class="label">Distance</div><div class="value" id="v-dist">0.00</div><div class="unit">km</div></div>
  </div>
  <div class="controls">
    <button id="play-btn" title="Play / Pause">▶</button>
    <label>{meta["start"]}</label>
    <input type="range" id="slider" min="0" max="{meta["count"] - 1}" value="0" step="1">
    <label>{meta["end"]}</label>
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
const POINTS = {json.dumps(points)};
const map = L.map("map", {{ zoomControl: true }});
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{{z}}/{{y}}/{{x}}", {{
  attribution: "Esri, Maxar, Earthstar Geographics",
  maxZoom: 19
}}).addTo(map);

const trail = L.polyline([], {{ color: "#00d4aa", weight: 4, opacity: 0.85, smoothFactor: 0 }}).addTo(map);
L.polyline(POINTS.map(p => [p.lat, p.lon]), {{ color: "#475569", weight: 3, opacity: 0.35, smoothFactor: 0 }}).addTo(map);

const dotIcon = L.divIcon({{
  className: "",
  html: '<div class="boat-marker"><div class="speed-badge" id="map-speed">0.0 km/h</div><div class="dot-marker"></div></div>',
  iconSize: [90, 48],
  iconAnchor: [45, 30],
}});
const dot = L.marker([POINTS[0].lat, POINTS[0].lon], {{ icon: dotIcon, zIndexOffset: 1000 }}).addTo(map);
const mapSpeedEl = () => dot.getElement()?.querySelector("#map-speed");

map.fitBounds(L.latLngBounds(POINTS.map(p => [p.lat, p.lon])), {{ padding: [40, 40] }});

const chartCanvas = document.getElementById("speed-chart");
const chartCursor = document.getElementById("chart-cursor");
const chartCursorDot = chartCursor.querySelector(".chart-cursor-dot");
const chartCtx = chartCanvas.getContext("2d");
const CHART = {{ padL: 44, padR: 16, padT: 12, padB: 28, maxSpeed: Math.ceil(Math.max(...POINTS.map(p => p.speed)) + 1) }};
let chartGeomCache = null;

function chartGeom() {{
  const dpr = window.devicePixelRatio || 1;
  const rect = chartCanvas.getBoundingClientRect();
  if (!chartGeomCache || chartGeomCache.w !== rect.width || chartGeomCache.h !== rect.height) {{
    chartCanvas.width = rect.width * dpr;
    chartCanvas.height = rect.height * dpr;
    chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    chartGeomCache = {{
      w: rect.width,
      h: rect.height,
      plotW: rect.width - CHART.padL - CHART.padR,
      plotH: rect.height - CHART.padT - CHART.padB,
    }};
    drawChartBase();
  }}
  return chartGeomCache;
}}

function progressToX(progress, plotW) {{
  return CHART.padL + progress * plotW;
}}

function speedToY(speed, plotH) {{
  return CHART.padT + plotH - (speed / CHART.maxSpeed) * plotH;
}}

function xToProgress(x, plotW) {{
  return Math.max(0, Math.min(1, (x - CHART.padL) / plotW));
}}

function drawChartBase() {{
  const {{ w, h, plotW, plotH }} = chartGeomCache;
  chartCtx.clearRect(0, 0, w, h);
  chartCtx.fillStyle = "#1a1a2e";
  chartCtx.fillRect(CHART.padL, CHART.padT, plotW, plotH);

  chartCtx.strokeStyle = "#0f3460";
  chartCtx.lineWidth = 1;
  for (let tick = 0; tick <= CHART.maxSpeed; tick += 4) {{
    const y = speedToY(tick, plotH);
    chartCtx.beginPath();
    chartCtx.moveTo(CHART.padL, y);
    chartCtx.lineTo(CHART.padL + plotW, y);
    chartCtx.stroke();
    chartCtx.fillStyle = "#64748b";
    chartCtx.font = "10px sans-serif";
    chartCtx.textAlign = "right";
    chartCtx.fillText(tick, CHART.padL - 6, y + 3);
  }}

  const tickCount = 6;
  chartCtx.textAlign = "center";
  chartCtx.fillStyle = "#94a3b8";
  for (let t = 0; t <= tickCount; t++) {{
    const idx = Math.round((t / tickCount) * (POINTS.length - 1));
    chartCtx.fillText(POINTS[idx].t.slice(0, 5), progressToX(idx / (POINTS.length - 1), plotW), h - 8);
  }}

  chartCtx.fillStyle = "rgba(46, 204, 113, 0.12)";
  chartCtx.beginPath();
  chartCtx.moveTo(progressToX(0, plotW), speedToY(0, plotH));
  for (let i = 0; i < POINTS.length; i++) {{
    chartCtx.lineTo(progressToX(i / (POINTS.length - 1), plotW), speedToY(POINTS[i].speed, plotH));
  }}
  chartCtx.lineTo(progressToX(1, plotW), speedToY(0, plotH));
  chartCtx.closePath();
  chartCtx.fill();

  chartCtx.strokeStyle = "#2ecc71";
  chartCtx.lineWidth = 1.5;
  chartCtx.beginPath();
  for (let i = 0; i < POINTS.length; i++) {{
    const x = progressToX(i / (POINTS.length - 1), plotW);
    const y = speedToY(POINTS[i].speed, plotH);
    if (i === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  }}
  chartCtx.stroke();

  chartCtx.fillStyle = "#eee";
  chartCtx.font = "11px sans-serif";
  chartCtx.textAlign = "left";
  chartCtx.fillText("km/h", 6, CHART.padT + 10);
  chartCtx.fillStyle = "#94a3b8";
  chartCtx.fillText("HKT", CHART.padL + plotW / 2 - 10, h - 22);
}}

function moveChartCursor(progress, speed) {{
  const {{ plotW, plotH }} = chartGeom();
  const x = progressToX(progress, plotW);
  chartCursor.style.transform = `translateX(${{x}}px)`;
  chartCursorDot.style.top = `${{speedToY(speed, plotH)}}px`;
}}

function stateAtElapsed(elapsed) {{
  let lo = 0, hi = POINTS.length - 1;
  while (lo < hi - 1) {{
    const mid = (lo + hi) >> 1;
    if (POINTS[mid].elapsed <= elapsed) lo = mid;
    else hi = mid;
  }}
  const a = POINTS[lo];
  const b = POINTS[Math.min(lo + 1, POINTS.length - 1)];
  const span = Math.max(b.elapsed - a.elapsed, 0.001);
  const frac = Math.max(0, Math.min(1, (elapsed - a.elapsed) / span));
  const progress = (lo + frac) / (POINTS.length - 1);
  return {{
    idx: lo,
    frac,
    progress,
    elapsed,
    lat: a.lat + (b.lat - a.lat) * frac,
    lon: a.lon + (b.lon - a.lon) * frac,
    speed: a.speed + (b.speed - a.speed) * frac,
    distance: a.distance + (b.distance - a.distance) * frac,
    cadence: frac < 0.5 ? a.cadence : b.cadence,
    time: frac < 0.5 ? a.t : b.t,
  }};
}}

let trailCacheIdx = -1;
let trailCacheLatLngs = [];

function resetTrailCache(idx) {{
  trailCacheIdx = idx;
  trailCacheLatLngs = [];
  for (let i = 0; i <= idx; i++) trailCacheLatLngs.push([POINTS[i].lat, POINTS[i].lon]);
}}

function updateTrail(state) {{
  if (state.idx < trailCacheIdx) resetTrailCache(state.idx);
  if (state.idx > trailCacheIdx) {{
    for (let i = trailCacheIdx + 1; i <= state.idx; i++) {{
      trailCacheLatLngs.push([POINTS[i].lat, POINTS[i].lon]);
    }}
    trailCacheIdx = state.idx;
  }}
  trail.setLatLngs(trailCacheLatLngs.concat([[state.lat, state.lon]]));
}}

const slider = document.getElementById("slider");
const playBtn = document.getElementById("play-btn");
const speedBtns = document.getElementById("speed-btns");
let playing = false;
let playbackRate = 1;
let playStartWall = 0;
let playStartElapsed = 0;
let playStartProgress = 0;
let rafId = null;
let lastStatsIdx = -1;

function applyState(state, syncSlider) {{
  updateTrail(state);
  dot.setLatLng([state.lat, state.lon]);
  const badge = mapSpeedEl();
  if (badge) badge.textContent = `${{state.speed.toFixed(1)}} km/h`;
  moveChartCursor(state.progress, state.speed);

  if (syncSlider) slider.value = state.idx;

  if (state.idx !== lastStatsIdx) {{
    lastStatsIdx = state.idx;
    document.getElementById("v-time").textContent = state.time;
    document.getElementById("v-cadence").textContent = state.cadence > 0 ? state.cadence : "—";
  }}
  document.getElementById("v-speed").textContent = state.speed.toFixed(1);
  document.getElementById("v-dist").textContent = (state.distance / 1000).toFixed(2);
}}

function update(i) {{
  const p = POINTS[i];
  lastStatsIdx = -1;
  resetTrailCache(i);
  applyState({{
    idx: i,
    frac: 0,
    progress: i / (POINTS.length - 1),
    lat: p.lat,
    lon: p.lon,
    speed: p.speed,
    distance: p.distance,
    cadence: p.cadence,
    time: p.t,
  }}, true);
}}

function setPlaying(on) {{
  playing = on;
  playBtn.textContent = on ? "⏸" : "▶";
  playBtn.title = on ? "Pause" : "Play";
}}

function pause() {{
  if (playing) {{
    const wallSec = (performance.now() - playStartWall) / 1000 * playbackRate;
    const progress = Math.min(1, playStartProgress + (wallSec / BASE_PLAY_SECONDS));
    slider.value = Math.round(progress * (POINTS.length - 1));
  }}
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  setPlaying(false);
}}

const SESSION_DURATION = POINTS[POINTS.length - 1].elapsed;
const BASE_PLAY_SECONDS = 120; // 1× plays the full session in 2 minutes

function syncPlayAnchor() {{
  const progress = +slider.value / (POINTS.length - 1);
  playStartProgress = progress;
  playStartElapsed = progress * SESSION_DURATION;
  playStartWall = performance.now();
}}

function setPlaybackRate(rate) {{
  playbackRate = rate;
  speedBtns.querySelectorAll("button").forEach(btn => {{
    btn.classList.toggle("active", +btn.dataset.rate === rate);
  }});
  if (playing) syncPlayAnchor();
}}

function tick() {{
  if (!playing) return;
  const wallSec = (performance.now() - playStartWall) / 1000 * playbackRate;
  const progress = Math.min(1, playStartProgress + (wallSec / BASE_PLAY_SECONDS));
  if (progress >= 1) {{
    pause();
    update(POINTS.length - 1);
    return;
  }}
  applyState(stateAtElapsed(progress * SESSION_DURATION), false);
  rafId = requestAnimationFrame(tick);
}}

function play() {{
  if (+slider.value >= POINTS.length - 1) {{
    slider.value = 0;
    update(0);
    playStartProgress = 0;
    playStartElapsed = 0;
  }} else {{
    playStartProgress = +slider.value / (POINTS.length - 1);
    playStartElapsed = playStartProgress * SESSION_DURATION;
  }}
  playStartWall = performance.now();
  lastStatsIdx = -1;
  setPlaying(true);
  rafId = requestAnimationFrame(tick);
}}

playBtn.addEventListener("click", () => playing ? pause() : play());
slider.addEventListener("input", e => {{
  pause();
  update(+e.target.value);
}});
speedBtns.addEventListener("click", e => {{
  const btn = e.target.closest("button[data-rate]");
  if (btn) setPlaybackRate(+btn.dataset.rate);
}});
chartCanvas.addEventListener("click", e => {{
  const rect = chartCanvas.getBoundingClientRect();
  const {{ plotW }} = chartGeom();
  const progress = xToProgress(e.clientX - rect.left, plotW);
  const idx = Math.round(progress * (POINTS.length - 1));
  pause();
  slider.value = idx;
  update(idx);
}});
window.addEventListener("resize", () => {{
  chartGeomCache = null;
  chartGeom();
  moveChartCursor(+slider.value / (POINTS.length - 1), POINTS[+slider.value].speed);
}});
chartGeom();
update(0);
</script>
</body>
</html>"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("fit_file", type=Path, nargs="?", help="Path to .fit activity file")
    parser.add_argument("-o", "--output", type=Path, help="Output HTML path")
    parser.add_argument("--title", default="Dragon Boat Replay")
    parser.add_argument("--date", help="Date label shown in header")
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Generate a synthetic demo replay (no FIT file needed)",
    )
    args = parser.parse_args()

    if args.demo:
        points = demo_points()
        date_label = args.date or "Demo session"
        title = args.title if args.title != "Dragon Boat Replay" else "Dragon Boat Replay (Demo)"
        out = args.output or Path("demo/replay.html")
    else:
        if not args.fit_file:
            raise SystemExit("Provide a FIT file, or pass --demo for synthetic data")
        points = load_points(args.fit_file)
        if not points:
            raise SystemExit("No GPS points found in FIT file")
        date_label = args.date or args.fit_file.parent.name
        title = args.title
        out = args.output or args.fit_file.parent / "replay.html"

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(generate_html(points, title, date_label))
    print(f"Wrote {out} ({len(points)} points)")


if __name__ == "__main__":
    main()
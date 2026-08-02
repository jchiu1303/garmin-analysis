/**
 * Share exports: satellite/topo poster PNG + story timelapse video.
 * Map tiles: Esri World Imagery (same family as the live replay map).
 */

import { sessionMeta } from "./fit-loader.js";

export function shareCaption(meta, appUrl) {
  return [
    `🐉 Dragon boat · ${meta.totalKm} km · ${meta.date}`,
    `${meta.start}–${meta.end} HKT`,
    "",
    `Make your own map replay (private, in-browser):`,
    appUrl,
  ].join("\n");
}

// —— Web Mercator helpers ——
function lon2tile(lon, z) {
  return ((lon + 180) / 360) * 2 ** z;
}
function lat2tile(lat, z) {
  const r = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
  );
}
function tile2lon(x, z) {
  return (x / 2 ** z) * 360 - 180;
}
function tile2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function routeBounds(points, padFrac = 0.12) {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLon = Math.min(...lons);
  let maxLon = Math.max(...lons);
  const dLat = Math.max(maxLat - minLat, 0.002);
  const dLon = Math.max(maxLon - minLon, 0.002);
  minLat -= dLat * padFrac;
  maxLat += dLat * padFrac;
  minLon -= dLon * padFrac;
  maxLon += dLon * padFrac;
  return { minLat, maxLat, minLon, maxLon };
}

function chooseZoom(bounds, mapW, mapH) {
  // Pick highest zoom where the bbox still fits in ~map pixels
  for (let z = 17; z >= 10; z--) {
    const x0 = lon2tile(bounds.minLon, z);
    const x1 = lon2tile(bounds.maxLon, z);
    const y0 = lat2tile(bounds.maxLat, z); // north = smaller y
    const y1 = lat2tile(bounds.minLat, z);
    const pxW = (x1 - x0) * 256;
    const pxH = (y1 - y0) * 256;
    if (pxW <= mapW * 1.35 && pxH <= mapH * 1.35) return z;
  }
  return 12;
}

function loadTile(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Draw Esri World Imagery under the route into mapRect.
 * Returns false if tiles failed (caller can fall back to solid fill).
 */
async function drawSatelliteBasemap(ctx, points, mapRect) {
  const { x: mapX, y: mapY, w: mapW, h: mapH } = mapRect;
  const bounds = routeBounds(points);
  const z = chooseZoom(bounds, mapW, mapH);

  const x0 = Math.floor(lon2tile(bounds.minLon, z));
  const x1 = Math.floor(lon2tile(bounds.maxLon, z));
  const y0 = Math.floor(lat2tile(bounds.maxLat, z));
  const y1 = Math.floor(lat2tile(bounds.minLat, z));

  // World-pixel span of bbox at this zoom
  const west = lon2tile(bounds.minLon, z) * 256;
  const east = lon2tile(bounds.maxLon, z) * 256;
  const north = lat2tile(bounds.maxLat, z) * 256;
  const south = lat2tile(bounds.minLat, z) * 256;
  const worldW = Math.max(east - west, 1);
  const worldH = Math.max(south - north, 1);
  const scale = Math.min(mapW / worldW, mapH / worldH);
  const drawW = worldW * scale;
  const drawH = worldH * scale;
  const ox = mapX + (mapW - drawW) / 2;
  const oy = mapY + (mapH - drawH) / 2;

  const maxTiles = 48;
  let count = 0;
  let any = false;

  ctx.save();
  // clip to rounded map panel
  roundRectPath(ctx, mapX, mapY, mapW, mapH, 20);
  ctx.clip();
  ctx.fillStyle = "#0d1b2a";
  ctx.fillRect(mapX, mapY, mapW, mapH);

  const jobs = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (count++ >= maxTiles) break;
      const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`;
      jobs.push(
        loadTile(url).then((img) => {
          if (!img) return;
          any = true;
          const sx = ox + (tx * 256 - west) * scale;
          const sy = oy + (ty * 256 - north) * scale;
          ctx.drawImage(img, sx, sy, 256 * scale, 256 * scale);
        })
      );
    }
  }
  await Promise.all(jobs);

  // slight darken so route pops
  if (any) {
    ctx.fillStyle = "rgba(10, 18, 32, 0.28)";
    ctx.fillRect(mapX, mapY, mapW, mapH);
  }
  ctx.restore();

  // Project lon/lat → canvas using same transform as tiles
  const toXY = (lat, lon) => {
    const px = lon2tile(lon, z) * 256;
    const py = lat2tile(lat, z) * 256;
    return [ox + (px - west) * scale, oy + (py - north) * scale];
  };

  return { ok: any, toXY, mapX, mapY, mapW, mapH };
}

function projectFallback(points, mapX, mapY, mapW, mapH) {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const pad = 48;
  const spanLat = Math.max(maxLat - minLat, 1e-5);
  const spanLon = Math.max(maxLon - minLon, 1e-5);
  const scale = Math.min((mapW - pad * 2) / spanLon, (mapH - pad * 2) / spanLat);
  return (lat, lon) => [
    mapX + mapW / 2 + (lon - (minLon + maxLon) / 2) * scale,
    mapY + mapH / 2 - (lat - (minLat + maxLat) / 2) * scale,
  ];
}

function drawRouteOnMap(ctx, points, toXY, progress = 1) {
  const n = Math.max(2, Math.floor(1 + (points.length - 1) * progress));
  const slice = points.slice(0, n);

  // full route ghost
  ctx.strokeStyle = "rgba(148, 163, 184, 0.55)";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach((p, i) => {
    const [x, y] = toXY(p.lat, p.lon);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // active trail
  ctx.strokeStyle = "#00d4aa";
  ctx.lineWidth = 6;
  ctx.beginPath();
  slice.forEach((p, i) => {
    const [x, y] = toXY(p.lat, p.lon);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // start
  const [sx, sy] = toXY(points[0].lat, points[0].lon);
  ctx.fillStyle = "#2ecc71";
  ctx.beginPath();
  ctx.arc(sx, sy, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // boat / end of progress
  const cur = slice[slice.length - 1];
  const [cx, cy] = toXY(cur.lat, cur.lon);
  ctx.fillStyle = "#e94560";
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.stroke();

  // speed pill
  const label = `${(cur.speed || 0).toFixed(1)} km/h`;
  ctx.font = "700 22px -apple-system, BlinkMacSystemFont, sans-serif";
  const tw = ctx.measureText(label).width;
  const bx = cx - tw / 2 - 12;
  const by = cy - 48;
  ctx.fillStyle = "rgba(22, 33, 62, 0.92)";
  roundRect(ctx, bx, by, tw + 24, 34, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, bx + 12, by + 17);
  ctx.textBaseline = "alphabetic";
}

function drawChrome(ctx, W, H, title, meta, points, appUrl, opts = {}) {
  const { story = false } = opts;

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#16213e");
  grad.addColorStop(0.55, "#1a1a2e");
  grad.addColorStop(1, "#0f0f1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#e94560";
  ctx.fillRect(0, 0, W, 8);

  const titleSize = story ? 48 : 52;
  ctx.fillStyle = "#eee";
  ctx.font = `700 ${titleSize}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(title.slice(0, 28), 64, story ? 88 : 100);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "400 26px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(`${meta.date} · HKT`, 64, story ? 132 : 150);

  const stats = [
    { label: "DISTANCE", value: `${meta.totalKm}`, unit: "km" },
    { label: "DURATION", value: formatDuration(points), unit: "" },
    { label: "AVG SPEED", value: avgSpeed(points).toFixed(1), unit: "km/h" },
  ];
  const boxW = (W - 64 * 2 - 24 * 2) / 3;
  const statsY = story ? 170 : 190;
  stats.forEach((s, i) => {
    const x = 64 + i * (boxW + 24);
    ctx.fillStyle = "#1a1a2e";
    roundRect(ctx, x, statsY, boxW, 110, 16);
    ctx.fill();
    ctx.fillStyle = "#64748b";
    ctx.font = "600 16px -apple-system, sans-serif";
    ctx.fillText(s.label, x + 18, statsY + 34);
    ctx.fillStyle = "#eee";
    ctx.font = "700 36px -apple-system, sans-serif";
    ctx.fillText(s.value, x + 18, statsY + 78);
    if (s.unit) {
      const tw = ctx.measureText(s.value).width;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 18px -apple-system, sans-serif";
      ctx.fillText(s.unit, x + 24 + tw, statsY + 78);
    }
  });

  ctx.fillStyle = "#64748b";
  ctx.font = "400 20px -apple-system, sans-serif";
  ctx.fillText(
    story ? "Timelapse · GPS stays on your device" : "Satellite map · GPS stays on your device",
    64,
    H - 80
  );
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 18px -apple-system, sans-serif";
  ctx.fillText(appUrl.replace(/^https?:\/\//, ""), 64, H - 44);
}

/**
 * Static share poster with satellite basemap (1080×1350).
 */
export async function drawPoster(canvas, points, title, dateLabel, appUrl) {
  const meta = sessionMeta(points, dateLabel);
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  drawChrome(ctx, W, H, title, meta, points, appUrl, { story: false });

  const mapX = 64;
  const mapY = 340;
  const mapW = W - 128;
  const mapH = 720;

  // panel shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, mapX + 4, mapY + 6, mapW, mapH, 20);
  ctx.fill();

  const basemap = await drawSatelliteBasemap(ctx, points, {
    x: mapX,
    y: mapY,
    w: mapW,
    h: mapH,
  });

  if (!basemap.ok) {
    ctx.fillStyle = "#0d1b2a";
    roundRect(ctx, mapX, mapY, mapW, mapH, 20);
    ctx.fill();
  }

  // outer ring
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  roundRect(ctx, mapX, mapY, mapW, mapH, 20);
  ctx.stroke();

  const toXY = basemap.ok
    ? basemap.toXY
    : projectFallback(points, mapX, mapY, mapW, mapH);

  ctx.save();
  roundRectPath(ctx, mapX, mapY, mapW, mapH, 20);
  ctx.clip();
  drawRouteOnMap(ctx, points, toXY, 1);
  ctx.restore();

  return meta;
}

/**
 * 9:16 story timelapse (1080×1920) with satellite map + route animation.
 * Returns { blob, mime, ext }.
 */
export async function recordStoryTimelapse(points, title, dateLabel, appUrl, onProgress) {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const meta = sessionMeta(points, dateLabel);

  const mapX = 48;
  const mapY = 320;
  const mapW = W - 96;
  const mapH = 1180;

  // Pre-render basemap once onto offscreen
  const bg = document.createElement("canvas");
  bg.width = W;
  bg.height = H;
  const bgCtx = bg.getContext("2d");
  drawChrome(bgCtx, W, H, title, meta, points, appUrl, { story: true });
  bgCtx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(bgCtx, mapX + 4, mapY + 6, mapW, mapH, 24);
  bgCtx.fill();

  const basemap = await drawSatelliteBasemap(bgCtx, points, {
    x: mapX,
    y: mapY,
    w: mapW,
    h: mapH,
  });
  if (!basemap.ok) {
    bgCtx.fillStyle = "#0d1b2a";
    roundRect(bgCtx, mapX, mapY, mapW, mapH, 24);
    bgCtx.fill();
  }
  bgCtx.strokeStyle = "rgba(255,255,255,0.12)";
  bgCtx.lineWidth = 2;
  roundRect(bgCtx, mapX, mapY, mapW, mapH, 24);
  bgCtx.stroke();

  const toXY = basemap.ok
    ? basemap.toXY
    : projectFallback(points, mapX, mapY, mapW, mapH);

  const mime = pickRecorderMime();
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 6_000_000,
  });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  const done = new Promise((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mime }));
    };
    recorder.onerror = () => reject(new Error("Recording failed"));
  });

  recorder.start(100);

  const durationMs = 7000;
  const holdMs = 900;
  const start = performance.now();

  await new Promise((resolve) => {
    function frame(now) {
      const t = now - start;
      let progress;
      if (t < durationMs) {
        // ease-in-out
        const u = t / durationMs;
        progress = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      } else {
        progress = 1;
      }

      ctx.drawImage(bg, 0, 0);
      ctx.save();
      roundRectPath(ctx, mapX, mapY, mapW, mapH, 24);
      ctx.clip();
      drawRouteOnMap(ctx, points, toXY, progress);
      ctx.restore();

      // progress bar
      const barY = H - 140;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      roundRect(ctx, 64, barY, W - 128, 10, 5);
      ctx.fill();
      ctx.fillStyle = "#e94560";
      roundRect(ctx, 64, barY, (W - 128) * progress, 10, 5);
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 18px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Route timelapse", W / 2, barY - 16);

      if (onProgress) onProgress(Math.min(1, t / (durationMs + holdMs)));

      if (t < durationMs + holdMs) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });

  recorder.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  const blob = await done;
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  return { blob, mime, ext, meta };
}

function pickRecorderMime() {
  const candidates = [
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
      return m;
    }
  }
  return "video/webm";
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDuration(points) {
  const sec = Math.round(points[points.length - 1].elapsed);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function avgSpeed(points) {
  const distKm = points[points.length - 1].distance / 1000;
  const hours = points[points.length - 1].elapsed / 3600;
  if (hours <= 0) return 0;
  return distKm / hours;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  roundRectPath(ctx, x, y, w, h, r);
}

export function downloadCanvasPng(canvas, filename) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Could not export image (map tiles may block download)"));
          return;
        }
        downloadBlob(blob, filename);
        resolve();
      }, "image/png");
    } catch (e) {
      reject(e);
    }
  });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

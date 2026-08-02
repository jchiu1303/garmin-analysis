/**
 * Route poster for social share (1080×1350 portrait).
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

export function drawPoster(canvas, points, title, dateLabel, appUrl) {
  const meta = sessionMeta(points, dateLabel);
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#16213e");
  grad.addColorStop(0.55, "#1a1a2e");
  grad.addColorStop(1, "#0f0f1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Accent bar
  ctx.fillStyle = "#e94560";
  ctx.fillRect(0, 0, W, 8);

  // Title
  ctx.fillStyle = "#eee";
  ctx.font = "700 52px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(title.slice(0, 28), 64, 100);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "400 28px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(`${meta.date} · HKT`, 64, 150);

  // Big stats
  const stats = [
    { label: "DISTANCE", value: `${meta.totalKm}`, unit: "km" },
    { label: "DURATION", value: formatDuration(points), unit: "" },
    { label: "AVG SPEED", value: avgSpeed(points).toFixed(1), unit: "km/h" },
  ];
  const boxW = (W - 64 * 2 - 24 * 2) / 3;
  stats.forEach((s, i) => {
    const x = 64 + i * (boxW + 24);
    const y = 190;
    ctx.fillStyle = "#1a1a2e";
    roundRect(ctx, x, y, boxW, 120, 16);
    ctx.fill();
    ctx.fillStyle = "#64748b";
    ctx.font = "600 18px -apple-system, sans-serif";
    ctx.fillText(s.label, x + 20, y + 36);
    ctx.fillStyle = "#eee";
    ctx.font = "700 40px -apple-system, sans-serif";
    ctx.fillText(s.value, x + 20, y + 84);
    if (s.unit) {
      const tw = ctx.measureText(s.value).width;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 20px -apple-system, sans-serif";
      ctx.fillText(s.unit, x + 28 + tw, y + 84);
    }
  });

  // Route panel
  const mapX = 64;
  const mapY = 350;
  const mapW = W - 128;
  const mapH = 720;
  ctx.fillStyle = "#0d1b2a";
  roundRect(ctx, mapX, mapY, mapW, mapH, 20);
  ctx.fill();

  // Draw route
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const pad = 48;
  const spanLat = Math.max(maxLat - minLat, 1e-5);
  const spanLon = Math.max(maxLon - minLon, 1e-5);
  // keep aspect roughly square-ish inside panel
  const scale = Math.min((mapW - pad * 2) / spanLon, (mapH - pad * 2) / spanLat);

  const toXY = (lat, lon) => {
    const x =
      mapX +
      mapW / 2 +
      (lon - (minLon + maxLon) / 2) * scale;
    const y =
      mapY +
      mapH / 2 -
      (lat - (minLat + maxLat) / 2) * scale;
    return [x, y];
  };

  // full route (muted)
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach((p, i) => {
    const [x, y] = toXY(p.lat, p.lon);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // active-style green trail
  ctx.strokeStyle = "#00d4aa";
  ctx.lineWidth = 5;
  ctx.beginPath();
  points.forEach((p, i) => {
    const [x, y] = toXY(p.lat, p.lon);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // start / end dots
  const [sx, sy] = toXY(points[0].lat, points[0].lon);
  const [ex, ey] = toXY(points[points.length - 1].lat, points[points.length - 1].lon);
  ctx.fillStyle = "#2ecc71";
  ctx.beginPath();
  ctx.arc(sx, sy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e94560";
  ctx.beginPath();
  ctx.arc(ex, ey, 12, 0, Math.PI * 2);
  ctx.fill();

  // Footer
  ctx.fillStyle = "#64748b";
  ctx.font = "400 22px -apple-system, sans-serif";
  ctx.fillText("Interactive replay · GPS stays on your device", 64, H - 80);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 20px -apple-system, sans-serif";
  const shortUrl = appUrl.replace(/^https?:\/\//, "");
  ctx.fillText(shortUrl, 64, H - 44);

  return meta;
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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function downloadCanvasPng(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
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

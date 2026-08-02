/**
 * Load GPS points from a FIT ArrayBuffer or a File (.fit / .zip).
 * Uses fit-file-parser + JSZip from jsDelivr (browser ESM).
 */

import FitParser from "https://cdn.jsdelivr.net/npm/fit-file-parser@4.1.0/+esm";
import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";

const HKT = "Asia/Hong_Kong";

function formatHktTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: HKT,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatHktDateLabel(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: HKT,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function parseFitBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      speedUnit: "km/h",
      lengthUnit: "m",
      temperatureUnit: "celsius",
    });
    parser.parse(buffer, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

/**
 * @returns {{ points: object[], dateLabel: string, startIso: string }}
 */
export function recordsToPoints(data) {
  const records = data.records || [];
  const points = [];
  let startTs = null;

  for (const rec of records) {
    const lat = rec.position_lat;
    const lon = rec.position_long;
    if (lat == null || lon == null) continue;

    let ts = rec.timestamp;
    if (!(ts instanceof Date)) ts = new Date(ts);
    if (Number.isNaN(ts.getTime())) continue;

    if (startTs == null) startTs = ts;

    const speed = rec.enhanced_speed ?? rec.speed ?? 0;
    const cadence = rec.cadence ?? 0;
    const distance = rec.distance ?? 0;

    points.push({
      t: formatHktTime(ts),
      elapsed: Math.round(((ts - startTs) / 1000) * 10) / 10,
      lat: Math.round(lat * 1e6) / 1e6,
      lon: Math.round(lon * 1e6) / 1e6,
      speed: Math.round(Number(speed) * 100) / 100,
      cadence: Math.round(Number(cadence)) || 0,
      distance: Math.round(Number(distance) * 10) / 10,
    });
  }

  if (!points.length) {
    throw new Error("No GPS points found in this FIT file.");
  }

  let dateLabel = formatHktDateLabel(startTs);
  const sessionStart = data.sessions?.[0]?.start_time;
  if (sessionStart) {
    const d = sessionStart instanceof Date ? sessionStart : new Date(sessionStart);
    if (!Number.isNaN(d.getTime())) dateLabel = formatHktDateLabel(d);
  }

  return {
    points,
    dateLabel,
    startIso: startTs.toISOString(),
  };
}

export async function loadFitArrayBuffer(buffer) {
  const data = await parseFitBuffer(buffer);
  return recordsToPoints(data);
}

async function extractFitFromZip(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter(
    (n) => n.toLowerCase().endsWith(".fit") && !zip.files[n].dir
  );
  if (!names.length) {
    throw new Error("No .fit file found inside the zip.");
  }
  // Prefer ACTIVITY.fit style names
  names.sort((a, b) => {
    const score = (n) =>
      /activity/i.test(n) ? 0 : /_ACTIVITY\.fit$/i.test(n) ? 0 : 1;
    return score(a) - score(b) || a.localeCompare(b);
  });
  return zip.files[names[0]].async("arraybuffer");
}

/**
 * @param {File|Blob} file
 */
export async function loadFromFile(file) {
  const name = (file.name || "").toLowerCase();
  const buffer = await file.arrayBuffer();

  if (name.endsWith(".zip") || file.type === "application/zip") {
    const fitBuf = await extractFitFromZip(buffer);
    return loadFitArrayBuffer(fitBuf);
  }
  if (name.endsWith(".fit") || !name.includes(".")) {
    return loadFitArrayBuffer(buffer);
  }
  // Try FIT first, then zip
  try {
    return await loadFitArrayBuffer(buffer);
  } catch {
    const fitBuf = await extractFitFromZip(buffer);
    return loadFitArrayBuffer(fitBuf);
  }
}

/** Synthetic paddling loop — same idea as Python demo_points. */
export function demoPoints(count = 360, durationSec = 2400) {
  const start = new Date("2026-01-15T02:00:00.000Z"); // 10:00 HKT
  const centerLat = 22.318;
  const centerLon = 114.168;
  const latAmp = 0.006;
  const lonAmp = 0.01;
  const points = [];
  let distanceM = 0;

  for (let i = 0; i < count; i++) {
    const frac = i / Math.max(count - 1, 1);
    const elapsed = frac * durationSec;
    const ts = new Date(start.getTime() + elapsed * 1000);
    const angle = frac * 2 * Math.PI * 1.2;
    const lat = centerLat + latAmp * Math.cos(angle);
    const lon = centerLon + lonAmp * Math.sin(angle);
    const speed = Math.max(
      0,
      3 + 8 * Math.abs(Math.sin(angle * 2.5)) + 2 * Math.sin(frac * 24)
    );

    if (i > 0) {
      const prev = points[i - 1];
      const dlat = (lat - prev.lat) * 111000;
      const dlon = (lon - prev.lon) * 111000 * Math.cos((lat * Math.PI) / 180);
      distanceM += Math.hypot(dlat, dlon);
    }

    const cadence = speed > 2 ? Math.round(38 + 12 * Math.abs(Math.sin(angle * 1.8))) : 0;
    points.push({
      t: formatHktTime(ts),
      elapsed: Math.round(elapsed * 10) / 10,
      lat: Math.round(lat * 1e6) / 1e6,
      lon: Math.round(lon * 1e6) / 1e6,
      speed: Math.round(speed * 100) / 100,
      cadence,
      distance: Math.round(distanceM * 10) / 10,
    });
  }

  return {
    points,
    dateLabel: "Demo session",
    startIso: start.toISOString(),
  };
}

export function sessionMeta(points, dateLabel) {
  return {
    date: dateLabel,
    start: points[0].t,
    end: points[points.length - 1].t,
    totalKm: Math.round((points[points.length - 1].distance / 1000) * 100) / 100,
    count: points.length,
    sliderMax: points.length - 1,
  };
}

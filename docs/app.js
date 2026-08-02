import { loadFromFile, demoPoints, sessionMeta } from "./fit-loader.js";
import { createReplay } from "./replay-engine.js";
import { buildReplayHtml, downloadText } from "./build-html.js";
import {
  drawPoster,
  shareCaption,
  downloadCanvasPng,
  copyText,
} from "./poster.js";

const landing = document.getElementById("landing");
const player = document.getElementById("player");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const statusEl = document.getElementById("status");
const toastEl = document.getElementById("toast");
const demoBtn = document.getElementById("demo-btn");
const backBtn = document.getElementById("back-btn");
const dlHtmlBtn = document.getElementById("dl-html-btn");
const posterBtn = document.getElementById("poster-btn");
const captionBtn = document.getElementById("caption-btn");
const posterModal = document.getElementById("poster-modal");
const posterCanvas = document.getElementById("poster-canvas");
const posterClose = document.getElementById("poster-close");
const posterDl = document.getElementById("poster-dl");

const APP_URL =
  window.location.origin +
  window.location.pathname.replace(/index\.html$/, "").replace(/\/?$/, "/");

let state = {
  points: null,
  dateLabel: "",
  title: "Dragon Boat Replay",
  replay: null,
  downloadSlug: "replay",
  busy: false,
};

function errText(err) {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return err;
  return err.message || String(err);
}

function setStatus(msg, kind = "") {
  if (!msg) {
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.className = "status";
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = msg;
  statusEl.className = `status ${kind}`.trim();
}

let toastTimer = null;
function showToast(msg, kind = "error") {
  toastEl.hidden = false;
  toastEl.textContent = msg;
  toastEl.className = `toast toast-${kind}`;
  clearTimeout(toastTimer);
  if (kind !== "busy") {
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 8000);
  }
}

function clearToast() {
  clearTimeout(toastTimer);
  toastEl.hidden = true;
  toastEl.textContent = "";
}

function showPlayer() {
  landing.hidden = true;
  player.hidden = false;
  document.body.style.overflow = "hidden";
}

function showLanding() {
  if (state.replay) {
    try {
      state.replay.destroy();
    } catch {
      /* ignore */
    }
    state.replay = null;
  }
  resetMapContainer();
  player.hidden = true;
  landing.hidden = false;
  document.body.style.overflow = "";
  state.points = null;
  setStatus("");
}

function resetMapContainer() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;
  if (mapEl._leaflet_id) {
    try {
      mapEl._leaflet_id = null;
    } catch {
      /* ignore */
    }
    delete mapEl._leaflet_id;
  }
  mapEl.innerHTML = "";
}

function waitFrames(n = 2) {
  return new Promise((resolve) => {
    const step = (left) => {
      if (left <= 0) resolve();
      else requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

async function openSession({ points, dateLabel, title }) {
  if (typeof L === "undefined") {
    throw new Error(
      "Map library (Leaflet) failed to load. Check your network and reload."
    );
  }
  if (!points?.length) {
    throw new Error("No track points to display.");
  }

  if (state.replay) {
    try {
      state.replay.destroy();
    } catch {
      /* ignore */
    }
    state.replay = null;
  }
  resetMapContainer();

  state.points = points;
  state.dateLabel = dateLabel;
  state.title = title || "Dragon Boat Replay";

  const meta = sessionMeta(points, dateLabel);
  document.getElementById("session-title").textContent = state.title;
  document.getElementById("session-meta").textContent =
    `${meta.date} · ${meta.start}–${meta.end} HKT · ${meta.totalKm} km`;
  document.getElementById("lbl-start").textContent = meta.start;
  document.getElementById("lbl-end").textContent = meta.end;

  // Show player first so Leaflet gets a real size
  showPlayer();
  await waitFrames(2);
  await new Promise((r) => setTimeout(r, 50));

  try {
    state.replay = createReplay(points);
  } catch (e) {
    // Return to landing with a visible error (status lives on landing)
    showLanding();
    throw e;
  }
}

async function handleFile(file) {
  if (!file || state.busy) return;
  state.busy = true;
  clearToast();
  setStatus(`Reading ${file.name}…`, "busy");
  showToast(`Reading ${file.name}…`, "busy");
  try {
    const { points, dateLabel } = await loadFromFile(file);
    setStatus("");
    clearToast();
    state.downloadSlug = file.name.replace(/\.(fit|zip)$/i, "") || "replay";
    await openSession({
      points,
      dateLabel,
      title: "Dragon Boat Replay",
    });
  } catch (err) {
    console.error("[upload]", err);
    const msg = errText(err);
    // Always land on home with message — don't leave a blank player
    if (!landing.hidden) {
      setStatus(msg, "error");
    } else {
      showLanding();
      setStatus(msg, "error");
    }
    showToast(msg, "error");
  } finally {
    state.busy = false;
    fileInput.value = "";
  }
}

// File input (label association opens picker — no programmatic click needed)
fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) handleFile(f);
});

// Drag-and-drop onto dropzone
["dragenter", "dragover"].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("dragover");
  });
});
dropzone.addEventListener("drop", (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
});

// Also allow drop on whole landing
landing.addEventListener("dragover", (e) => {
  e.preventDefault();
});
landing.addEventListener("drop", (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
});

demoBtn.addEventListener("click", async () => {
  if (state.busy) return;
  state.busy = true;
  setStatus("Loading demo…", "busy");
  showToast("Loading demo…", "busy");
  try {
    const { points, dateLabel } = demoPoints();
    setStatus("");
    clearToast();
    state.downloadSlug = "demo";
    await openSession({
      points,
      dateLabel,
      title: "Dragon Boat Replay (Demo)",
    });
  } catch (err) {
    console.error("[demo]", err);
    const msg = errText(err);
    showLanding();
    setStatus(msg, "error");
    showToast(msg, "error");
  } finally {
    state.busy = false;
  }
});

backBtn.addEventListener("click", () => {
  showLanding();
  clearToast();
});

dlHtmlBtn.addEventListener("click", async () => {
  if (!state.points) return;
  dlHtmlBtn.disabled = true;
  try {
    const html = await buildReplayHtml(
      state.points,
      state.title,
      state.dateLabel
    );
    downloadText(`${state.downloadSlug || "replay"}_replay.html`, html);
  } catch (err) {
    showToast("Download failed: " + errText(err), "error");
  } finally {
    dlHtmlBtn.disabled = false;
  }
});

function openPosterModal() {
  if (!state.points) return;
  drawPoster(
    posterCanvas,
    state.points,
    state.title,
    state.dateLabel,
    APP_URL
  );
  posterModal.hidden = false;
}

posterBtn.addEventListener("click", openPosterModal);
posterClose.addEventListener("click", () => {
  posterModal.hidden = true;
});
posterModal.addEventListener("click", (e) => {
  if (e.target === posterModal) posterModal.hidden = true;
});

posterDl.addEventListener("click", async () => {
  if (!state.points) return;
  const meta = sessionMeta(state.points, state.dateLabel);
  const caption = shareCaption(meta, APP_URL);
  await copyText(caption);
  await downloadCanvasPng(
    posterCanvas,
    `${state.downloadSlug || "replay"}_poster.png`
  );
  posterDl.textContent = "Downloaded · caption copied";
  setTimeout(() => {
    posterDl.textContent = "Download PNG + copy caption";
  }, 2000);
});

captionBtn.addEventListener("click", async () => {
  if (!state.points) return;
  const meta = sessionMeta(state.points, state.dateLabel);
  const ok = await copyText(shareCaption(meta, APP_URL));
  captionBtn.textContent = ok ? "Copied!" : "Copy failed";
  setTimeout(() => {
    captionBtn.textContent = "Copy caption";
  }, 1500);
});

// Boot check
if (typeof L === "undefined") {
  setStatus(
    "Map library failed to load (Leaflet). Reload the page or check ad-blockers.",
    "error"
  );
}

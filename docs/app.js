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
};

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

function showPlayer() {
  landing.hidden = true;
  player.hidden = false;
  document.body.style.overflow = "hidden";
}

function showLanding() {
  if (state.replay) {
    state.replay.destroy();
    state.replay = null;
  }
  // Reset map container for Leaflet re-init
  const mapEl = document.getElementById("map");
  mapEl.innerHTML = "";
  if (mapEl._leaflet_id) delete mapEl._leaflet_id;

  player.hidden = true;
  landing.hidden = false;
  document.body.style.overflow = "";
  state.points = null;
  setStatus("");
}

async function openSession({ points, dateLabel, title }) {
  if (state.replay) {
    state.replay.destroy();
    state.replay = null;
  }
  const mapEl = document.getElementById("map");
  mapEl.innerHTML = "";
  if (mapEl._leaflet_id) delete mapEl._leaflet_id;

  state.points = points;
  state.dateLabel = dateLabel;
  state.title = title || "Dragon Boat Replay";

  const meta = sessionMeta(points, dateLabel);
  document.getElementById("session-title").textContent = state.title;
  document.getElementById("session-meta").textContent =
    `${meta.date} · ${meta.start}–${meta.end} HKT · ${meta.totalKm} km`;
  document.getElementById("lbl-start").textContent = meta.start;
  document.getElementById("lbl-end").textContent = meta.end;

  showPlayer();
  // Wait a frame so layout is visible for Leaflet
  await new Promise((r) => requestAnimationFrame(r));
  state.replay = createReplay(points);
}

async function handleFile(file) {
  if (!file) return;
  setStatus(`Reading ${file.name}…`, "busy");
  try {
    const { points, dateLabel } = await loadFromFile(file);
    setStatus("");
    const base = file.name.replace(/\.(fit|zip)$/i, "");
    await openSession({
      points,
      dateLabel,
      title: "Dragon Boat Replay",
    });
    // stash basename for downloads
    state.downloadSlug = base || "replay";
  } catch (err) {
    console.error(err);
    setStatus(err.message || String(err), "error");
  }
}

// Dropzone
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  handleFile(f);
  fileInput.value = "";
});

["dragenter", "dragover"].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  });
});
dropzone.addEventListener("drop", (e) => {
  const f = e.dataTransfer?.files?.[0];
  handleFile(f);
});

demoBtn.addEventListener("click", async () => {
  setStatus("Loading demo…", "busy");
  try {
    const { points, dateLabel } = demoPoints();
    setStatus("");
    state.downloadSlug = "demo";
    await openSession({
      points,
      dateLabel,
      title: "Dragon Boat Replay (Demo)",
    });
  } catch (err) {
    setStatus(err.message || String(err), "error");
  }
});

backBtn.addEventListener("click", showLanding);

dlHtmlBtn.addEventListener("click", async () => {
  if (!state.points) return;
  dlHtmlBtn.disabled = true;
  try {
    const html = await buildReplayHtml(
      state.points,
      state.title,
      state.dateLabel
    );
    const slug = state.downloadSlug || "replay";
    downloadText(`${slug}_replay.html`, html);
  } catch (err) {
    alert("Download failed: " + (err.message || err));
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
  const slug = state.downloadSlug || "replay";
  await downloadCanvasPng(posterCanvas, `${slug}_poster.png`);
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

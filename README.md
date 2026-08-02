# Paddle Replay

Interactive map replay for Garmin FIT activity files — SUP, kayak, canoe, outrigger, dragon boat, and paddling in general.

**Repo / folder:** `paddle-replay` · **Product:** Paddle Replay

**Repo:** https://github.com/jchiu1303/paddle-replay (public)  
**Web app (GitHub Pages):** https://jchiu1303.github.io/paddle-replay/  
**Second brain:** [notes/second-brain-garmin-analysis.md](notes/second-brain-garmin-analysis.md)

## Web app (browser — no install)

Static app in [`docs/`](docs/) — upload a Garmin `.fit` or activity `.zip`, play the map replay, download HTML or a social **poster PNG**.

| | |
|--|--|
| **Privacy** | All parsing runs **in your browser**. Files are never uploaded to a server. |
| **Share** | Download self-contained `*_replay.html` · poster PNG + caption for IG/X · link others to the app |
| **Local preview** | `cd docs && python3 -m http.server 8877` → http://127.0.0.1:8877/ |

### Enable GitHub Pages

1. Repo **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` · folder: **`/docs`**
4. Save → site at `https://jchiu1303.github.io/paddle-replay/`

## Privacy model

| Location | What's there |
|----------|----------------|
| **GitHub (public)** | `docs/` web app, `demo/replay.html` (synthetic only), source code |
| **Visitor browser** | Their own FIT/zip — processed locally, not stored by us |
| **Local machine (you)** | Real `.fit` files under `Dragonboat/`, real replays (gitignored) |

Real session replays under `Dragonboat/**/replay.html` are **gitignored**. Never commit `data/` activity zips.

## Quick start (Python CLI)

```bash
pip install -r requirements.txt

# Try the public demo (synthetic data)
open demo/replay.html

# Build a replay from your own FIT file (stays local, gitignored)
python3 generate_replay.py path/to/ACTIVITY.fit --date "22 Jun 2026"
open replay.html
```

## Interactive replay (`replay.html`)

Self-contained HTML file — share via email, Drive, or static hosting. Recipients only need a browser and internet (for map tiles).

### Features

| Feature | Description |
|---------|-------------|
| **Satellite map** | Esri imagery with full route (gray) and active trail (green) |
| **Boat marker** | Red dot with live speed badge, interpolated between GPS points |
| **Speed chart** | Time (HKT) vs speed; click to jump; cursor synced with map |
| **Play / pause** | Smooth animation with interpolated position |
| **Playback speeds** | 0.25×, 0.5×, 1×, 2×, 4× — 1× = full session in ~2 minutes |
| **Stats panel** | Time, speed, stroke rate, distance — all synced |
| **Timezone** | FIT timestamps converted to Hong Kong Time (UTC+8) |

### Controls

- **Slider** — scrub to any point (snaps to GPS records)
- **Play** — smooth replay; pausing syncs the slider to current position
- **Chart click** — jump map + stats to that moment
- **Speed buttons** — change replay rate (can switch mid-play)

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| Space | Play / pause |
| ← → | Step slider one GPS point |
| 1–5 | Playback speed 0.25×, 0.5×, 1×, 2×, 4× |

### Sharing

The repo publishes **`demo/replay.html`** only — a synthetic route for showing how the viewer works.

For real sessions, generate `replay.html` locally and share that file directly (email, Drive). Real replays, `.fit` files, and CSV exports are gitignored and never pushed.

## Generator options

```bash
python3 generate_replay.py <path/to/ACTIVITY.fit> [options]
python3 generate_replay.py --demo [options]

  -o, --output PATH   Output HTML path
  --demo              Synthetic demo data (default output: demo/replay.html)
  --title TEXT        Page title
  --date TEXT         Date label in header
```

## Project layout

```
paddle-replay/
├── docs/                       # GitHub Pages web app (upload → replay → share)
│   ├── index.html
│   ├── app.js / fit-loader.js / replay-engine.js / poster.js
│   └── replay-standalone.js    # embedded into downloaded HTML
├── generate_replay.py          # CLI entry point
├── fit_data.py                 # Load FIT / demo points
├── html_builder.py             # Assemble self-contained HTML
├── templates/                  # CLI replay.html, .css, .js
├── demo/replay.html            # Public demo (synthetic data)
├── requirements.txt
├── README.md
├── .gitignore                  # Excludes real .fit, data/, session replays
└── Dragonboat/                 # Your real sessions (local only)
```

## Data notes

- Garmin records the activity under **stand_up_paddleboarding / SUP** profile
- FIT `record` timestamps are **UTC**; replay displays **HKT**
- Record sampling is irregular (~1–10 s), not fixed 1 Hz
- Speed is from `enhanced_speed` (m/s → km/h in output)

## Dependencies (runtime)

Loaded from CDN inside `replay.html` (no install for viewers):

- [Leaflet](https://leafletjs.com/) 1.9.4 — map
- Esri World Imagery — satellite tiles

## Git workflow

```bash
# After local changes to code or demo
git add generate_replay.py demo/replay.html README.md .gitignore requirements.txt
git commit -m "Describe your change"
git push origin main

# Regenerate public demo after generator changes
python3 generate_replay.py --demo
git add demo/replay.html && git commit -m "Update demo replay" && git push
```

Never `git add Dragonboat/` — real activity data stays local.

## Example: 22 Jun 2026 session (local)

```bash
python3 generate_replay.py Dragonboat/20260622/23339425024_ACTIVITY.fit --date "22 Jun 2026"
# Writes Dragonboat/20260622/replay.html (gitignored)
```

Optional local analysis exports (also gitignored): `analysis_records.csv`, `analysis_laps.csv`, PNG charts.
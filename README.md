# Garmin Dragon Boat Analysis

Interactive replay and analysis for Garmin FIT activity files (SUP / paddling profile).

## Quick start

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
garmin-analysis/
├── generate_replay.py          # FIT → interactive HTML generator
├── demo/replay.html            # Public demo (synthetic data)
├── requirements.txt
├── README.md
├── .gitignore                  # Excludes real .fit, CSVs, session replays
└── Dragonboat/                 # Your real sessions (local only)
    └── 20260622/
        ├── replay.html                # Gitignored
        ├── *.fit                      # Gitignored
        └── analysis_*                 # Gitignored
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
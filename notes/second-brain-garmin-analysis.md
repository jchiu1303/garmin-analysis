# Garmin Dragon Boat Analysis — Second Brain

**Tags:** #garmin #dragonboat #fit #gps #side-project #data-viz  
**Status:** Active  
**Last updated:** 2026-06-24  
**Repo:** https://github.com/jchiu1303/garmin-analysis (public)

---

## TL;DR

Turn Garmin FIT files (recorded as SUP/paddling) into a **self-contained interactive HTML replay**: satellite map + speed chart + play/pause, synced in Hong Kong time. One Python script (`generate_replay.py`) builds everything. **Real session data stays local**; GitHub only ships a **synthetic demo**.

---

## Why this exists

- Analyze dragon boat sessions beyond what Garmin Connect shows
- Scrub/play through route + speed together (Garmin-style replay)
- Share the **tool** publicly without exposing real training routes to competition
- Similar visibility to Strava is acceptable for direct shares; public GitHub repo should not leak raw FIT/CSV or real `replay.html`

---

## Key decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Public repo content | **Option B** — demo only | Real `replay.html` was removed; git history rewritten. Competitors shouldn't scrape route from GitHub |
| Real replay sharing | Local HTML file, email/Drive | `replay.html` embeds GPS — share intentionally, not via git |
| Playback speed | 1× = ~2 min full session | Not wall-clock real time (98 min session); 0.25–4× relative to that |
| Timezone | HKT (UTC+8) | FIT `record` timestamps are UTC; `local_timestamp` in FIT confirms +8h |
| Map tiles | Esri satellite + Leaflet CDN | Needs internet; fine for sharing HTML |

---

## Project paths

```
~/Projects/GrokBuild/garmin-analysis/
├── generate_replay.py     # Source of truth — edit features here, regenerate HTML
├── demo/replay.html       # PUBLIC — synthetic route (committed)
├── Dragonboat/20260622/
│   ├── 23339425024_ACTIVITY.fit   # LOCAL — raw Garmin export
│   ├── replay.html                # LOCAL — real interactive replay (gitignored)
│   ├── analysis_records.csv       # LOCAL — 1,294 rows, gitignored
│   ├── analysis_laps.csv          # LOCAL — 11 laps, gitignored
│   └── *.png                      # LOCAL — static charts, gitignored
```

---

## Commands cheat sheet

```bash
cd ~/Projects/GrokBuild/garmin-analysis
pip install -r requirements.txt

# Real session (local, gitignored output)
python3 generate_replay.py Dragonboat/20260622/23339425024_ACTIVITY.fit \
  --date "22 Jun 2026" \
  -o Dragonboat/20260622/replay.html
open Dragonboat/20260622/replay.html

# Public demo (for GitHub)
python3 generate_replay.py --demo

# Git (never add Dragonboat/ or *.fit)
git add generate_replay.py demo/replay.html README.md notes/
git commit -m "..." && git push origin main
```

---

## Replay features (built iteratively)

### Map
- Satellite imagery, gray full route, green trail to current point
- Red boat marker with speed badge (interpolated between GPS points)

### Speed chart
- Canvas line chart: HKT time vs km/h
- Red cursor synced with map (CSS transform — not redrawn every frame)
- Click chart to jump

### Playback
- Play/pause, slider scrub
- Speeds: 0.25×, 0.5×, 1×, 2×, 4× (1× ≈ 2 min for full session)
- Smooth animation via `requestAnimationFrame` + GPS interpolation

### Keyboard shortcuts
| Key | Action |
|-----|--------|
| Space | Play / pause |
| ← → | Step one GPS point |
| 1–5 | 0.25×, 0.5×, 1×, 2×, 4× |

### Stats panel
Time (HKT), speed, stroke rate (spm), distance — all synced

---

## Data model (FIT file)

| Field | Notes |
|-------|-------|
| Sport | `stand_up_paddleboarding` / SUP |
| Timestamps | UTC in file → display as HKT |
| Sampling | ~1,294 records over ~98 min; irregular (~1–10 s), not 1 Hz |
| Speed | `enhanced_speed` m/s → km/h |
| Cadence | Stroke rate spm (not every point has cadence) |
| Laps | 10 × 1 km + partial; lap 8 had ~7 min rest (not fitness drop) |

### Example session — 22 Jun 2026 (local)
- **Wall clock:** 19:29–21:08 HKT
- **Distance:** 10.30 km
- **Duration:** 1:38:47
- **Avg speed:** ~6.26 km/h (4:47/500m)
- **Avg HR:** 146 bpm (from earlier analysis)
- **Location:** Hong Kong waters (~22.24°N, 114.19°E)

---

## Technical gotchas (learned)

1. **Play-after-scrub jump (~4 min):** Playback used slider *index* as time progress, but GPS points aren't evenly spaced in time. **Fix:** anchor play to `POINTS[idx].elapsed` (real seconds), not index ratio.

2. **Don't commit real data to public repo:** Even after deleting files, old commits remain until history rewrite (`git checkout --orphan` + force push was used).

3. **`replay.html` is self-contained:** All points embedded as JSON — ~160–180 KB per session. No server needed; needs CDN for Leaflet + map tiles.

4. **Regenerate after editing `generate_replay.py`:** HTML is generated output, not hand-edited.

---

## Git history (high level)

| Commit | What |
|--------|------|
| `fac2317` | Initial public repo — demo only, clean history |
| `1968695` | README privacy model + git workflow |
| `5bc2d3b` | Play/scrub fix + keyboard shortcuts |

---

## Future ideas (not built)

- HR overlay on chart
- Pace (min/500m) on chart
- Click route on map to jump
- Speed-colored trail (replaced by separate chart per user preference)
- GitHub Pages URL for demo
- Fully offline HTML (bundle Leaflet, no CDN)

---

## Related

- Garmin export: activity FIT from watch (SUP profile)
- Strava: similar route visibility — acceptable for intentional sharing
- Python dep: `fitparse` only
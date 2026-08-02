# Paddle Replay  — Second Brain

**Tags:** #garmin #dragonboat #fit #gps #side-project #data-viz  
**Status:** Active  
**Last updated:** 2026-06-25  
**Repo:** https://github.com/jchiu1303/paddle-replay (public)

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
~/Projects/GrokBuild/paddle-replay/
├── generate_replay.py     # Source of truth — edit features here, regenerate HTML
├── demo/replay.html       # PUBLIC — synthetic route (committed)
├── Dragonboat/20260622/
│   ├── 23339425024_ACTIVITY.fit   # LOCAL — raw Garmin export
│   ├── 20260622_replay.html       # LOCAL — real interactive replay (gitignored)
│   ├── analysis_records.csv       # LOCAL — 1,294 rows, gitignored
│   ├── analysis_laps.csv          # LOCAL — 11 laps, gitignored
│   └── *.png                      # LOCAL — static charts, gitignored
├── Dragonboat/20260624/
│   ├── 23363712085_ACTIVITY.fit
│   └── 20260624_replay.html       # 375 GPS points
```

---

## Commands cheat sheet

```bash
cd ~/Projects/GrokBuild/paddle-replay
pip install -r requirements.txt

# Real session (local, gitignored output)
# Default output: Dragonboat/<folder>/<folder>_replay.html
python3 generate_replay.py Dragonboat/20260624/23363712085_ACTIVITY.fit --date "24 Jun 2026"
open Dragonboat/20260624/20260624_replay.html

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

## Garmin export & scheduling

**Garmin Connect has no built-in scheduled export** to a local folder. Activities sync to the cloud automatically; getting `.fit` files locally is a separate step.

| Method | Scheduled? | Notes |
|--------|------------|-------|
| Per-activity export (Connect web → activity → ⋮ → Export Original) | No | Best source — original `.fit` with full fields |
| Account data export (Connect → Settings → Export Your Data) | No | One-time ZIP request; Garmin emails when ready (hours). Not recurring |
| Watch/phone sync | Auto-upload only | Syncs to Garmin cloud; does **not** drop `.fit` files on Mac |

### Current workflow (manual)

1. Export `.fit` from Garmin Connect after a session
2. Save to `Dragonboat/YYYYMMDD/`
3. Run `generate_replay.py` → `YYYYMMDD_replay.html`

### Automation options (not built)

| Approach | Pros | Cons |
|----------|------|------|
| **Python + `garminconnect` / `garth`** + cron/launchd | Fits this repo; can chain replay generation | Unofficial API; credentials stored locally |
| **Copy from watch** (`GARMIN/ACTIVITY/` when plugged in) | True original FIT | Only when device connected |
| **Strava API** (if Garmin → Strava sync on) | Easy scheduled pull | Often less complete than original FIT |

**Likely next step:** `fetch_garmin.py` — download new activities since last run, save to `Dragonboat/YYYYMMDD/`, optionally run `generate_replay.py`. Schedule daily via cron or launchd. Credentials in local config only (gitignored).

---

## Future ideas (not built)

- `fetch_garmin.py` — automated FIT download + replay generation (see above)
- HR overlay on chart
- Pace (min/500m) on chart
- Click route on map to jump
- Speed-colored trail (replaced by separate chart per user preference)
- GitHub Pages URL for demo
- Fully offline HTML (bundle Leaflet, no CDN)

---

## Related

- Garmin export: manual FIT from Connect (SUP profile); no native scheduler — see **Garmin export & scheduling**
- Strava: similar route visibility — acceptable for intentional sharing
- Python dep: `fitparse` only
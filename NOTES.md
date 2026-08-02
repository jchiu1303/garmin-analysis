# NOTES — garmin-analysis

Handoff for new sessions.

## Now (2026-08-02)
- FIT → interactive dragon boat replay HTML — **stable** (Python CLI)
- **Web app (MVP A)** in `docs/` — browser upload FIT/zip → replay → download HTML + poster PNG
- Landing styled like GitHub Pages **Cayman** theme (static CSS, still `.nojekyll` SPA)
- Local preview: `cd docs && python3 -m http.server 8877` → http://127.0.0.1:8877/
- Live: https://jchiu1303.github.io/garmin-analysis/
- Privacy: client-side only; FIT/JSZip **vendored** under `docs/vendor/`
- Real sessions under `Dragonboat/` (local); inbox zips in `data/` (gitignored)

## Local sessions
| Date (HKT) | Folder | Replay |
|------------|--------|--------|
| 22 Jun 2026 | `Dragonboat/20260622/` | `replay.html` |
| 24 Jun 2026 | `Dragonboat/20260624/` | `20260624_replay.html` |
| 4 Jul 2026 | `Dragonboat/20260704/` | `20260704_replay.html` |
| 11 Jul 2026 10:22 | `Dragonboat/20260711/` | `20260711_1022_replay.html` |
| 11 Jul 2026 13:37 | `Dragonboat/20260711/` | `20260711_1337_replay.html` |
| 30 Jul 2026 | `Dragonboat/20260730/` | `20260730_replay.html` |
| 1 Aug 2026 | `Dragonboat/20260801/` | `20260801_replay.html` |

## Next
- [ ] Enable GitHub Pages (`main` → `/docs`) + smoke on github.io
- [ ] Commit + push `docs/`, README, NOTES, .gitignore
- [ ] Optional later: short video export; hosted share links (needs backend)

## Don’t redo
- Playback scrub uses elapsed-time anchor (brain: fit-playback-elapsed-anchor)
- Never push real GPS under `Dragonboat/` or `data/`

## New session prompt
```
Read garmin-analysis/NOTES.md and continue. Pages app in docs/; enable Pages if not live.
```

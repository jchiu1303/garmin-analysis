"""Assemble a self-contained replay HTML file from templates."""

import json
from pathlib import Path

from fit_data import session_meta

TEMPLATES_DIR = Path(__file__).parent / "templates"


def _load_template(name: str) -> str:
    return (TEMPLATES_DIR / name).read_text()


def build_replay_html(points: list[dict], title: str, date_label: str) -> str:
    meta = session_meta(points, date_label)
    js = _load_template("replay.js").replace("__POINTS_JSON__", json.dumps(points))

    html = _load_template("replay.html")
    replacements = {
        "{{TITLE}}": title,
        "{{DATE}}": meta["date"],
        "{{START}}": meta["start"],
        "{{END}}": meta["end"],
        "{{TOTAL_KM}}": str(meta["total_km"]),
        "{{SLIDER_MAX}}": str(meta["slider_max"]),
        "{{CSS}}": _load_template("replay.css"),
        "{{JS}}": js,
    }
    for key, value in replacements.items():
        html = html.replace(key, value)
    return html
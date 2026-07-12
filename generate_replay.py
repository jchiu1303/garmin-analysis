#!/usr/bin/env python3
"""Generate an interactive HTML map replay from a Garmin FIT file."""

import argparse
from pathlib import Path

from fit_data import demo_points, load_points
from html_builder import build_replay_html


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("fit_file", type=Path, nargs="?", help="Path to .fit activity file")
    parser.add_argument("-o", "--output", type=Path, help="Output HTML path")
    parser.add_argument("--title", default="Dragon Boat Replay")
    parser.add_argument("--date", help="Date label shown in header")
    parser.add_argument("--demo", action="store_true", help="Synthetic demo data (no FIT file)")
    args = parser.parse_args()

    if args.demo:
        points = demo_points()
        date_label = args.date or "Demo session"
        title = args.title if args.title != "Dragon Boat Replay" else "Dragon Boat Replay (Demo)"
        output = args.output or Path("demo/replay.html")
    else:
        if not args.fit_file:
            raise SystemExit("Provide a FIT file, or pass --demo for synthetic data")
        points = load_points(args.fit_file)
        if not points:
            raise SystemExit("No GPS points found in FIT file")
        date_slug = args.fit_file.parent.name
        date_label = args.date or date_slug
        title = args.title
        output = args.output or args.fit_file.parent / f"{date_slug}_replay.html"

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(build_replay_html(points, title, date_label))
    print(f"Wrote {output} ({len(points)} points)")


if __name__ == "__main__":
    main()
"""Load GPS track points from FIT files or generate demo data."""

import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import fitparse

HK = ZoneInfo("Asia/Hong_Kong")
SEMICIRCLES_TO_DEG = 180 / 2**31


def _make_point(
    time_str: str,
    elapsed: float,
    lat: float,
    lon: float,
    speed_kmh: float,
    cadence: int,
    distance_m: float,
) -> dict:
    return {
        "t": time_str,
        "elapsed": round(elapsed, 1),
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "speed": round(speed_kmh, 2),
        "cadence": cadence,
        "distance": round(distance_m, 1),
    }


def session_meta(points: list[dict], date_label: str) -> dict:
    return {
        "date": date_label,
        "start": points[0]["t"],
        "end": points[-1]["t"],
        "total_km": round(points[-1]["distance"] / 1000, 2),
        "count": len(points),
        "slider_max": len(points) - 1,
    }


def load_points(fit_path: Path) -> list[dict]:
    points: list[dict] = []
    start_ts = None

    for record in fitparse.FitFile(str(fit_path)).get_messages("record"):
        fields = {field.name: field.value for field in record}
        lat = fields.get("position_lat")
        lon = fields.get("position_long")
        if not lat or not lon:
            continue

        timestamp = fields["timestamp"].replace(tzinfo=timezone.utc).astimezone(HK)
        if start_ts is None:
            start_ts = timestamp

        speed_ms = fields.get("enhanced_speed") or fields.get("speed") or 0
        points.append(
            _make_point(
                time_str=timestamp.strftime("%H:%M:%S"),
                elapsed=(timestamp - start_ts).total_seconds(),
                lat=lat * SEMICIRCLES_TO_DEG,
                lon=lon * SEMICIRCLES_TO_DEG,
                speed_kmh=speed_ms * 3.6,
                cadence=fields.get("cadence") or 0,
                distance_m=fields.get("distance") or 0,
            )
        )

    return points


def demo_points(count: int = 360, duration_sec: float = 2400) -> list[dict]:
    """Synthetic paddling loop for the public demo — not real GPS data."""
    start = datetime(2026, 1, 15, 10, 0, 0, tzinfo=HK)
    center_lat, center_lon = 22.3180, 114.1680
    lat_amp, lon_amp = 0.006, 0.010
    points: list[dict] = []
    distance_m = 0.0

    for i in range(count):
        frac = i / max(count - 1, 1)
        elapsed = frac * duration_sec
        timestamp = start + timedelta(seconds=elapsed)
        angle = frac * 2 * math.pi * 1.2
        lat = center_lat + lat_amp * math.cos(angle)
        lon = center_lon + lon_amp * math.sin(angle)
        speed = max(0, 3 + 8 * abs(math.sin(angle * 2.5)) + 2 * math.sin(frac * 24))

        if i > 0:
            prev = points[-1]
            dlat = (lat - prev["lat"]) * 111_000
            dlon = (lon - prev["lon"]) * 111_000 * math.cos(math.radians(lat))
            distance_m += math.hypot(dlat, dlon)

        cadence = int(38 + 12 * abs(math.sin(angle * 1.8))) if speed > 2 else 0
        points.append(
            _make_point(
                time_str=timestamp.strftime("%H:%M:%S"),
                elapsed=elapsed,
                lat=lat,
                lon=lon,
                speed_kmh=speed,
                cadence=cadence,
                distance_m=distance_m,
            )
        )

    return points
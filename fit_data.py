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
    """Synthetic paddling loop for the public demo — not real GPS data.

    Irregular mid-channel route in Victoria Harbour (open water only).
    Not a perfect ellipse: harmonics + slight lane drift; clamped to a
    conservative water bounding box so no samples sit on land.
    """
    start = datetime(2026, 1, 15, 10, 0, 0, tzinfo=HK)
    # Mid-harbour channel (south of TST, north of Central / Wan Chai)
    center_lat, center_lon = 22.2875, 114.1680
    # Tight water box — every point is forced inside
    lat_min, lat_max = 22.2845, 22.2905
    lon_min, lon_max = 114.1520, 114.1840

    points: list[dict] = []
    distance_m = 0.0

    for i in range(count):
        frac = i / max(count - 1, 1)
        elapsed = frac * duration_sec
        timestamp = start + timedelta(seconds=elapsed)
        # ~1.08 loops; phase π/2 → start mid-channel on the eastern leg (not N/S shore)
        t = frac * 2 * math.pi * 1.08 + math.pi / 2

        # Elongated E–W path with irregular harmonics (not a clean ellipse)
        lon = (
            center_lon
            + 0.0130 * math.sin(t)
            + 0.0028 * math.sin(2.3 * t + 0.4)
            + 0.0014 * math.cos(3.7 * t)
            + 0.0009 * math.sin(5.1 * t + 1.2)
            + 0.0005 * math.cos(frac * math.pi * 2.5)
        )
        lat = (
            center_lat
            + 0.0018 * math.cos(t)
            + 0.0010 * math.sin(2.1 * t + 0.7)
            + 0.0006 * math.cos(4.2 * t + 0.3)
            + 0.00045 * math.sin(6.0 * t)
            + 0.00035 * math.sin(frac * math.pi * 3.0)  # slow lane drift
        )

        lat = min(lat_max, max(lat_min, lat))
        lon = min(lon_max, max(lon_min, lon))

        speed = max(
            0.0,
            3.5
            + 7.0 * abs(math.sin(t * 1.7 + 0.2))
            + 2.5 * math.sin(frac * 18)
            + 1.2 * abs(math.sin(t * 3.3)),
        )

        if i > 0:
            prev = points[-1]
            dlat = (lat - prev["lat"]) * 111_000
            dlon = (lon - prev["lon"]) * 111_000 * math.cos(math.radians(lat))
            distance_m += math.hypot(dlat, dlon)

        cadence = int(38 + 12 * abs(math.sin(t * 1.8))) if speed > 2 else 0
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
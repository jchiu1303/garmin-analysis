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

    Hand-placed mid-channel Victoria Harbour waypoints (open water only),
    interpolated with small irregular offsets so the route is not a clean
    ellipse and never rides the shoreline.
    """
    start = datetime(2026, 1, 15, 10, 0, 0, tzinfo=HK)
    # Mid-channel only: south of TST Star Ferry (~22.294), north of Central
    # piers (~22.282). Stays well clear of reclamation / ferry piers.
    # (lat, lon) — closed loop, west → east → west on a slightly southern return
    waypoints = [
        (22.2892, 114.1585),
        (22.2896, 114.1610),
        (22.2890, 114.1638),
        (22.2888, 114.1665),
        (22.2894, 114.1692),
        (22.2898, 114.1715),
        (22.2893, 114.1738),
        (22.2887, 114.1755),  # eastern turn (still west of Hung Hom shore)
        (22.2880, 114.1740),  # return, slightly south
        (22.2876, 114.1712),
        (22.2878, 114.1685),
        (22.2882, 114.1658),
        (22.2886, 114.1630),
        (22.2889, 114.1605),
        (22.2892, 114.1585),  # close loop
    ]

    points: list[dict] = []
    distance_m = 0.0
    n_seg = len(waypoints) - 1

    for i in range(count):
        frac = i / max(count - 1, 1)
        elapsed = frac * duration_sec
        timestamp = start + timedelta(seconds=elapsed)

        # Position along the waypoint loop (0..n_seg)
        along = frac * n_seg
        seg = min(int(along), n_seg - 1)
        local = along - seg
        # smoothstep for less robotic corners
        u = local * local * (3 - 2 * local)
        lat0, lon0 = waypoints[seg]
        lat1, lon1 = waypoints[seg + 1]
        lat = lat0 + (lat1 - lat0) * u
        lon = lon0 + (lon1 - lon0) * u

        # Small irregular wobble (stays ~tens of metres; mid-channel is wide enough)
        wobble = math.sin(frac * math.pi * 11.3) * 0.00012
        wobble2 = math.cos(frac * math.pi * 7.1 + 0.6) * 0.00010
        lat += wobble
        lon += wobble2

        speed = max(
            0.0,
            4.0
            + 6.5 * abs(math.sin(frac * math.pi * 9 + seg * 0.4))
            + 2.0 * math.sin(frac * 17)
            + 1.0 * abs(math.sin(along * 2.2)),
        )

        if i > 0:
            prev = points[-1]
            dlat = (lat - prev["lat"]) * 111_000
            dlon = (lon - prev["lon"]) * 111_000 * math.cos(math.radians(lat))
            distance_m += math.hypot(dlat, dlon)

        cadence = int(38 + 12 * abs(math.sin(frac * math.pi * 14))) if speed > 2 else 0
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
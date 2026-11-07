"""Build the circuit geometry the website draws, from real timing and map data.

Everything drawn on a circuit page comes from a source that can be checked:

* Track outline, corner numbers and start/finish: the F1 timing track map served by the
  MultiViewer circuit API (the same map FastF1 exposes as ``get_circuit_info``). Positions are
  in the F1 position frame, 1/10 m per unit.
* Sector boundaries and DRS usage zones: OpenF1 qualifying telemetry (lap timestamps,
  ``location`` and ``car_data.drs``), snapped onto the track map. A zone is kept only when at
  least two of the three fastest qualifying laps agree on it.
* Length, number of corners and the Grand Prix distance: official figures typed in
  ``OFFICIAL`` below, each checked against the Wikipedia infobox for the circuit.
* Independent shape check: an MIT-licensed GeoJSON of circuit outlines
  (https://github.com/bacinger/f1-circuits). The two outlines must agree after the best
  similarity transform, or the circuit is reported.

Nothing is invented. When a source has no data for a layout (for example a 2022-only layout has
no OpenF1 telemetry) the field is left ``null`` and the website says so.

Run from the repository root (needs network access; responses are cached in ``tmp/``)::

    .venv\\Scripts\\python.exe scripts\\build_circuit_data.py
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "tmp" / "circuit-cache"
OUT_DIR = ROOT / "ui" / "public" / "data" / "circuits"
INDEX_OUT = ROOT / "ui" / "src" / "data" / "circuits.json"
UA = {"User-Agent": "PaladinF1Podium/1.0 (ACL-903 student project)"}

MV = "https://api.multiviewer.app/api/v1/circuits/{key}/{year}"
OPENF1 = "https://api.openf1.org/v1/"
GEOJSON = "https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson"
WIKI = "https://en.wikipedia.org/w/api.php"

# circuitId is the dataset's id (data/raw/circuits.csv). key is the F1 timing circuit key.
# layouts: (layout id, years raced on it, MultiViewer map year to request, OpenF1 qualifying
# years to try). length_m and turns are the official figures for that layout.
OFFICIAL = [
    dict(circuitId=3, ref="bahrain", key=63, geojson="bh-2002", wiki="Bahrain_International_Circuit",
         layouts=[dict(id="bahrain", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=5412, turns=15)]),
    dict(circuitId=77, ref="jeddah", key=149, geojson="sa-2021", wiki="Jeddah_Corniche_Circuit",
         layouts=[dict(id="jeddah", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=6174, turns=27)]),
    dict(circuitId=1, ref="albert_park", key=10, geojson="au-1953", wiki="Albert_Park_Circuit",
         layouts=[dict(id="albert_park", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=5278, turns=14)]),
    dict(circuitId=21, ref="imola", key=6, geojson="it-1953", wiki="Autodromo_Enzo_e_Dino_Ferrari",
         layouts=[dict(id="imola", years=[2022, 2024], mv=2024, tele=[2024], length_m=4909, turns=19)]),
    dict(circuitId=79, ref="miami", key=151, geojson="us-2022", wiki="Miami_International_Autodrome",
         layouts=[dict(id="miami", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=5412, turns=19)]),
    dict(circuitId=4, ref="catalunya", key=15, geojson="es-1991", wiki="Circuit_de_Barcelona-Catalunya",
         layouts=[dict(id="catalunya-2022", years=[2022], mv=2022, tele=[], length_m=4675, turns=16,
                       note="2022 layout, with the final chicane (turns 14 and 15)."),
                  dict(id="catalunya", years=[2023, 2024], mv=2024, tele=[2024, 2023], length_m=4657, turns=14,
                       note="Layout used from 2023: the final chicane was removed.")]),
    dict(circuitId=6, ref="monaco", key=22, geojson="mc-1929", wiki="Circuit_de_Monaco", distance_km=260,
         layouts=[dict(id="monaco", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=3337, turns=19)]),
    dict(circuitId=73, ref="baku", key=144, geojson="az-2016", wiki="Baku_City_Circuit",
         layouts=[dict(id="baku", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=6003, turns=20)]),
    dict(circuitId=7, ref="villeneuve", key=23, geojson="ca-1978", wiki="Circuit_Gilles_Villeneuve",
         layouts=[dict(id="villeneuve", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=4361, turns=14)]),
    dict(circuitId=9, ref="silverstone", key=2, geojson="gb-1948", wiki="Silverstone_Circuit",
         layouts=[dict(id="silverstone", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=5891, turns=18)]),
    dict(circuitId=70, ref="red_bull_ring", key=19, geojson="at-1969", wiki="Red_Bull_Ring",
         layouts=[dict(id="red_bull_ring", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=4318, turns=10)]),
    dict(circuitId=34, ref="ricard", key=28, geojson="fr-1969", wiki="Circuit_Paul_Ricard",
         layouts=[dict(id="ricard", years=[2022], mv=2022, tele=[], length_m=5842, turns=15)]),
    dict(circuitId=11, ref="hungaroring", key=4, geojson="hu-1986", wiki="Hungaroring",
         layouts=[dict(id="hungaroring", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=4381, turns=14)]),
    dict(circuitId=13, ref="spa", key=7, geojson="be-1925", wiki="Circuit_de_Spa-Francorchamps",
         layouts=[dict(id="spa", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=7004, turns=19)]),
    dict(circuitId=39, ref="zandvoort", key=55, geojson="nl-1948", wiki="Circuit_Zandvoort",
         layouts=[dict(id="zandvoort", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=4259, turns=14)]),
    dict(circuitId=14, ref="monza", key=39, geojson="it-1922", wiki="Monza_Circuit",
         layouts=[dict(id="monza", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=5793, turns=11)]),
    dict(circuitId=15, ref="marina_bay", key=61, geojson="sg-2008", wiki="Marina_Bay_Street_Circuit",
         layouts=[dict(id="marina_bay-2022", years=[2022], mv=None, tele=[], length_m=5063, turns=23,
                       note="2022 layout (23 turns). Its timing map is not available, so no outline is drawn."),
                  dict(id="marina_bay", years=[2023, 2024], mv=2024, tele=[2024, 2023], length_m=4940, turns=19,
                       note="Layout used from 2023: the Singapore Sling chicane was removed.")]),
    dict(circuitId=22, ref="suzuka", key=46, geojson="jp-1962", wiki="Suzuka_International_Racing_Course",
         layouts=[dict(id="suzuka", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=5807, turns=18)]),
    dict(circuitId=69, ref="americas", key=9, geojson="us-2012", wiki="Circuit_of_the_Americas",
         layouts=[dict(id="americas", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=5513, turns=20)]),
    dict(circuitId=32, ref="rodriguez", key=65, geojson="mx-1962", wiki="Aut%C3%B3dromo_Hermanos_Rodr%C3%ADguez",
         layouts=[dict(id="rodriguez", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=4304, turns=17)]),
    dict(circuitId=18, ref="interlagos", key=14, geojson="br-1940", wiki="Aut%C3%B3dromo_Jos%C3%A9_Carlos_Pace",
         layouts=[dict(id="interlagos", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=4309, turns=15)]),
    dict(circuitId=24, ref="yas_marina", key=70, geojson="ae-2009", wiki="Yas_Marina_Circuit",
         layouts=[dict(id="yas_marina", years=[2022, 2023, 2024], mv=2024, tele=[2024, 2023], length_m=5281, turns=16)]),
    dict(circuitId=78, ref="losail", key=150, geojson="qa-2004", wiki="Lusail_International_Circuit",
         layouts=[dict(id="losail", years=[2023, 2024], mv=2024, tele=[2024, 2023], length_m=5419, turns=16)]),
    dict(circuitId=80, ref="vegas", key=152, geojson="us-2023", wiki="Las_Vegas_Strip_Circuit",
         layouts=[dict(id="vegas", years=[2023, 2024], mv=2024, tele=[2024, 2023], length_m=6201, turns=17)]),
    dict(circuitId=17, ref="shanghai", key=49, geojson="cn-2004", wiki="Shanghai_International_Circuit",
         layouts=[dict(id="shanghai", years=[2024], mv=2024, tele=[2024], length_m=5451, turns=16)]),
]

# Circuits that only appear in the walkthrough's historical front-row table. The F1 timing map
# has them (Istanbul) or only the GeoJSON outline does (Magny-Cours, Sepang).
EXTRA = [
    dict(circuitId=2, ref="sepang", geojson="my-1999", outline_only=True),
    dict(circuitId=12, ref="magny_cours", geojson="fr-1960", outline_only=True),
    dict(circuitId=59, ref="istanbul", key=59, geojson="tr-2005", mv=2021),
]

VIEW = 1000.0   # long side of every viewBox
PAD = 78.0
SAMPLES = 360   # equally spaced points used to move markers


# ----------------------------------------------------------------------------- http


def fetch_json(url: str, tag: str, wait: float = 0.45):
    CACHE.mkdir(parents=True, exist_ok=True)
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", tag)[:90] + "-" + hashlib.sha1(url.encode()).hexdigest()[:8] + ".json"
    path = CACHE / name
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    last = None
    for attempt in range(8):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=90) as response:
                data = json.loads(response.read().decode("utf-8"))
            path.write_text(json.dumps(data), encoding="utf-8")
            time.sleep(wait)
            return data
        except urllib.error.HTTPError as error:
            if error.code in (404, 422):
                path.write_text("null", encoding="utf-8")
                return None
            last = error
        except Exception as error:  # noqa: BLE001
            last = error
        time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"failed {url}: {last}")


def openf1(endpoint: str, **params):
    query = "&".join(f"{k}={urllib.parse.quote(str(v), safe=':+-.')}" for k, v in params.items())
    return fetch_json(f"{OPENF1}{endpoint}?{query}", f"openf1-{endpoint}-" + "-".join(str(v) for v in params.values()))


# ----------------------------------------------------------------------------- geometry


def rotate_ccw(points: np.ndarray, degrees: float) -> np.ndarray:
    a = math.radians(degrees)
    c, s = math.cos(a), math.sin(a)
    return np.column_stack([points[:, 0] * c - points[:, 1] * s, points[:, 0] * s + points[:, 1] * c])


def closed_arc(points: np.ndarray):
    loop = np.vstack([points, points[:1]])
    seg = np.hypot(*np.diff(loop, axis=0).T)
    return loop, np.concatenate([[0.0], np.cumsum(seg)])


def locate(points: np.ndarray, query: np.ndarray):
    """Project a point onto the closed polyline; return (arc length, distance to the line)."""
    loop, arc = closed_arc(points)
    a, b = loop[:-1], loop[1:]
    ab = b - a
    denom = (ab ** 2).sum(1)
    denom[denom == 0] = 1e-9
    t = np.clip(((query - a) * ab).sum(1) / denom, 0, 1)
    foot = a + ab * t[:, None]
    dist = np.hypot(*(foot - query).T)
    i = int(dist.argmin())
    return float(arc[i] + t[i] * math.sqrt(denom[i])), float(dist[i])


def point_at(points: np.ndarray, s: float) -> np.ndarray:
    loop, arc = closed_arc(points)
    s = s % arc[-1]
    return np.array([np.interp(s, arc, loop[:, 0]), np.interp(s, arc, loop[:, 1])])


def rdp(points: np.ndarray, eps: float, keep: set[int]) -> list[int]:
    """Ramer-Douglas-Peucker on a closed loop that always keeps the indexes in ``keep``."""
    n = len(points)
    anchors = sorted(keep | {0})
    anchors.append(n)  # loop end (index 0 again)
    kept = []

    def seg(lo: int, hi: int):
        a = points[lo]
        b = points[hi % n]
        idx = np.arange(lo + 1, hi)
        if len(idx) == 0:
            return
        p = points[idx % n]
        ab = b - a
        length = math.hypot(*ab)
        if length < 1e-9:
            d = np.hypot(*(p - a).T)
        else:
            d = np.abs(ab[0] * (p[:, 1] - a[1]) - ab[1] * (p[:, 0] - a[0])) / length
        worst = int(d.argmax())
        if d[worst] > eps:
            m = int(idx[worst])
            seg(lo, m)
            kept.append(m)
            seg(m, hi)

    for lo, hi in zip(anchors[:-1], anchors[1:]):
        kept.append(lo)
        seg(lo, hi)
    return sorted(set(kept))


def smooth_path(points: np.ndarray) -> str:
    """Closed centripetal Catmull-Rom spline as a cubic Bezier SVG path, one decimal."""
    n = len(points)
    f = lambda v: f"{v:.1f}".rstrip("0").rstrip(".")  # noqa: E731
    parts = [f"M{f(points[0, 0])} {f(points[0, 1])}"]
    for i in range(n):
        p0, p1, p2, p3 = points[(i - 1) % n], points[i], points[(i + 1) % n], points[(i + 2) % n]
        d1 = max(math.dist(p0, p1), 1e-6) ** 0.5
        d2 = max(math.dist(p1, p2), 1e-6) ** 0.5
        d3 = max(math.dist(p2, p3), 1e-6) ** 0.5
        # Tangents of a centripetal Catmull-Rom segment, converted to Bezier control points.
        m1 = ((p1 - p0) / d1 - (p2 - p0) / (d1 + d2) + (p2 - p1) / d2) * d2
        m2 = ((p2 - p1) / d2 - (p3 - p1) / (d2 + d3) + (p3 - p2) / d3) * d2
        c1 = p1 + m1 / 3
        c2 = p2 - m2 / 3
        parts.append(f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}")
    parts.append("Z")
    return "".join(parts)


# ----------------------------------------------------------------------------- telemetry


SESSION_ORDER = ["Qualifying", "Sprint Qualifying", "Sprint Shootout", "Practice 3", "Practice 2", "Practice 1"]
MERGE_GAP = 0.012      # runs closer than this fraction of a lap (about 60 m) are one DRS zone
MIN_ZONE_M = 80


def circ_median(values: list[float], length: float) -> float:
    """Median of positions on a circle of the given circumference."""
    ref = values[0]
    shifted = [((v - ref + length / 2) % length) - length / 2 for v in values]
    return (ref + float(np.median(shifted))) % length


def merge_runs(runs: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Union of arcs on the unit circle given as (start, span); arcs closer than MERGE_GAP become one zone."""
    pieces = []
    for start, span in runs:
        start %= 1.0
        stop = start + span
        if stop > 1.0:
            pieces.append([start, 1.0])
            pieces.append([0.0, stop - 1.0])
        else:
            pieces.append([start, stop])
    pieces.sort()
    merged: list[list[float]] = []
    for a, b in pieces:
        if merged and a - merged[-1][1] < MERGE_GAP:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    if len(merged) > 1 and merged[0][0] < MERGE_GAP and 1.0 - merged[-1][1] < MERGE_GAP:
        first = merged.pop(0)
        merged[-1][1] = 1.0 + first[1]  # the zone runs across the start/finish line
    return [(a % 1.0, b - a) for a, b in merged]


def lap_telemetry(session: int, lap: dict, track_raw: np.ndarray):
    from datetime import datetime, timedelta

    fmt = lambda d: d.replace(tzinfo=None).isoformat()  # noqa: E731
    t0 = datetime.fromisoformat(lap["date_start"])
    lo = fmt(t0 - timedelta(seconds=4))
    hi = fmt(t0 + timedelta(seconds=lap["lap_duration"] + 4))
    loc = openf1("location", session_key=session, driver_number=lap["driver_number"], **{"date>": lo, "date<": hi})
    car = openf1("car_data", session_key=session, driver_number=lap["driver_number"], **{"date>": lo, "date<": hi})
    if not loc or not car or len(loc) < 20:
        return None
    ts = np.array([(datetime.fromisoformat(r["date"]) - t0).total_seconds() for r in loc])
    order = np.argsort(ts)
    ts = ts[order]
    lx = np.array([r["x"] for r in loc], float)[order]
    ly = np.array([r["y"] for r in loc], float)[order]
    cts = np.array([(datetime.fromisoformat(r["date"]) - t0).total_seconds() for r in car])
    drs = np.array([r["drs"] for r in car])

    def arc_at(t):
        return locate(track_raw, np.array([np.interp(t, ts, lx), np.interp(t, ts, ly)]))

    s_start, d0 = arc_at(0.0)
    s1, d1 = arc_at(lap["duration_sector_1"])
    s2, d2 = arc_at(lap["duration_sector_1"] + lap["duration_sector_2"])
    on = np.isin(drs, [10, 12, 14])
    runs, i = [], 0
    while i < len(on):
        if on[i]:
            j = i
            while j + 1 < len(on) and on[j + 1]:
                j += 1
            if cts[j] - cts[i] > 0.4:
                runs.append((arc_at(cts[i])[0], arc_at(cts[j])[0]))
            i = j + 1
        else:
            i += 1
    return dict(s_start=s_start, s1=s1, s2=s2, off=max(d0, d1, d2), runs=runs,
                segs=(len(lap.get("segments_sector_1") or []), len(lap.get("segments_sector_2") or [])))


def telemetry_marks(spec, layout, track_raw: np.ndarray, mini: list[int], log):
    """Sector boundaries and DRS zones from the three fastest laps of a dry session, as raw arc positions.

    Sessions are tried in order (qualifying first). A session counts only when DRS opened at least
    once, which rules out wet sessions where DRS is disabled.
    """
    length = float(closed_arc(track_raw)[1][-1])
    for year in layout["tele"]:
        for name in SESSION_ORDER:
            sessions = openf1("sessions", year=year, session_name=name, circuit_key=spec["key"])
            if not sessions:
                continue
            session = sessions[-1]["session_key"]
            laps = openf1("laps", session_key=session)
            if not laps:
                continue
            valid = [l for l in laps if l.get("lap_duration") and not l.get("is_pit_out_lap") and l.get("date_start")
                     and l.get("duration_sector_1") and l.get("duration_sector_2")]
            valid.sort(key=lambda l: l["lap_duration"])
            picked, seen = [], set()
            for lap in valid:
                if lap["driver_number"] not in seen:
                    seen.add(lap["driver_number"])
                    picked.append(lap)
                if len(picked) == 3:
                    break
            per_lap = [r for r in (lap_telemetry(session, lap, track_raw) for lap in picked) if r]
            if not per_lap:
                continue
            if not any(r["runs"] for r in per_lap):
                log(f"    {year} {name}: DRS never opened (wet or disabled), trying the next session")
                continue
            return dict(year=year, session=session, session_name=name, laps=per_lap, length=length)
    return None


def build_marks(tele, track_raw: np.ndarray, mini: list[int]):
    length = tele["length"]
    laps = tele["laps"]
    s_start = circ_median([l["s_start"] for l in laps], length)
    rel = lambda s: ((s - s_start) % length) / length  # noqa: E731
    s1 = [rel(l["s1"]) for l in laps]
    s2 = [rel(l["s2"]) for l in laps]
    spread_m = max(max(s1) - min(s1), max(s2) - min(s2)) * length / 10
    sectors = [float(np.median(s1)), float(np.median(s2))]

    # mini-sector cross-check: sector boundaries sit on the end of the last mini sector of S1 and S2
    cross = None
    segs = laps[0]["segs"]
    if mini and segs[0] and segs[1] and len(mini) >= segs[0] + segs[1]:
        i1, i2 = mini[segs[0] - 1], mini[segs[0] + segs[1] - 1]
        a = locate(track_raw, track_raw[min(i1, len(track_raw) - 1)])[0]
        b = locate(track_raw, track_raw[min(i2, len(track_raw) - 1)])[0]
        cross = max(abs(rel(a) - sectors[0]), abs(rel(b) - sectors[1])) * length / 10

    # DRS: per lap, merge runs into zones; then keep zones that at least two of the laps agree on
    per_lap_zones = []
    for lap in laps:
        runs = [(rel(a), ((b - a) % length) / length) for a, b in lap["runs"]]
        per_lap_zones.append(merge_runs(runs))
    flat = [z for zones in per_lap_zones for z in zones]
    clusters: list[list[tuple[float, float]]] = []
    for z in flat:
        for c in clusters:
            centre = circ_median([x[0] + x[1] / 2 for x in c], 1.0)
            if abs(((z[0] + z[1] / 2 - centre + 0.5) % 1) - 0.5) < 0.05:
                c.append(z)
                break
        else:
            clusters.append([z])
    need = 2 if len(laps) >= 3 else 1
    drs = []
    for c in clusters:
        if len(c) < need:
            continue
        start = circ_median([x[0] for x in c], 1.0)
        span = float(np.median([x[1] for x in c]))
        if span * length / 10 < MIN_ZONE_M:
            continue
        drs.append(dict(from_=start % 1, to=(start + span) % 1, agree=len(c), of=len(laps), length_m=round(span * length / 10)))
    drs.sort(key=lambda d: d["from_"])
    return dict(s_start_raw=s_start, sectors=sectors, spread_m=spread_m, mini_cross_m=cross,
                drs=drs, year=tele["year"], session=tele["session"], session_name=tele["session_name"], laps_used=len(laps))


# ----------------------------------------------------------------------------- shape check


def similarity_error(a: np.ndarray, b: np.ndarray, n: int = 360) -> float:
    """Best similarity fit of outline a onto b (any start, direction, no reflection): RMS / size."""
    def resample(p):
        loop, arc = closed_arc(p)
        t = np.linspace(0, arc[-1], n, endpoint=False)
        return np.column_stack([np.interp(t, arc, loop[:, 0]), np.interp(t, arc, loop[:, 1])])

    A, B = resample(a), resample(b)

    def umeyama(src, dst):
        mu_s, mu_d = src.mean(0), dst.mean(0)
        s0, d0 = src - mu_s, dst - mu_d
        U, D, Vt = np.linalg.svd(d0.T @ s0 / len(src))
        S = np.eye(2)
        if np.linalg.det(U) * np.linalg.det(Vt) < 0:
            S[1, 1] = -1
        R = U @ S @ Vt
        scale = (D * np.diag(S)).sum() / ((s0 ** 2).sum() / len(src))
        return scale, R, mu_d - scale * R @ mu_s

    def rms(base, sh):
        moved = np.roll(base, sh, axis=0)
        scale, R, t = umeyama(moved, B)
        fit = (scale * (R @ moved.T)).T + t
        return math.sqrt(((fit - B) ** 2).sum(1).mean())

    best = (9e9, False, 0)
    for rev in (False, True):
        base = A[::-1] if rev else A
        for sh in range(0, n, 6):
            r = rms(base, sh)
            if r < best[0]:
                best = (r, rev, sh)
    _, rev, sh0 = best
    base = A[::-1] if rev else A
    for sh in range(sh0 - 6, sh0 + 7):
        best = min(best, (rms(base, sh % n), rev, sh % n))
    return best[0] / math.sqrt(((B - B.mean(0)) ** 2).sum(1).mean())


def geojson_xy(feature) -> np.ndarray:
    coords = feature["geometry"]["coordinates"]
    lat0 = np.mean([c[1] for c in coords])
    k = math.cos(math.radians(lat0))
    return np.array([[lon * k * 111320.0, lat * 110540.0] for lon, lat, *_ in coords])


def wiki_check(spec, layout) -> dict:
    """Does the Wikipedia infobox for the circuit contain the official length and turn count?"""
    query = urllib.parse.urlencode({"action": "query", "titles": urllib.parse.unquote(spec["wiki"]), "prop": "revisions",
                                    "rvprop": "content", "rvslots": "main", "format": "json", "redirects": 1, "formatversion": 2})
    data = fetch_json(f"{WIKI}?{query}", f"wiki-{spec['ref']}")
    try:
        text = data["query"]["pages"][0]["revisions"][0]["slots"]["main"]["content"]
    except (TypeError, KeyError, IndexError):
        return dict(checked=False)
    km = f"{layout['length_m'] / 1000:.3f}"
    turns = layout["turns"]
    length_found = bool(re.search(r"length\w*\s*=\s*" + re.escape(km), text)) or km in text
    turns_found = bool(re.search(r"turns\w*\s*=\s*" + str(turns) + r"(?!\d)", text))
    return dict(checked=True, lengthFound=length_found, turnsFound=turns_found)


# ----------------------------------------------------------------------------- build


def build_layout(spec, layout, geo, log):
    mv_year = layout["mv"]
    data = fetch_json(MV.format(key=spec["key"], year=mv_year), f"mv-{spec['key']}-{mv_year}")
    if not data or not data.get("x"):
        return None
    raw = np.column_stack([data["x"], data["y"]]).astype(float)           # F1 frame, y up, 1/10 m
    corners_raw = [(c["number"], np.array([c["trackPosition"]["x"], c["trackPosition"]["y"]], float)) for c in data["corners"] or []]
    mini = data.get("miniSectorsIndexes") or []
    length_raw = float(closed_arc(raw)[1][-1])

    tele = telemetry_marks(spec, layout, raw, mini, log) if layout["tele"] else None
    marks = build_marks(tele, raw, mini) if tele else None
    s_start = marks["s_start_raw"] if marks else 0.0
    rel = (lambda s: ((s - s_start) % length_raw) / length_raw)

    # display frame: rotate as the F1 broadcast map does, flip y for SVG, fit to the viewBox
    rotation = float(data.get("rotation") or 0.0)
    disp = rotate_ccw(raw, rotation) * [1, -1]
    corner_pts = rotate_ccw(np.array([p for _, p in corners_raw]), rotation) * [1, -1] if corners_raw else np.zeros((0, 2))
    mn, mx = disp.min(0), disp.max(0)
    scale = (VIEW - 2 * PAD) / max(mx - mn)
    shift = lambda p: (p - mn) * scale + PAD  # noqa: E731
    disp = shift(disp)
    corner_pts = shift(corner_pts) if len(corner_pts) else corner_pts
    width = float((mx - mn)[0] * scale + 2 * PAD)
    height = float((mx - mn)[1] * scale + 2 * PAD)

    # rebuild the loop so that arc position 0 is the start/finish line
    loop, arc = closed_arc(disp)
    total = float(arc[-1])
    s0 = (s_start / length_raw) * total
    # keep native vertex density where the car was slow: merge the original vertices in
    native = []
    for i in range(len(disp)):
        rel_s = (arc[i] - s0) % total
        native.append((rel_s, disp[i]))
    native = sorted([n for n in native if 0.8 < n[0] < total - 0.8], key=lambda t: t[0])
    sf = point_at(disp, s0)
    pts = np.vstack([sf] + [p for _, p in native])
    pts_arc = closed_arc(pts)[1]
    simp = rdp(pts, 0.55, set())
    path_pts = pts[simp]
    path = smooth_path(path_pts)
    thumb = smooth_path(pts[rdp(pts, 2.6, set())])

    # equally spaced samples for animation (start/finish first)
    pl, pa = closed_arc(pts)
    sample_s = np.linspace(0, pa[-1], SAMPLES, endpoint=False)
    samples = [[round(float(np.interp(s, pa, pl[:, 0])), 1), round(float(np.interp(s, pa, pl[:, 1])), 1)] for s in sample_s]

    # heading at the start line (for the finish-line tick)
    ahead = point_at(pts, 0.0 + 0.012 * pa[-1])
    behind = point_at(pts, pa[-1] - 0.012 * pa[-1])
    heading = math.degrees(math.atan2(ahead[1] - behind[1], ahead[0] - behind[0]))

    # direction of travel on screen (y down): positive shoelace = clockwise
    x, y = pts[:, 0], pts[:, 1]
    area = float((x * np.roll(y, -1) - np.roll(x, -1) * y).sum())
    direction = "clockwise" if area > 0 else "anticlockwise"

    # corner labels: outside of the bend, relaxed so numbers do not collide
    corners = []
    for (number, _), cp in zip(corners_raw, corner_pts):
        s, _dist = locate(pts, cp)
        f = s / pa[-1]
        a = point_at(pts, s - 0.01 * pa[-1])
        b = point_at(pts, s + 0.01 * pa[-1])
        c = point_at(pts, s)
        tangent = (b - a) / (np.hypot(*(b - a)) or 1)
        turn = float((c[0] - a[0]) * (b[1] - c[1]) - (c[1] - a[1]) * (b[0] - c[0]))
        left = np.array([tangent[1], -tangent[0]])
        outward = left if turn >= 0 else -left   # outside of a right turn is the left side
        corners.append(dict(n=int(number), s=f, c=c, out=outward))
    labels = [k["c"] + k["out"] * 36 for k in corners]
    for _ in range(40):
        moved = False
        for i in range(len(labels)):
            for j in range(i + 1, len(labels)):
                d = labels[i] - labels[j]
                dist = math.hypot(*d)
                if dist < 30:
                    push = (d / (dist or 1)) * (30 - dist) / 2 if dist else np.array([0.0, 1.0])
                    labels[i] = labels[i] + push
                    labels[j] = labels[j] - push
                    moved = True
        if not moved:
            break
    out_corners = [dict(n=k["n"], s=round(float(k["s"]), 4), x=round(float(k["c"][0]), 1), y=round(float(k["c"][1]), 1),
                        lx=round(float(l[0]), 1), ly=round(float(l[1]), 1)) for k, l in zip(corners, labels)]
    out_corners.sort(key=lambda c: c["s"])
    numbers = [c["n"] for c in out_corners]
    corners_note = None
    if len(set(numbers)) != len(numbers):
        corners_note = "The timing map lists duplicate corner numbers for this circuit, so none are drawn."
        log(f"  {layout['id']}: duplicate corner numbers {sorted(n for n in set(numbers) if numbers.count(n) > 1)}, labels dropped")
        out_corners = []

    # verification
    geo_error = None
    if geo is not None:
        try:
            geo_error = similarity_error(raw, geojson_xy(geo))
        except Exception as error:  # noqa: BLE001
            log(f"  shape check failed: {error}")
    length_check = length_raw / 10 / layout["length_m"] - 1
    max_corner = max(numbers, default=0)

    sectors = None
    drs = None
    marks_info = None
    if marks:
        sectors = [round(v, 4) for v in marks["sectors"]]
        drs = [dict(from_=round(z["from_"], 4), to=round(z["to"], 4), lengthM=z["length_m"], agree=z["agree"]) for z in marks["drs"]]
        for z in drs:
            z["from"] = z.pop("from_")
        marks_info = dict(source="OpenF1 telemetry", year=marks["year"], sessionName=marks["session_name"], session=marks["session"],
                          lapsUsed=marks["laps_used"], sectorSpreadM=round(marks["spread_m"], 1),
                          miniSectorCrossCheckM=None if marks["mini_cross_m"] is None else round(marks["mini_cross_m"], 1))

    return dict(
        id=layout["id"], circuitId=spec["circuitId"], ref=spec["ref"], years=layout["years"],
        viewBox=[round(width, 1), round(height, 1)],
        path=path, thumb=thumb, samples=samples,
        start=dict(x=round(float(sf[0]), 1), y=round(float(sf[1]), 1), heading=round(heading, 1)),
        direction=direction, corners=out_corners, cornersNote=corners_note, sectors=sectors, drs=drs,
        metersPerUnit=round(0.1 / scale, 3),
        source=dict(outline="MultiViewer circuit API (F1 timing track map)", mapYear=int(data["year"]), rotation=rotation,
                    candidateLap=(data.get("candidateLap") or {}).get("session"), marks=marks_info),
        verification=dict(
            lengthOfficialM=layout["length_m"], lengthFromOutlineM=round(length_raw / 10),
            lengthDeviationPct=round(length_check * 100, 2),
            turnsOfficial=layout["turns"], cornersOnMap=len(out_corners), highestCornerNumber=max_corner,
            cornerEntriesInSource=len(numbers),
            geojsonShapeErrorPct=None if geo_error is None else round(geo_error * 100, 2),
        ),
    )


def main() -> int:
    log = lambda *a: print(*a, flush=True)  # noqa: E731
    geo_all = fetch_json(GEOJSON, "geojson-bacinger")
    geo = {f["properties"]["id"]: f for f in geo_all["features"]}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index = []
    report = []

    for spec in OFFICIAL:
        log(f"{spec['ref']} ({spec['key']})")
        layouts_meta = []
        for layout in spec["layouts"]:
            if layout["mv"] is None:
                layouts_meta.append(dict(id=layout["id"], years=layout["years"], file=None, lengthM=layout["length_m"],
                                         turns=layout["turns"], note=layout.get("note")))
                continue
            built = build_layout(spec, layout, geo.get(spec["geojson"]), log)
            if built is None:
                layouts_meta.append(dict(id=layout["id"], years=layout["years"], file=None, lengthM=layout["length_m"],
                                         turns=layout["turns"], note=layout.get("note")))
                continue
            v = built["verification"]
            v["wikipedia"] = wiki_check(spec, layout)
            marks = built["source"]["marks"]
            (OUT_DIR / f"{layout['id']}.json").write_text(json.dumps(built, separators=(",", ":")), encoding="utf-8")
            log(f"  {layout['id']}: length {v['lengthDeviationPct']:+.1f}% corners {v['cornersOnMap']}/{v['turnsOfficial']} "
                f"(max #{v['highestCornerNumber']}) shape {v['geojsonShapeErrorPct']}% "
                f"sectors {'yes' if built['sectors'] else 'no'} drs {len(built['drs']) if built['drs'] is not None else '-'} "
                f"{'spread %.1fm' % marks['sectorSpreadM'] if marks else ''} {built['direction']} wiki {v['wikipedia']}")
            report.append(dict(layout=layout["id"], **v, direction=built["direction"],
                               sectors=bool(built["sectors"]), drsZones=None if built["drs"] is None else len(built["drs"])))
            layouts_meta.append(dict(id=layout["id"], years=layout["years"], file=f"circuits/{layout['id']}.json",
                                     thumb=built["thumb"], viewBox=built["viewBox"], lengthM=layout["length_m"], turns=layout["turns"], note=layout.get("note"),
                                     direction=built["direction"], hasSectors=bool(built["sectors"]),
                                     drsZones=None if built["drs"] is None else len(built["drs"]),
                                     verification=v, marks=marks))
        index.append(dict(circuitId=spec["circuitId"], ref=spec["ref"], key=spec["key"],
                          distanceKm=spec.get("distance_km", 305), layouts=layouts_meta))

    # circuits that only the walkthrough uses
    for spec in EXTRA:
        geo_feature = geo.get(spec["geojson"])
        if spec.get("outline_only"):
            if geo_feature is None:
                continue
            xy = geojson_xy(geo_feature) * [1, -1]
            mn, mx = xy.min(0), xy.max(0)
            scale = (VIEW - 2 * PAD) / max(mx - mn)
            pts = (xy - mn) * scale + PAD
            width, height = float((mx - mn)[0] * scale + 2 * PAD), float((mx - mn)[1] * scale + 2 * PAD)
            built = dict(id=spec["ref"], circuitId=spec["circuitId"], ref=spec["ref"], years=[], viewBox=[round(width, 1), round(height, 1)],
                         path=smooth_path(pts), thumb=smooth_path(pts[rdp(pts, 2.6, set())]), samples=[], start=None, direction=None, corners=[], sectors=None, drs=None,
                         source=dict(outline="f1-circuits GeoJSON (MIT), traced from satellite imagery", mapYear=None, rotation=0, candidateLap=None, marks=None),
                         verification=dict(lengthOfficialM=geo_feature["properties"]["length"]))
            (OUT_DIR / f"{spec['ref']}.json").write_text(json.dumps(built, separators=(",", ":")), encoding="utf-8")
            index.append(dict(circuitId=spec["circuitId"], ref=spec["ref"], key=None, distanceKm=305, outlineOnly=True,
                              layouts=[dict(id=spec["ref"], years=[], file=f"circuits/{spec['ref']}.json", thumb=built["thumb"], viewBox=built["viewBox"],
                                            lengthM=geo_feature["properties"]["length"], turns=None, note="Outline only. No corner numbers or timing data.")]))
            log(f"{spec['ref']}: outline only")
        else:
            layout = dict(id=spec["ref"], years=[], mv=spec["mv"], tele=[], length_m=geo_feature["properties"]["length"], turns=14)
            built = build_layout(dict(spec, key=spec["key"]), layout, geo_feature, log)
            if built:
                (OUT_DIR / f"{spec['ref']}.json").write_text(json.dumps(built, separators=(",", ":")), encoding="utf-8")
                index.append(dict(circuitId=spec["circuitId"], ref=spec["ref"], key=spec["key"], distanceKm=305,
                                  layouts=[dict(id=spec["ref"], years=[], file=f"circuits/{spec['ref']}.json", thumb=built["thumb"], viewBox=built["viewBox"],
                                                lengthM=None, turns=len(built["corners"]), note="Historical circuit used in the walkthrough only.")]))
                log(f"{spec['ref']}: {len(built['corners'])} corners, shape {built['verification']['geojsonShapeErrorPct']}%")

    (ROOT / "tmp").mkdir(exist_ok=True)
    (ROOT / "tmp" / "circuit-verification.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    INDEX_OUT.write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")
    log(f"wrote {INDEX_OUT} and {len(list(OUT_DIR.glob('*.json')))} layout files")
    return 0


if __name__ == "__main__":
    sys.exit(main())

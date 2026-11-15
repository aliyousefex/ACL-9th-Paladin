"""Trace the Paladin horse into vector outlines, once, so the favicon is a real drawing and not a shrunken bitmap.

    .venv\\Scripts\\python.exe scripts\\trace_horse.py

Reads ui/public/brand/horse-solid.webp (the filled silhouette, as its alpha mask), finds its outline at four times the
resolution, simplifies it to a few hundred points, and writes scripts/horse_outline.json in the coordinates of a 64 x 64
board: the horse is 60 units tall and centred. scripts/make_icons.py draws every icon from that file. Needs numpy, scipy,
matplotlib and Pillow; it is run when the logo changes, not on every build.
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from scipy.ndimage import gaussian_filter  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "ui" / "public" / "brand" / "horse-solid.webp"
OUTPUT = ROOT / "scripts" / "horse_outline.json"

BOARD = 64
HEIGHT = 60  # the horse's height on the board
UPSCALE = 4  # trace at 4x so the outline is smooth between source pixels
EPSILON = 1.1  # simplification tolerance, in upscaled pixels (about a quarter of a source pixel)
MIN_AREA = 60.0  # drop specks smaller than this, in upscaled pixels squared


def area(ring: np.ndarray) -> float:
    x, y = ring[:, 0], ring[:, 1]
    return 0.5 * float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def simplify_open(points: np.ndarray, epsilon: float) -> np.ndarray:
    """Douglas-Peucker on an open polyline, iteratively."""
    keep = np.zeros(len(points), dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        if last <= first + 1:
            continue
        a, b = points[first], points[last]
        ab = b - a
        length = float(np.hypot(*ab)) or 1e-9
        offsets = np.abs(ab[0] * (points[first + 1 : last, 1] - a[1]) - ab[1] * (points[first + 1 : last, 0] - a[0])) / length
        worst = int(np.argmax(offsets))
        if offsets[worst] > epsilon:
            mid = first + 1 + worst
            keep[mid] = True
            stack += [(first, mid), (mid, last)]
    return points[keep]


def simplify_ring(ring: np.ndarray, epsilon: float) -> np.ndarray:
    """Simplify a closed ring: split it at its two most distant points and simplify each half."""
    ring = ring[:-1] if np.allclose(ring[0], ring[-1]) else ring
    far = int(np.argmax(np.hypot(*(ring - ring[0]).T)))
    first = simplify_open(ring[: far + 1], epsilon)
    second = simplify_open(np.vstack([ring[far:], ring[:1]]), epsilon)
    return np.vstack([first[:-1], second[:-1]])


def trace() -> dict:
    alpha = Image.open(SOURCE).convert("RGBA").getchannel("A")
    width, height = alpha.size
    big = alpha.resize((width * UPSCALE, height * UPSCALE), Image.Resampling.LANCZOS)
    field = np.pad(np.asarray(big, dtype=float) / 255.0, 4)  # a border of nothing, so every outline closes
    field = gaussian_filter(field, 1.2)
    figure, axes = plt.subplots()
    segments = axes.contour(field, levels=[0.5]).allsegs[0]
    plt.close(figure)
    rings = [simplify_ring(np.asarray(segment), EPSILON) for segment in segments if len(segment) > 8]
    rings = [ring for ring in rings if abs(area(ring)) >= MIN_AREA]
    if not rings:
        raise SystemExit("no outline found")
    everything = np.vstack(rings)
    low, high = everything.min(axis=0), everything.max(axis=0)
    scale = HEIGHT / (high[1] - low[1])
    centre = (low + high) / 2
    board = [((ring - centre) * scale + BOARD / 2) for ring in rings]
    return {
        "board": BOARD,
        "height": HEIGHT,
        "source": SOURCE.name,
        "polygons": [[[round(float(x), 2), round(float(y), 2)] for x, y in ring] for ring in board],
    }


def main() -> None:
    outline = trace()
    OUTPUT.write_text(json.dumps(outline, separators=(",", ":")) + "\n", encoding="utf-8")
    points = sum(len(polygon) for polygon in outline["polygons"])
    print(f"wrote {OUTPUT.relative_to(ROOT)}: {len(outline['polygons'])} outlines, {points} points")


if __name__ == "__main__":
    main()

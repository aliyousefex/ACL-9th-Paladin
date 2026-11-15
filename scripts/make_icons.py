"""Draw the Paladin icon set from the logo: the mark in white on the logo's blue.

    .venv\\Scripts\\python.exe scripts\\make_icons.py

The source is scripts/logo-mark.svg, the logo as supplied (one compound path: the outer triangle with the inner pieces cut
out of it, so the lines are the gaps between them). The SVG and every raster size are drawn from that one path. Writes into
ui/public: favicon.svg, favicon.ico (16, 32 and 48px), favicon.png, icon-192.png, icon-512.png, a padded icon-maskable-512.png
and a full-bleed apple-touch-icon.png. Needs only Pillow.

The artwork is hairline, so each size thickens the lines to about 0.8 of a pixel (never thinner than the SVG's 10 units, in
the mark's own 600-unit width): at 16px a hairline is gone, and a heavier weight is what keeps the triangle readable.
"""

from __future__ import annotations

import re
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "logo-mark.svg"

BLUE = (24, 0, 173, 255)  # the logo's #1800ad
WHITE = (255, 255, 255, 255)
BOARD = 64  # every icon is drawn on a 64-unit board
CORNER = 13  # radius of the rounded square, in board units
SUPERSAMPLE = 8

TILE = 40  # width of the mark on a rounded icon, in board units (it is a little wider than tall)
APPLE = 36  # iOS rounds the corners itself, so the mark keeps a little further from the edge
MASKABLE = 32  # a maskable icon is cropped to a circle or squircle: the mark stays inside the central 80%
LIFT = 1.0  # a triangle's weight sits low in its box; the mark is raised this much (board units) to look centred
FAVICON_WEIGHT = 26  # the SVG favicon is drawn at 16 to 32px; this is the weight that suits 32


def read_path() -> str:
    """The `d` of the logo's one path."""
    match = re.search(r'<path fill="[^"]+" d="([^"]+)"', SOURCE.read_text(encoding="utf-8"))
    assert match, "scripts/logo-mark.svg has no path"
    return match.group(1).strip()


def parse(d: str) -> list[list[tuple[float, float]]]:
    """The path as closed polygons (the artwork uses absolute M, L, C and Z). Curves are flattened to short segments."""
    rings: list[list[tuple[float, float]]] = []
    ring: list[tuple[float, float]] = []
    tokens = re.findall(r"[MLCZ]|-?\d+(?:\.\d+)?", d)
    i = 0

    def number() -> float:
        nonlocal i
        value = float(tokens[i])
        i += 1
        return value

    while i < len(tokens):
        command = tokens[i]
        i += 1
        if command == "M":
            if ring:
                rings.append(ring)
            ring = [(number(), number())]
        elif command == "L":
            ring.append((number(), number()))
        elif command == "C":
            x0, y0 = ring[-1]
            x1, y1, x2, y2, x3, y3 = (number() for _ in range(6))
            for step in range(1, 17):
                t = step / 16
                u = 1 - t
                ring.append((
                    u**3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t**3 * x3,
                    u**3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t**3 * y3,
                ))
        elif command == "Z":
            rings.append(ring)
            ring = []
    if ring:
        rings.append(ring)
    return rings


def area(ring: list[tuple[float, float]]) -> float:
    return 0.5 * abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1])))


D = read_path()
RINGS = parse(D)
OUTER = max(RINGS, key=area)  # the triangle; every other ring is a piece cut out of it
_xs = [x for ring in RINGS for x, _ in ring]
_ys = [y for ring in RINGS for _, y in ring]
X0, X1, Y0, Y1 = min(_xs), max(_xs), min(_ys), max(_ys)
WIDTH, HEIGHT = X1 - X0, Y1 - Y0  # about 600 x 476 in the artwork's units


def weight_for(size: int, content: float) -> float:
    """Line thickening, in the mark's own units, that comes to about 0.8 of a pixel at this size."""
    pixels_per_unit = size * (content / BOARD) / WIDTH
    return min(48.0, max(10.0, 0.8 / pixels_per_unit))


def render(size: int, *, rounded: bool, content: float, weight: float | None = None) -> Image.Image:
    """One icon. `rounded` leaves transparent corners; otherwise the square is full-bleed."""
    weight = weight_for(size, content) if weight is None else weight
    big = size * SUPERSAMPLE
    k = big / BOARD
    scale = (content / WIDTH) * k  # artwork units to supersampled pixels
    ox = big / 2 - (X0 + WIDTH / 2) * scale
    oy = big / 2 - LIFT * k - (Y0 + HEIGHT / 2) * scale

    def at(ring: list[tuple[float, float]]) -> list[tuple[float, float]]:
        return [(x * scale + ox, y * scale + oy) for x, y in ring]

    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    if rounded:
        draw.rounded_rectangle((0, 0, big - 1, big - 1), radius=CORNER * k, fill=BLUE)
    else:
        draw.rectangle((0, 0, big, big), fill=BLUE)

    # The mark's mask: the triangle with its pieces cut out (that is the artwork), then every edge thickened by `weight`.
    mask = Image.new("L", (big, big), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.polygon(at(OUTER), fill=255)
    for ring in RINGS:
        if ring is not OUTER:
            mask_draw.polygon(at(ring), fill=0)
    stroke = max(1, round(weight * scale))
    for ring in RINGS:
        points = at(ring)
        mask_draw.line(points + [points[0]], fill=255, width=stroke, joint="curve")
    canvas.paste(WHITE, (0, 0), mask)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def svg() -> str:
    """The favicon: a rounded blue square and the one path, thickened with a stroke."""
    scale = TILE / WIDTH
    tx = BOARD / 2 - (X0 + WIDTH / 2) * scale
    ty = BOARD / 2 - LIFT - (Y0 + HEIGHT / 2) * scale
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {BOARD} {BOARD}"><title>Paladin F1</title>'
        f'<rect width="{BOARD}" height="{BOARD}" rx="{CORNER}" fill="#1800ad"/>'
        f'<path transform="translate({tx:.3f} {ty:.3f}) scale({scale:.5f})" fill="#fff" stroke="#fff" '
        f'stroke-width="{FAVICON_WEIGHT}" stroke-linejoin="round" d="{D}"/></svg>\n'
    )


def ico(frames: dict[int, Image.Image]) -> bytes:
    """A .ico of PNG frames, one drawn per size (Pillow would scale a single image, with the same weight at 16px and 48px)."""
    data = []
    for size, image in sorted(frames.items()):
        buffer = BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        data.append((size, buffer.getvalue()))
    out = struct.pack("<HHH", 0, 1, len(data))
    offset = 6 + 16 * len(data)
    for size, png in data:
        out += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(png), offset)
        offset += len(png)
    return out + b"".join(png for _, png in data)


def write_all(out: Path) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    def save(name: str, image: Image.Image) -> None:
        path = out / name
        image.save(path, optimize=True)
        written.append(path)

    (out / "favicon.svg").write_text(svg(), encoding="utf-8", newline="\n")
    written.append(out / "favicon.svg")
    (out / "favicon.ico").write_bytes(ico({size: render(size, rounded=True, content=TILE) for size in (16, 32, 48)}))
    written.append(out / "favicon.ico")
    save("favicon.png", render(64, rounded=True, content=TILE))
    save("icon-192.png", render(192, rounded=True, content=TILE))
    save("icon-512.png", render(512, rounded=True, content=TILE))
    save("apple-touch-icon.png", render(180, rounded=False, content=APPLE))
    save("icon-maskable-512.png", render(512, rounded=False, content=MASKABLE))
    return written


def main() -> None:
    target = ROOT / "ui" / "public"
    for path in write_all(target):
        print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

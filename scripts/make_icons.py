"""Draw the Paladin icon set: the rearing horse, in ink on the page's near-black.

    .venv\\Scripts\\python.exe scripts\\make_icons.py

The horse is the outline traced by scripts/trace_horse.py (scripts/horse_outline.json), a real vector drawing, so the SVG
and every raster size come from the same numbers and stay crisp at 16px. Writes into ui/public: favicon.svg, favicon.ico
(16, 32 and 48px), favicon.png, icon-192.png, icon-512.png, a padded icon-maskable-512.png and a full-bleed
apple-touch-icon.png. Needs only Pillow.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTLINE = json.loads((ROOT / "scripts" / "horse_outline.json").read_text(encoding="utf-8"))
BOARD = OUTLINE["board"]
POLYGONS: list[list[tuple[float, float]]] = [[(x, y) for x, y in ring] for ring in OUTLINE["polygons"]]

INK = (10, 11, 14, 255)  # the page's near-black in the dark theme
HORSE = (244, 244, 242, 255)  # ink
CORNER = 13  # radius of the rounded square, in board units
SUPERSAMPLE = 8

TILE = 0.9  # how much of the board the horse's height uses on a rounded icon (the outline is 60 of 64 tall)
APPLE = 0.82  # iOS rounds the corners itself, so the horse keeps a little further from the edge
MASKABLE = 0.72  # a maskable icon is cropped to a circle or squircle: the horse stays inside the central 80%


def placed(content: float) -> list[list[tuple[float, float]]]:
    """The outlines scaled about the centre of the board."""
    mid = BOARD / 2
    return [[(mid + (x - mid) * content, mid + (y - mid) * content) for x, y in ring] for ring in POLYGONS]


def render(size: int, *, rounded: bool, content: float) -> Image.Image:
    """One icon. `rounded` leaves transparent corners; otherwise the square is full-bleed."""
    big = size * SUPERSAMPLE
    k = big / BOARD
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    if rounded:
        draw.rounded_rectangle((0, 0, big - 1, big - 1), radius=CORNER * k, fill=INK)
    else:
        draw.rectangle((0, 0, big, big), fill=INK)
    mask = Image.new("L", (big, big), 0)
    mask_draw = ImageDraw.Draw(mask)
    for ring in placed(content):
        mask_draw.polygon([(x * k, y * k) for x, y in ring], fill=255)
    canvas.paste(HORSE, (0, 0), mask)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def svg() -> str:
    """The favicon as a rounded square and one path. One decimal is a tenth of a board unit, well under a pixel at 512."""
    path = "".join(
        "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in ring) + "z" for ring in placed(TILE)
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {BOARD} {BOARD}"><title>Paladin F1</title>'
        f'<rect width="{BOARD}" height="{BOARD}" rx="{CORNER}" fill="#0a0b0e"/>'
        f'<path fill="#f4f4f2" d="{path}"/></svg>\n'
    )


def write_all(out: Path) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    def save(name: str, image: Image.Image, **kwargs) -> None:
        path = out / name
        image.save(path, **kwargs)
        written.append(path)

    (out / "favicon.svg").write_text(svg(), encoding="utf-8", newline="\n")
    written.append(out / "favicon.svg")
    save("favicon.ico", render(256, rounded=True, content=TILE), sizes=[(16, 16), (32, 32), (48, 48)])
    save("favicon.png", render(64, rounded=True, content=TILE), optimize=True)
    save("icon-192.png", render(192, rounded=True, content=TILE), optimize=True)
    save("icon-512.png", render(512, rounded=True, content=TILE), optimize=True)
    save("apple-touch-icon.png", render(180, rounded=False, content=APPLE), optimize=True)
    save("icon-maskable-512.png", render(512, rounded=False, content=MASKABLE), optimize=True)
    return written


def main() -> None:
    target = ROOT / "ui" / "public"
    for path in write_all(target):
        print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

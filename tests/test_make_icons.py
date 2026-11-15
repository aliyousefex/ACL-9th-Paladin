"""Checks for the horse tracer and the icon generator. Needs only Pillow (and numpy/scipy/matplotlib for the tracer)."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


mi = load("make_icons")
th = load("trace_horse")


def test_the_traced_outline_is_one_closed_horse_centred_on_the_board():
    outline = json.loads((ROOT / "scripts" / "horse_outline.json").read_text(encoding="utf-8"))
    assert outline["board"] == 64 and outline["height"] == 60
    assert len(outline["polygons"]) == 1
    ring = outline["polygons"][0]
    assert 100 < len(ring) < 600
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    assert abs((min(ys) + max(ys)) / 2 - 32) < 0.5 and abs(max(ys) - min(ys) - 60) < 0.5, "60 tall, centred"
    assert abs((min(xs) + max(xs)) / 2 - 32) < 0.5, "centred across"


def test_the_committed_outline_is_what_the_tracer_produces_from_the_logo():
    fresh = th.trace()
    committed = json.loads((ROOT / "scripts" / "horse_outline.json").read_text(encoding="utf-8"))
    assert len(fresh["polygons"]) == len(committed["polygons"])

    def shoelace(ring):
        return 0.5 * abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1])))

    # Compared by area, so a different contouring library version does not fail it, but a changed logo does.
    for a, b in zip(fresh["polygons"], committed["polygons"]):
        assert abs(shoelace(a) - shoelace(b)) / shoelace(b) < 0.01, "the logo changed: run scripts/trace_horse.py and scripts/make_icons.py"


def test_every_icon_is_written_at_the_size_it_is_named_for(tmp_path):
    written = {path.name: path for path in mi.write_all(tmp_path)}
    assert set(written) == {"favicon.svg", "favicon.ico", "favicon.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "icon-maskable-512.png"}
    for name, size in {"favicon.png": 64, "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180, "icon-maskable-512.png": 512}.items():
        with Image.open(written[name]) as image:
            assert image.size == (size, size), name
    with Image.open(written["favicon.ico"]) as ico:
        assert ico.info["sizes"] == {(16, 16), (32, 32), (48, 48)}


def test_the_committed_favicon_is_what_the_generator_draws():
    assert (ROOT / "ui" / "public" / "favicon.svg").read_text(encoding="utf-8") == mi.svg()


def test_the_rounded_icons_have_transparent_corners_and_the_full_bleed_ones_do_not(tmp_path):
    written = {path.name: path for path in mi.write_all(tmp_path)}
    for name, transparent in {"icon-512.png": True, "favicon.png": True, "apple-touch-icon.png": False, "icon-maskable-512.png": False}.items():
        with Image.open(written[name]) as image:
            alpha = image.convert("RGBA").getpixel((0, 0))[3]
            assert (alpha == 0) is transparent, name


def test_the_horse_is_light_on_the_dark_tile_and_the_maskable_icon_keeps_it_inside_the_safe_zone(tmp_path):
    written = {path.name: path for path in mi.write_all(tmp_path)}
    with Image.open(written["icon-512.png"]) as image:
        rgba = image.convert("RGBA")
        assert rgba.getpixel((256, 300))[:3] == mi.HORSE[:3], "the horse's body is ink"
        assert rgba.getpixel((256, 12))[:3] == mi.INK[:3], "the tile is the page's near-black"
    with Image.open(written["icon-maskable-512.png"]) as image:
        rgba = image.convert("RGBA")
        centre, radius = 256, 0.4 * 512  # the platform keeps the central 80% circle
        for x in range(0, 512, 4):
            for y in range(0, 512, 4):
                if rgba.getpixel((x, y))[:3] != mi.INK[:3]:
                    assert (x - centre) ** 2 + (y - centre) ** 2 <= radius**2, (x, y)

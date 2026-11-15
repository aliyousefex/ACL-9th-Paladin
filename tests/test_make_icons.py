"""Checks for the icon generator. Needs only Pillow."""

from __future__ import annotations

import importlib.util
import re
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


mi = load("make_icons")


def luminance(rgb) -> float:
    def channel(value: int) -> float:
        v = value / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(c) for c in rgb[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def test_the_logo_source_is_one_triangle_with_seven_pieces_cut_out_of_it():
    assert len(mi.RINGS) == 8
    inner = [ring for ring in mi.RINGS if ring is not mi.OUTER]
    assert len(inner) == 7
    # Every piece lies inside the outer triangle's box, and together they are most of its area: the lines are the gaps.
    xs = [x for x, _ in mi.OUTER]
    ys = [y for _, y in mi.OUTER]
    for ring in inner:
        assert all(min(xs) - 1 <= x <= max(xs) + 1 and min(ys) - 1 <= y <= max(ys) + 1 for x, y in ring)
    assert 0.7 < sum(mi.area(r) for r in inner) / mi.area(mi.OUTER) < 1.0
    # The artwork is wider than tall, about 600 by 476.
    assert 590 < mi.WIDTH < 610 and 470 < mi.HEIGHT < 480


def test_the_page_draws_the_same_path_the_icons_do():
    data = (ROOT / "ui" / "src" / "components" / "logo-data.ts").read_text(encoding="utf-8")
    assert f'd: "{mi.D}"' in data, "ui/src/components/logo-data.ts MARK.d must be the path in scripts/logo-mark.svg"


def test_every_icon_is_written_at_the_size_it_is_named_for(tmp_path):
    written = {path.name: path for path in mi.write_all(tmp_path)}
    assert set(written) == {"favicon.svg", "favicon.ico", "favicon.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "icon-maskable-512.png"}
    for name, size in {"favicon.png": 64, "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180, "icon-maskable-512.png": 512}.items():
        with Image.open(written[name]) as image:
            assert image.size == (size, size), name
    with Image.open(written["favicon.ico"]) as ico:
        assert ico.info["sizes"] == {(16, 16), (32, 32), (48, 48)}


def test_each_size_in_the_ico_is_drawn_for_that_size_not_scaled_from_one_image(tmp_path):
    mi.write_all(tmp_path)
    data = (tmp_path / "favicon.ico").read_bytes()
    count = struct.unpack_from("<H", data, 4)[0]
    assert count == 3
    frames = {}
    for i in range(count):
        width, _h, _c, _r, _planes, _bits, length, offset = struct.unpack_from("<BBBBHHII", data, 6 + 16 * i)
        assert data[offset : offset + 8] == b"\x89PNG\r\n\x1a\n", "PNG frames"
        frames[width] = length
    assert set(frames) == {16, 32, 48}
    # The lines are thicker (as a share of the mark) at 16px than at 48px: the weight is chosen per size.
    assert mi.weight_for(16, mi.TILE) > mi.weight_for(32, mi.TILE) > mi.weight_for(48, mi.TILE) >= mi.weight_for(512, mi.TILE)


def test_the_committed_favicon_is_what_the_generator_draws():
    assert (ROOT / "ui" / "public" / "favicon.svg").read_text(encoding="utf-8") == mi.svg()
    assert f' d="{mi.D}"' in mi.svg(), "the favicon carries the logo's own path"


def test_the_rounded_icons_have_transparent_corners_and_the_full_bleed_ones_do_not(tmp_path):
    written = {path.name: path for path in mi.write_all(tmp_path)}
    for name, transparent in {"icon-512.png": True, "favicon.png": True, "apple-touch-icon.png": False, "icon-maskable-512.png": False}.items():
        with Image.open(written[name]) as image:
            alpha = image.convert("RGBA").getpixel((0, 0))[3]
            assert (alpha == 0) is transparent, name


def test_the_mark_is_white_on_the_logo_blue_with_the_pieces_cut_out_and_the_maskable_icon_keeps_it_in_the_safe_zone(tmp_path):
    written = {path.name: path for path in mi.write_all(tmp_path)}
    with Image.open(written["icon-512.png"]) as image:
        rgba = image.convert("RGBA")
        assert rgba.getpixel((256, 12))[:3] == mi.BLUE[:3], "the tile is the logo's blue"
        pixels = rgba.load()
        white = sum(1 for x in range(0, 512, 2) for y in range(0, 512, 2) if pixels[x, y][:3] == mi.WHITE[:3])
        blue = sum(1 for x in range(100, 412, 2) for y in range(100, 412, 2) if pixels[x, y][:3] == mi.BLUE[:3])
        assert white > 200, "the mark is drawn"
        assert blue > 4000, "the triangle is not filled solid: its pieces are cut out of it"
    # White on the blue is far past the 4.5:1 a mark needs.
    ratio = (luminance(mi.WHITE) + 0.05) / (luminance(mi.BLUE) + 0.05)
    assert ratio > 10, ratio
    with Image.open(written["icon-maskable-512.png"]) as image:
        rgba = image.convert("RGBA")
        centre, radius = 256, 0.4 * 512  # the platform keeps the central 80% circle
        for x in range(0, 512, 4):
            for y in range(0, 512, 4):
                if rgba.getpixel((x, y))[:3] != mi.BLUE[:3]:
                    assert (x - centre) ** 2 + (y - centre) ** 2 <= radius**2, (x, y)


def test_the_logo_blue_is_the_one_the_page_uses_on_light_and_a_tint_of_it_on_dark():
    css = (ROOT / "ui" / "src" / "index.css").read_text(encoding="utf-8")
    assert "#%02x%02x%02x" % mi.BLUE[:3] == "#1800ad"
    assert re.search(r"--color-brand:\s*#1800ad;", css), "the light theme uses the logo's own blue"
    dark = re.search(r"@theme \{.*?--color-brand:\s*(#[0-9a-f]{6});", css, re.S).group(1)
    rgb = tuple(int(dark[i : i + 2], 16) for i in (1, 3, 5))
    page = (10, 11, 14)
    ratio = (luminance(rgb) + 0.05) / (luminance(page) + 0.05)
    assert ratio >= 4.5, f"{dark} on the dark page is {ratio:.2f}:1 (the original blue is 1.5:1)"

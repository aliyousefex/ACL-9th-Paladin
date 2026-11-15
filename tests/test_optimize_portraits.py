"""Checks for the portrait optimiser. Needs only Pillow."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("optimize_portraits", ROOT / "scripts" / "optimize_portraits.py")
op = importlib.util.module_from_spec(spec)
spec.loader.exec_module(op)  # type: ignore[union-attr]


@pytest.fixture()
def workspace(tmp_path, monkeypatch):
    portraits = tmp_path / "portraits"
    portraits.mkdir()
    for name, size in {"alpha.webp": (480, 600), "beta.webp": (480, 720)}.items():
        Image.new("RGB", size, (120, 80, 200)).save(portraits / name, "WEBP", quality=90)
    index = tmp_path / "portraits.json"
    index.write_text(json.dumps({"alpha": {"file": "alpha.webp", "width": 480, "height": 600, "author": "A"},
                                 "beta": {"file": "beta.webp", "width": 480, "height": 720, "author": "B"},
                                 "ghost": {"file": "missing.webp", "width": 480, "height": 600, "author": "C"}}, indent=1) + "\n", encoding="utf-8")
    monkeypatch.setattr(op, "PORTRAITS", portraits)
    monkeypatch.setattr(op, "INDEX", index)
    return portraits, index


def test_each_portrait_gets_a_320px_copy_with_the_same_proportions(workspace):
    portraits, index = workspace
    result = op.build()
    assert result["made"] == 2
    for name, original in {"alpha": (480, 600), "beta": (480, 720)}.items():
        with Image.open(portraits / f"{name}-320.webp") as small:
            assert small.width == 320
            assert small.height == round(original[1] * 320 / original[0])
    data = json.loads(index.read_text(encoding="utf-8"))
    assert data["alpha"]["small"] == "alpha-320.webp"
    assert "small" not in data["ghost"], "a portrait whose file is missing is not given a copy it cannot have"


def test_credits_and_originals_are_untouched(workspace):
    portraits, index = workspace
    before = {name: (portraits / name).read_bytes() for name in ("alpha.webp", "beta.webp")}
    op.build()
    after = json.loads(index.read_text(encoding="utf-8"))
    assert after["alpha"]["author"] == "A" and after["alpha"]["width"] == 480 and after["beta"]["height"] == 720
    for name, content in before.items():
        assert (portraits / name).read_bytes() == content


def test_running_it_again_changes_nothing(workspace):
    portraits, index = workspace
    op.build()
    snapshot = index.read_text(encoding="utf-8")
    again = op.build()
    assert again["made"] == 0 and again["kept"] == 2
    assert index.read_text(encoding="utf-8") == snapshot


def test_the_shipped_portraits_all_have_a_smaller_copy_that_is_really_smaller():
    index = json.loads(op.INDEX.read_text(encoding="utf-8"))
    assert index, "there are portraits"
    for ref, photo in index.items():
        assert photo.get("small"), f"{ref} has no small copy: run scripts/optimize_portraits.py"
        small, full = op.PORTRAITS / photo["small"], op.PORTRAITS / photo["file"]
        assert small.exists() and small.stat().st_size < full.stat().st_size, ref
        with Image.open(small) as image:
            assert image.width == op.SMALL_WIDTH

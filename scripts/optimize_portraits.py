"""Make a 320px-wide copy of every driver portrait, so a small screen or a small slot does not download the 480px one.

The portraits are 480px wide WebP files (about 32 KB each). A driver card on a desktop at normal pixel density shows one at
about 300 CSS pixels, and the avatars on the race page show them at 56 to 96, so most visitors never need all 480 pixels.
``Portrait`` offers both through ``srcset`` and the browser picks. A copy is only used when ``portraits.json`` lists it,
so a portrait fetched later by ``fetch_driver_portraits.py`` that has no copy yet keeps working.

Down-scaling a lossy image hides its artefacts, so this loses less than re-encoding at the same size would. The original
480px files, their licences and credits are not touched. Needs Pillow. Safe to run again: it rebuilds only what changed.

    .venv\\Scripts\\python.exe scripts\\optimize_portraits.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PORTRAITS = ROOT / "ui" / "public" / "portraits"
INDEX = ROOT / "ui" / "src" / "data" / "portraits.json"
SMALL_WIDTH = 320
QUALITY = 80


def small_name(file: str) -> str:
    return f"{Path(file).stem}-{SMALL_WIDTH}.webp"


def build() -> dict[str, int]:
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    made = kept = 0
    saved = 0
    for ref, photo in index.items():
        source = PORTRAITS / photo["file"]
        target = PORTRAITS / small_name(photo["file"])
        if not source.exists():
            continue
        if not target.exists() or target.stat().st_mtime < source.stat().st_mtime:
            with Image.open(source) as image:
                height = round(image.height * SMALL_WIDTH / image.width)
                image.convert("RGB").resize((SMALL_WIDTH, height), Image.LANCZOS).save(target, "WEBP", quality=QUALITY, method=6)
            made += 1
        else:
            kept += 1
        saved += source.stat().st_size - target.stat().st_size
        photo["small"] = target.name
    INDEX.write_text(json.dumps(index, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"made": made, "kept": kept, "bytesSavedPerFullSet": saved}


def main() -> None:
    result = build()
    print(f"{result['made']} made, {result['kept']} already current; a driver who needs only the small copy saves {result['bytesSavedPerFullSet'] // 1024} KB across the set")


if __name__ == "__main__":
    main()

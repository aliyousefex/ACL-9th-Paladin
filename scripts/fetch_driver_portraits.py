"""Download freely licensed driver portraits from Wikimedia Commons and record their credits.

Only images that Wikipedia marks as freely licensed are used (``pilicense=free``). Each image is
resized to 480 px wide WebP and saved under ``ui/public/portraits/``; the author, licence and
source page of every file are written to ``ui/src/data/portraits.json`` so the site can credit
them. A driver without a free image is left out, and the interface draws a number plate instead.

    .venv\\Scripts\\python.exe scripts\\fetch_driver_portraits.py
"""

from __future__ import annotations

import html
import io
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "ui" / "public" / "portraits"
CREDITS = ROOT / "ui" / "src" / "data" / "portraits.json"
DRIVERS = ROOT / "ui" / "src" / "data" / "drivers.json"
API = "https://en.wikipedia.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "PaladinF1Podium/1.0 (ACL-903 student project; aliyousef.aca@gmail.com)"}

TITLES = {
    "hamilton": "Lewis Hamilton", "alonso": "Fernando Alonso", "vettel": "Sebastian Vettel", "gasly": "Pierre Gasly",
    "hulkenberg": "Nico Hülkenberg", "perez": "Sergio Pérez", "ricciardo": "Daniel Ricciardo", "bottas": "Valtteri Bottas",
    "kevin_magnussen": "Kevin Magnussen", "max_verstappen": "Max Verstappen", "sainz": "Carlos Sainz Jr.",
    "ocon": "Esteban Ocon", "stroll": "Lance Stroll", "leclerc": "Charles Leclerc", "norris": "Lando Norris",
    "russell": "George Russell (racing driver)", "albon": "Alexander Albon", "latifi": "Nicholas Latifi",
    "tsunoda": "Yuki Tsunoda", "mick_schumacher": "Mick Schumacher", "zhou": "Zhou Guanyu", "de_vries": "Nyck de Vries",
    "piastri": "Oscar Piastri", "sargeant": "Logan Sargeant", "lawson": "Liam Lawson", "bearman": "Oliver Bearman",
    "colapinto": "Franco Colapinto", "doohan": "Jack Doohan",
}


def get(url: str, binary: bool = False):
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                data = r.read()
            time.sleep(0.4)
            return data if binary else json.loads(data.decode("utf-8"))
        except Exception as error:  # noqa: BLE001
            last = error
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"{url}: {last}")


def strip(text: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    refs = [d["ref"] for d in json.loads(DRIVERS.read_text(encoding="utf-8"))["drivers"]]
    credits = {}
    for ref in refs:
        title = TITLES.get(ref)
        if not title:
            print("no title for", ref)
            continue
        q = urllib.parse.urlencode({"action": "query", "titles": title, "prop": "pageimages", "piprop": "name",
                                    "pilicense": "free", "redirects": 1, "format": "json", "formatversion": 2})
        page = get(f"{API}?{q}")["query"]["pages"][0]
        name = page.get("pageimage")
        if not name:
            print(f"{ref}: no free image")
            continue
        q = urllib.parse.urlencode({"action": "query", "titles": f"File:{name}", "prop": "imageinfo", "iiprop": "url|extmetadata|size",
                                    "iiurlwidth": 640, "format": "json", "formatversion": 2})
        info = get(f"{COMMONS}?{q}")["query"]["pages"][0]["imageinfo"][0]
        meta = info.get("extmetadata", {})
        licence = strip(meta.get("LicenseShortName", {}).get("value", ""))
        if not re.search(r"CC|public domain|PD|CC0|OGL", licence, re.I):
            print(f"{ref}: skipped, licence {licence!r}")
            continue
        raw = get(info["thumburl"], binary=True)
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        w, h = image.size
        width = 480
        image = image.resize((width, round(h * width / w)), Image.LANCZOS)
        image.save(OUT / f"{ref}.webp", "WEBP", quality=80, method=6)
        credits[ref] = {
            "file": f"{ref}.webp", "width": image.size[0], "height": image.size[1],
            "title": title, "author": strip(meta.get("Artist", {}).get("value", "")) or "Unknown",
            "licence": licence, "licenceUrl": strip(meta.get("LicenseUrl", {}).get("value", "")),
            "source": info.get("descriptionurl"), "image": name,
        }
        print(f"{ref}: {name} | {licence} | {credits[ref]['author'][:40]}")
    CREDITS.write_text(json.dumps(credits, indent=1, ensure_ascii=False), encoding="utf-8")
    print(len(credits), "portraits")


if __name__ == "__main__":
    main()

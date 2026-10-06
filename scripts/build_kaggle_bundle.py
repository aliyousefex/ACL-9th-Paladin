"""Package the shared Python source for attachment to a Kaggle notebook.

Kaggle notebooks cannot import a local repository path. This keeps the workaround
small: momken upload one ZIP beside the public F1 dataset, while the notebook still
runs the exact same ``pipeline.py`` used locally.
"""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "f1podium"
OUT = ROOT / "kaggle" / "f1podium_src.zip"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUT, "w", compression=ZIP_DEFLATED) as bundle:
        for path in sorted(SOURCE.glob("*.py")):
            # Keep the package directory inside the ZIP so importing works as soon
            # as the notebook extracts it. No setup command is needed hena.
            bundle.write(path, Path("f1podium") / path.name)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()

"""Package the shared Python source for attachment to a Kaggle notebook.

Kaggle notebooks cannot import a local repository path. This bundles the package
beside the public dataset while keeping the same ``pipeline.py`` used locally.
"""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "f1podium"
OUT = ROOT / "kaggle" / "f1podium_src.zip"


def main() -> None:
    """Package the local f1podium module in a Kaggle-friendly ZIP."""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUT, "w", compression=ZIP_DEFLATED) as bundle:
        for path in sorted(SOURCE.glob("*.py")):
            # Keep the package directory inside the ZIP so importing works as soon
            # as the notebook extracts it. No installation step is needed.
            bundle.write(path, Path("f1podium") / path.name)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()

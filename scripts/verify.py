"""One entry point for repository checks.

Use ``python scripts/verify.py`` for the fast product checks and add ``--full`` to run the
six-minute analytical suite as well.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(label: str, command: list[str], cwd: Path = ROOT) -> None:
    print(f"\n== {label} ==", flush=True)
    completed = subprocess.run(command, cwd=cwd, check=False)
    if completed.returncode:
        raise SystemExit(f"{label} failed with exit code {completed.returncode}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify the analytical and interactive Paladin product")
    parser.add_argument("--full", action="store_true", help="also run the complete Python analytical test suite")
    args = parser.parse_args()

    if args.full:
        run("Python analytical tests", [sys.executable, "-m", "pytest"])
    else:
        run("Python export contract tests", [sys.executable, "-m", "pytest", "tests/test_site_export.py"])
    run("Frozen model contract", [sys.executable, "scripts/verify_model_freeze.py"])
    run("Cross-file consistency", [sys.executable, "scripts/validate_cross_file_consistency.py"])
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    run("Browser model, replay and simulation tests", [npm, "test"], ROOT / "ui")
    run("TypeScript and production build", [npm, "run", "build"], ROOT / "ui")
    if args.full:
        run("Production browser release tests", [npm, "run", "test:e2e"], ROOT / "ui")
    print("\nPaladin verification passed.")


if __name__ == "__main__":
    main()

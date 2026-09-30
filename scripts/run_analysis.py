from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from f1podium.pipeline import run_analysis

if __name__ == "__main__":
    result = run_analysis(ROOT / "data" / "raw", ROOT / "artifacts")
    print(result["metrics"].to_string(index=False))
    print(result["summary"])


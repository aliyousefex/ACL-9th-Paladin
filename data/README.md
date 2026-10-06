# Dataset

`raw/` is the unmodified 14-table Formula 1 World Championship 1950-2024 snapshot downloaded from the Kaggle/Ergast dataset linked by the milestone brief. Cleaning occurs only in memory and generated derivatives go to the ignored `artifacts/` directory.

If you are looking for the original evidence, start hena. Please do not "fix" a value directly in these CSVs; momken correct the parsing or cleaning rule in `src/f1podium/pipeline.py` instead, so every teammate can reproduce the same result.

Source: <https://www.kaggle.com/datasets/rohanrao/formula-1-world-championship-1950-2020>

Downloaded on 2026-09-30. Do not edit the CSV files in place.


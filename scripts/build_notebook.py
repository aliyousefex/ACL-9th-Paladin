"""Generate the submission notebook from small, reviewable source cells."""

from pathlib import Path
import nbformat as nbf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "notebooks" / "milestone_1_f1_podium_prediction.ipynb"

nb = nbf.v4.new_notebook()
nb["metadata"] = {
    "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
    "language_info": {"name": "python", "version": "3.12"},
}

cells = []
cells.append(nbf.v4.new_markdown_cell("""# Milestone 1: Formula 1 Podium Prediction Companion

This run-all notebook predicts whether each driver finishes on the podium using only information known after qualifying and before the race. The primary metric is **PR-AUC** because podiums are rare; ROC-AUC is secondary. Threshold-dependent F1, precision, and recall are also reported. The chronological split is train through 2019, validation in 2020-2021, and unseen test in 2022-2024."""))
cells.append(nbf.v4.new_code_cell("""from pathlib import Path
import sys

ROOT = Path.cwd().resolve()
if ROOT.name == 'notebooks':
    ROOT = ROOT.parent

def _add_package(root: Path) -> None:
    local = root / 'src'
    if (local / 'f1podium' / 'pipeline.py').exists():
        sys.path.insert(0, str(local))
        return
    kaggle = Path('/kaggle/input')
    if not kaggle.exists():
        return
    for match in kaggle.rglob('pipeline.py'):
        if match.parent.name == 'f1podium':
            sys.path.insert(0, str(match.parent.parent))
            return

def _data_dir(root: Path) -> Path:
    local = root / 'data' / 'raw'
    if (local / 'results.csv').exists():
        return local
    matches = sorted(Path('/kaggle/input').rglob('results.csv'))
    if not matches:
        raise FileNotFoundError('results.csv was not found in data/raw or /kaggle/input')
    return matches[0].parent

_add_package(ROOT)
DATA = _data_dir(ROOT)
OUT = ROOT / 'artifacts'
from IPython.display import display, Image
from f1podium.pipeline import run_analysis
results = run_analysis(DATA, OUT)
print(results['summary'])"""))
cells.append(nbf.v4.new_markdown_cell("""## 1. Raw audit and cleaning

The raw CSVs are never modified. Literal `\\N` sentinels become missing values on read, while dates and qualifying durations receive proper types. Primary keys and major foreign keys are checked in code. For shared-drive duplicates, we keep the car the driver actually started (`grid > 0`), then the best final classification, then the smallest result ID. The rule is simple and repeatable, ya3ni the result does not depend on row order."""))
cells.append(nbf.v4.new_code_cell("""display(results['pk_audit'])
display(results['fk_audit'])
display(results['summary']['diagnostics'])"""))
cells.append(nbf.v4.new_markdown_cell("""## 2. EDA before and after cleaning

The audit above quantifies raw integrity. After cleaning, `(raceId, driverId)` is unique. Qualifying coverage changes sharply over history, so we preserve an explicit missingness flag and use grid position as the historically available anchor instead of dropping older seasons."""))
cells.append(nbf.v4.new_code_cell("display(Image(filename=str(ROOT / 'artifacts/figures/qualifying_coverage.png')))"))
cells.append(nbf.v4.new_markdown_cell("""## 3. Data-engineering questions

Each answer uses multi-hop joins. Question 1 joins results, races, and circuits and uses **grid**, not qualifying order, to define a front-row start; qualifying position remains separate. Question 2 joins drivers and circuits, maps nationality to country, and stratifies by grid band to control starting position. Question 3 joins results, status, and constructors; only documented component-failure statuses count as mechanical."""))
cells.append(nbf.v4.new_code_cell("""for key, table in results['answers'].items():
    print('\\n', key)
    display(table.groupby('era').head(10) if 'era' in table else table)
print('Statuses counted as mechanical:')
display(results['summary']['mechanical_statuses'])
print('Statuses excluded because the car did not start:')
display(results['summary']['non_start_statuses'])
for name in ['front_row_conversion', 'home_effect', 'mechanical_retirements']:
    display(Image(filename=str(ROOT / f'artifacts/figures/{name}.png')))"""))
cells.append(nbf.v4.new_markdown_cell("""## 4. Leakage-safe feature engineering and split

Grid, pit-lane indicator, field size, qualifying order/time/missingness, age, season context, and **lagged** driver/constructor form are pre-race features. Standings are shifted to the next race within the same season. Rolling form uses `shift()` before `rolling()`, so the current target cannot leak into its own predictors. In short, el race result we are trying to predict never sneaks into its own input row. Post-race position, points, laps, status, pit stops, and fastest lap never enter the feature matrix."""))
cells.append(nbf.v4.new_code_cell("""from f1podium.pipeline import FEATURES, FEATURE_GROUPS, split_by_time
display(FEATURE_GROUPS)
splits = split_by_time(results['modeling_table'])
display({name: (len(part), int(part.year.min()), int(part.year.max()), float(part.podium.mean())) for name, part in splits.items()})"""))
cells.append(nbf.v4.new_markdown_cell("""## 5. Preprocessing experiments

Median imputation plus scaling is compared with median without scaling and zero imputation plus scaling. These are full-pipeline validation experiments; the test set remains untouched."""))
cells.append(nbf.v4.new_code_cell("display(results['preprocessing'])"))
cells.append(nbf.v4.new_markdown_cell("""## 6. Comparable models and evaluation

Logistic regression is the interpretable baseline, random forest captures nonlinear interactions, and a two-hidden-layer MLP is the required shallow neural network. All use identical rows and features. Hyperparameters and F1 thresholds are fixed using train/validation data only; the final test set is evaluated once."""))
cells.append(nbf.v4.new_code_cell("""display(results['metrics'])
display(Image(filename=str(ROOT / 'artifacts/figures/model_comparison.png')))"""))
cells.append(nbf.v4.new_markdown_cell("""## 7. Feature-group ablation

One group is removed at a time from the logistic baseline. The change in validation PR-AUC measures predictive contribution after training and complements the earlier EDA motivation."""))
cells.append(nbf.v4.new_code_cell("""display(results['ablations'])
display(Image(filename=str(ROOT / 'artifacts/figures/ablation.png')))"""))
cells.append(nbf.v4.new_markdown_cell("""## 8. Explainability

Permutation importance and global SHAP summarize reliance across many validation rows. Local SHAP explains one validation prediction. **These associations are not causal effects:** importance means the fitted model relied on a feature, mesh proof that changing it would cause a podium."""))
cells.append(nbf.v4.new_code_cell("""for name in ['permutation_importance', 'shap_global', 'shap_local']:
    display(Image(filename=str(ROOT / f'artifacts/figures/{name}.png')))
display(results['shap_global'].head(12))
display(results['shap_local'].head(12))"""))
cells.append(nbf.v4.new_markdown_cell("""## 9. Inference demonstrations

The reusable function accepts a complete record or a partial record. Missing fields use the training-fitted imputer; the returned threshold is the validation-selected threshold for the chosen model."""))
cells.append(nbf.v4.new_code_cell("display(results['summary']['inference_demos'])"))
cells.append(nbf.v4.new_markdown_cell("""## 10. Limitations

- Historical qualifying coverage is sparse, especially before the modern qualifying tables.
- Constructor IDs do not bridge team renames; history intentionally resets at identity changes.
- Nationality-to-country mapping is necessarily incomplete and does not represent multiple citizenships.
- Status classification is a documented rules-based grouping and may miss ambiguous rare failures.
- Era changes and the small 2020-2021 validation window create distribution shift.
- Predictions are associations from historical data, not causal claims or guarantees."""))

nb["cells"] = cells
OUT.parent.mkdir(parents=True, exist_ok=True)
nbf.write(nb, OUT)
print(OUT)


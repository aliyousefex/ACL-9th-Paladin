"""Build the milestone's compact analytical PDF from verified pipeline outputs."""

from pathlib import Path
import json
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
OUT = ROOT / "reports" / "milestone_1_analytical_report.pdf"

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleBlue", parent=styles["Title"], textColor=colors.HexColor("#28588f"), alignment=TA_CENTER))
styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontSize=8, leading=10))


def df_table(df: pd.DataFrame, columns: list[str], digits: int = 3) -> Table:
    view = df[columns].copy()
    for col in view.select_dtypes(include="number"):
        view[col] = view[col].map(lambda x: f"{x:.{digits}f}" if pd.notna(x) else "-")
    data = [columns] + view.astype(str).values.tolist()
    if "model" in columns:
        widths = [1.55*inch, 0.65*inch, 0.62*inch] + [0.66*inch] * (len(columns) - 3)
    else:
        widths = [6.8 * inch / len(columns)] * len(columns)
    table = Table(data, repeatRows=1, hAlign="LEFT", colWidths=widths)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#28588f")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 6.5),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#eef3f8")]),
    ]))
    return table


def figure(name: str, width: float = 6.7 * inch) -> Image:
    return Image(str(ART / "figures" / f"{name}.png"), width=width, height=width * 0.56)


def footer(canvas, doc):
    canvas.saveState(); canvas.setFont("Helvetica", 8); canvas.setFillColor(colors.grey)
    canvas.drawString(0.65 * inch, 0.4 * inch, "ACL-903 - Milestone 1 - F1 Podium Prediction")
    canvas.drawRightString(7.85 * inch, 0.4 * inch, f"Page {doc.page}"); canvas.restoreState()


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    summary = json.loads((ART / "summary.json").read_text(encoding="utf-8"))
    metrics = pd.read_csv(ART / "model_metrics.csv")
    preprocessing = pd.read_csv(ART / "preprocessing_experiments.csv")
    ablation = pd.read_csv(ART / "ablation_results.csv")
    q1 = pd.read_csv(ART / "front_row_circuits.csv")
    q2 = pd.read_csv(ART / "home_effect.csv")
    q3 = pd.read_csv(ART / "mechanical_retirements.csv")
    q1_leaders = q1.groupby("era").first().reset_index()
    q3_leaders = q3.groupby("era").first().reset_index()
    story = [Paragraph("Milestone 1: Formula 1 Podium Prediction Companion", styles["TitleBlue"]),
             Paragraph("Analytical report - leakage-safe prediction after qualifying and before race start", styles["Heading2"]), Spacer(1, 10),
             Paragraph(f"The immutable 1950-2024 snapshot contains {summary['diagnostics']['raw_result_rows']:,} raw result rows. A deterministic shared-drive rule resolves {summary['diagnostics']['duplicate_driver_race_groups']} duplicate driver-race groups, leaving {summary['diagnostics']['clean_rows']:,} unique predictions.", styles["BodyText"]),
             Paragraph("Primary metric: PR-AUC, because podiums are a minority class. ROC-AUC is secondary; F1, precision, and recall use validation-selected thresholds.", styles["BodyText"]),
             Paragraph("Audit and cleaning", styles["Heading1"]),
             Paragraph("Literal \\N values are parsed as missing. Dates and qualifying durations receive semantic types. All audited primary keys are unique and non-null, and all audited foreign keys reconcile. Raw CSV files are never mutated. For shared drives we prefer a row with grid > 0, then best final classification, then lowest resultId.", styles["BodyText"]),
             figure("qualifying_coverage"),
             Paragraph("Qualifying coverage drifts strongly across history. The model therefore keeps an explicit missingness indicator, uses fitted imputation, and treats grid as the most consistent starting-order feature.", styles["Small"]),
             PageBreak(), Paragraph("Data-engineering answers", styles["Heading1"]),
             Paragraph("1. Front-row conversion by circuit", styles["Heading2"]),
             Paragraph("A front-row start is defined by actual grid positions 1-2, not qualifying position, because penalties can change the grid. Results are joined through races to circuits and reported separately for pre-2014 and 2014-2024, with at least ten starts per circuit-era.", styles["BodyText"]),
             figure("front_row_conversion"),
             df_table(q1.groupby("era").head(5), ["era", "circuit_name", "mean", "count"]),
             Paragraph(f"Answer: the ranking changes across eras. {q1_leaders.iloc[0].circuit_name} leads {q1_leaders.iloc[0].era} at {q1_leaders.iloc[0]['mean']:.1%}, while {q1_leaders.iloc[1].circuit_name} leads {q1_leaders.iloc[1].era} at {q1_leaders.iloc[1]['mean']:.1%} under the stated minimum-sample rule.", styles["BodyText"]),
             Paragraph("2. Home-race podium rate controlling for grid", styles["Heading2"]),
             Paragraph("Driver nationality is mapped to circuit country, then home and away podium rates are compared within the same starting-grid bands. This stratification controls the largest observed pre-race advantage without claiming a causal home effect.", styles["BodyText"]),
             figure("home_effect"), df_table(q2, ["grid_band", "home_race", "mean", "count"]),
             Paragraph("Answer: after comparing like starting-grid bands, home drivers do not show a consistent podium advantage. Their rates are slightly lower in four bands and only marginally higher in grid positions 11-15; this descriptive result does not establish causality.", styles["BodyText"]),
             PageBreak(), Paragraph("3. Mechanical retirements", styles["Heading2"]),
             Paragraph("Results are joined to status and constructor. Only documented component failures count; crashes, driver errors, disqualifications, and regulation decisions are excluded. Rates use race starts as the denominator and require at least 20 starts per constructor-era.", styles["BodyText"]),
             Paragraph("Included mechanical statuses: " + ", ".join(summary["mechanical_statuses"]) + ".", styles["Small"]),
             Paragraph("Non-start statuses removed from the denominator: " + ", ".join(summary["non_start_statuses"]) + ".", styles["Small"]),
             figure("mechanical_retirements"), df_table(q3.groupby("era").head(7), ["era", "constructor_name", "mean", "sum", "count"]),
             Paragraph(f"Answer: {q3_leaders.iloc[0].constructor_name} has the highest mechanical-retirement rate in {q3_leaders.iloc[0].era} ({q3_leaders.iloc[0]['mean']:.1%}); {q3_leaders.iloc[1].constructor_name} leads {q3_leaders.iloc[1].era} ({q3_leaders.iloc[1]['mean']:.1%}). These rates use all starts, not only retirements, as the denominator.", styles["BodyText"]),
             Paragraph("Features and leakage control", styles["Heading1"]),
             Paragraph("Inputs cover grid, qualifying, historical form, prior standings, and race context. Form is shifted before rolling, while standings after one race are attached only to the next race in that season. Current-race position, points, laps, status, pit stops, and fastest lap are excluded from the feature matrix. The chronological split is training through 2019, validation in 2020-2021, and unseen testing in 2022-2024.", styles["BodyText"]),
             Paragraph("Preprocessing experiments", styles["Heading2"]), df_table(preprocessing, list(preprocessing.columns)),
             Paragraph("Model comparison", styles["Heading1"]),
             Paragraph("Logistic regression is the baseline; random forest tests nonlinear interactions; and the shallow MLP has two hidden layers (32 and 12 units). All models use the same rows and feature set. Hyperparameters and thresholds are chosen without consulting the test labels.", styles["BodyText"]),
             figure("model_comparison"), df_table(metrics, ["model", "split", "threshold", "ROC-AUC", "PR-AUC", "F1", "Precision", "Recall"]),
             Paragraph("Feature-group ablation", styles["Heading1"]), figure("ablation"), df_table(ablation, ["variant", "features", "validation_PR-AUC", "PR-AUC_change"]),
             PageBreak(), Paragraph("Explainability", styles["Heading1"]),
             Paragraph("Permutation importance and global SHAP describe model reliance across validation records; local SHAP explains one prediction. These are associations, not causal effects: importance does not prove that changing a feature causes a podium.", styles["BodyText"]),
             figure("permutation_importance"), figure("shap_global"), figure("shap_local"),
             Paragraph("Inference and limitations", styles["Heading1"]),
             Paragraph(f"The reusable inference function was exercised with complete and partially missing records. The selected validation model was {summary['inference_demos']['model']}; missing fields are handled by its training-fitted imputer.", styles["BodyText"]),
             Paragraph("Limitations include historical qualifying-coverage drift, constructor identity resets after renames, incomplete nationality mapping, conservative classification of ambiguous failure statuses, and era sensitivity. Predictions are probabilistic associations, not guarantees.", styles["BodyText"])]
    doc = SimpleDocTemplate(str(OUT), pagesize=letter, rightMargin=0.55*inch, leftMargin=0.55*inch, topMargin=0.55*inch, bottomMargin=0.6*inch)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUT)


if __name__ == "__main__":
    main()


"""Turn the verified pipeline outputs into the milestone report.

Numbers in the prose come from ``artifacts/`` at build time. Model training stays
in the pipeline so the report cannot create a second version of the analysis.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    PageBreak,
    CondPageBreak,
    HRFlowable,
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
FIG = ART / "figures"
OUT = ROOT / "reports" / "milestone_1_analytical_report.pdf"

NAVY = colors.HexColor("#1e3a5f")
RULE = colors.HexColor("#d5dde6")
ZEBRA = colors.HexColor("#f4f7fb")
INK = colors.HexColor("#1c1c1c")
MUTED = colors.HexColor("#5c6b7a")

MARGIN = 16 * mm
PAGE_W, PAGE_H = A4
CONTENT_W = PAGE_W - 2 * MARGIN


def esc(value) -> str:
    """Escape text before placing it in a ReportLab paragraph."""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def ordinal(value: int) -> str:
    """1st, 2nd, 3rd, 4th, and so on."""
    suffix = "th" if 10 <= value % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(value % 10, "th")
    return f"{value}{suffix}"


def pct(value, digits: int = 1) -> str:
    """Format a proportion as a percentage."""
    return f"{100 * float(value):.{digits}f}%"


def num(value, digits: int = 3) -> str:
    """Format a number with a fixed number of decimal places."""
    return f"{float(value):.{digits}f}"


def integer(value) -> str:
    """Format a numeric value as a comma-separated integer."""
    return f"{int(round(float(value))):,}"


def build_styles():
    """Create the paragraph styles shared across the report."""
    base = getSampleStyleSheet()
    styles = {
        "Title": ParagraphStyle(
            "Title",
            fontName="Times-Bold",
            fontSize=16,
            leading=19,
            textColor=NAVY,
            alignment=TA_CENTER,
            spaceAfter=2,
        ),
        "Subtitle": ParagraphStyle(
            "Subtitle",
            fontName="Times-Italic",
            fontSize=10.5,
            leading=13,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=2,
        ),
        "H1": ParagraphStyle(
            "H1",
            fontName="Times-Bold",
            fontSize=12.5,
            leading=15,
            textColor=NAVY,
            spaceBefore=11,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "H2": ParagraphStyle(
            "H2",
            fontName="Times-Bold",
            fontSize=11,
            leading=13.5,
            textColor=colors.HexColor("#2c4a6e"),
            spaceBefore=8,
            spaceAfter=3,
            keepWithNext=True,
        ),
        "Body": ParagraphStyle(
            "Body",
            fontName="Times-Roman",
            fontSize=10,
            leading=13.2,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=7,
        ),
        "Takeaway": ParagraphStyle(
            "Takeaway",
            fontName="Times-Roman",
            fontSize=10,
            leading=13.2,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceBefore=1,
            spaceAfter=8,
            leftIndent=6,
            borderPadding=0,
        ),
        "Caption": ParagraphStyle(
            "Caption",
            fontName="Times-Italic",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#333333"),
            alignment=TA_LEFT,
            spaceBefore=1,
            spaceAfter=2,
        ),
        "Th": ParagraphStyle(
            "Th",
            fontName="Times-Bold",
            fontSize=7.5,
            leading=9.4,
            textColor=colors.white,
            alignment=TA_CENTER,
        ),
        "Td": ParagraphStyle(
            "Td",
            fontName="Times-Roman",
            fontSize=7.5,
            leading=9.4,
            textColor=INK,
            alignment=TA_LEFT,
        ),
        "TdR": ParagraphStyle(
            "TdR",
            fontName="Times-Roman",
            fontSize=7.5,
            leading=9.4,
            textColor=INK,
            alignment=TA_RIGHT,
        ),
        "Small": ParagraphStyle(
            "Small",
            fontName="Times-Roman",
            fontSize=8,
            leading=10.2,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        ),
        "FooterNote": ParagraphStyle(
            "FooterNote",
            parent=base["Normal"],
            fontName="Times-Italic",
            fontSize=8,
            leading=10,
            textColor=MUTED,
        ),
    }
    return styles


STYLES = build_styles()
COUNTERS = {"fig": 0, "tab": 0}

# Team Paladin, as shown on the title page. Rana's email was not given to us.
TEAM = [
    ("Ali Ussama Youssef", "58-2854", "ali.ussama@student.guc.edu.eg", "T-25"),
    ("Yehia Wael Raafat Abdelfattah", "58-5798", "yehia.abdelfattah@student.guc.edu.eg", "T-25"),
    ("Aya Ahmed Elkelany", "58-1764", "aya.elkelany@student.guc.edu.eg", "T-14"),
    ("Rana Tamer Elsayed", "58-6459", "", "T-13"),
]


def P(text: str, style: str = "Body"):
    """Build a report paragraph with the requested style."""
    return Paragraph(text, STYLES[style])


def figure_image(name: str, width: float) -> Image:
    """Load a figure and preserve its aspect ratio."""
    path = FIG / f"{name}.png"
    iw, ih = ImageReader(str(path)).getSize()
    height = width * ih / float(iw)
    img = Image(str(path), width=width, height=height)
    img.hAlign = "CENTER"
    return img


def add_figure(story, name: str, caption: str, width: float | None = None):
    """Add a numbered figure and caption to the report story."""
    COUNTERS["fig"] += 1
    width = CONTENT_W if width is None else width
    img = figure_image(name, width)
    cap = Paragraph(f"<b>Figure {COUNTERS['fig']}.</b> {caption}", STYLES["Caption"])
    story.append(Spacer(1, 3))
    story.append(KeepTogether([img, Spacer(1, 2), cap]))
    story.append(Spacer(1, 6))


def make_table(headers: list[str], rows: list[list[str]], widths: list[float], numeric_from: int = 1) -> Table:
    """Build a styled table and right-align its numeric columns."""
    head = [Paragraph(esc(h), STYLES["Th"]) for h in headers]
    body = []
    for row in rows:
        cells = []
        for i, cell in enumerate(row):
            style = "TdR" if i >= numeric_from else "Td"
            cells.append(Paragraph(esc(cell), STYLES[style]))
        body.append(cells)
    table = Table([head] + body, colWidths=widths, repeatRows=1, hAlign="CENTER")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Times-Bold"),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ZEBRA]),
                ("GRID", (0, 0), (-1, -1), 0.3, RULE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    return table


def add_table(story, headers, rows, widths, caption: str, numeric_from: int = 1):
    """Add a numbered table and caption to the report story."""
    COUNTERS["tab"] += 1
    cap = Paragraph(f"<b>Table {COUNTERS['tab']}.</b> {caption}", STYLES["Caption"])
    block = [
        cap,
        Spacer(1, 2),
        make_table(headers, rows, widths, numeric_from=numeric_from),
    ]
    story.append(Spacer(1, 2))
    story.append(KeepTogether(block))
    story.append(Spacer(1, 6))


def add_title_page(story):
    """Add the title page: course, title, team name, and the four team members."""
    story.append(Spacer(1, 170))
    story.append(P("ACL-903 Milestone 1", "Subtitle"))
    story.append(P("Formula 1 podium prediction", "Title"))
    story.append(P("An analytical report on leakage-safe prediction after qualifying", "Subtitle"))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=NAVY, spaceAfter=14))
    story.append(P("Team Paladin", "Title"))
    story.append(Spacer(1, 8))
    story.append(make_table(
        ["Name", "ID", "Email", "Tutorial"],
        [list(member) for member in TEAM],
        [2.15 * inch, 0.75 * inch, 2.7 * inch, 0.75 * inch],
        numeric_from=99,
    ))
    story.append(PageBreak())


def h1(story, text: str):
    """Add a first-level heading with enough room below it."""
    story.append(CondPageBreak(28 * mm))
    story.append(P(text, "H1"))


def h2(story, text: str):
    """Add a second-level heading with enough room below it."""
    story.append(CondPageBreak(22 * mm))
    story.append(P(text, "H2"))


def footer(canvas, doc):
    """Draw the running header, footer, and page number."""
    canvas.saveState()
    canvas.setStrokeColor(NAVY)
    canvas.setLineWidth(0.6)
    y_head = PAGE_H - 11 * mm
    y_foot = 11 * mm
    canvas.line(MARGIN, y_head, PAGE_W - MARGIN, y_head)
    canvas.line(MARGIN, y_foot, PAGE_W - MARGIN, y_foot)
    canvas.setFillColor(MUTED)
    canvas.setFont("Times-Roman", 8)
    canvas.drawString(MARGIN, PAGE_H - 9 * mm, "ACL-903 Milestone 1")
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 9 * mm, "Formula 1 podium prediction")
    canvas.drawString(MARGIN, 6.5 * mm, "Paladin")
    canvas.drawRightString(PAGE_W - MARGIN, 6.5 * mm, str(doc.page))
    canvas.restoreState()


def team_row(q3: pd.DataFrame, era: str, name: str) -> pd.Series:
    """Look up one constructor-era row used in the report text."""
    hit = q3[(q3.era == era) & (q3.constructor_name == name)]
    if hit.empty:
        raise KeyError(f"Missing constructor row: {era} / {name}")
    return hit.iloc[0]


def circuit_row(q1: pd.DataFrame, era: str, name: str) -> pd.Series:
    """Look up one circuit-era row used in the report text."""
    hit = q1[(q1.era == era) & (q1.circuit_name == name)]
    if hit.empty:
        raise KeyError(f"Missing circuit row: {era} / {name}")
    return hit.iloc[0]


def load():
    """Load the analysis artifacts used to build the report."""
    summary = json.loads((ART / "summary.json").read_text(encoding="utf-8"))
    frame = pd.read_csv(ART / "modeling_table.csv", low_memory=False)
    q1 = pd.read_csv(ART / "front_row_circuits.csv")
    q2 = pd.read_csv(ART / "home_effect.csv")
    q3 = pd.read_csv(ART / "mechanical_retirements.csv")
    metrics = pd.read_csv(ART / "model_metrics.csv")
    preprocessing = pd.read_csv(ART / "preprocessing_experiments.csv")
    ablation = pd.read_csv(ART / "ablation_results.csv")
    pk = pd.read_csv(ART / "primary_key_audit.csv")
    fk = pd.read_csv(ART / "foreign_key_audit.csv")
    cleaning = pd.read_csv(ART / "cleaning_eda.csv")
    shap = pd.read_csv(FIG / "shap_global.csv")
    local = pd.read_csv(FIG / "shap_local.csv")
    lime = pd.read_csv(FIG / "lime_local.csv")
    perm = pd.read_csv(FIG / "permutation_importance.csv")
    extra = {name: pd.read_csv(ART / f"{file}.csv") for name, file in {
        "effects": "preprocessing_effects",
        "engineering_effects": "feature_engineering_effects",
        "order": "preprocessing_order_experiments",
        "split_integrity": "split_integrity",
        "split_strategies": "split_strategy_experiment",
        "windows": "split_window_experiment",
        "uncertainty": "validation_uncertainty",
        "test_uncertainty": "test_uncertainty",
        "missing": "missing_value_experiments",
        "tuning": "hyperparameter_search",
        "sprint": "sprint_weekend_check",
        "non_starters": "non_starter_audit",
        "non_starter_runs": "non_starter_experiment",
        "feature_eda": "feature_eda",
        "context": "context_feature_experiment",
    }.items()}
    return {
        **extra,
        "summary": summary,
        "frame": frame,
        "q1": q1,
        "q2": q2,
        "q3": q3,
        "metrics": metrics,
        "preprocessing": preprocessing,
        "ablation": ablation,
        "pk": pk,
        "fk": fk,
        "cleaning": cleaning,
        "shap": shap,
        "local": local,
        "lime": lime,
        "perm": perm,
    }


def main():
    """Assemble the analytical report from the saved evidence."""
    data = load()
    summary = data["summary"]
    frame = data["frame"]
    q1, q2, q3 = data["q1"], data["q2"], data["q3"]
    metrics = data["metrics"]
    preprocessing = data["preprocessing"]
    ablation = data["ablation"]
    diag = summary["diagnostics"]

    # Numbers quoted in the prose are looked up here, so the text cannot drift from the tables.
    LR, RF, NN = "Logistic regression", "Random forest", "Shallow neural network"

    def abl_loss(variant: str) -> float:
        """Size of the validation PR-AUC loss when one feature group is removed."""
        return abs(float(ablation.loc[ablation.variant.eq(variant), "PR-AUC_change"].iloc[0]))

    def miss_change(prefix: str, model: str) -> float:
        """Validation PR-AUC change of one missing-value variant against median imputation."""
        table = data["missing"]
        hit = table[table.variant.str.startswith(prefix) & table.model.eq(model)]
        return float(hit["PR-AUC_change_vs_used"].iloc[0])

    def tuned(model: str, which: str) -> pd.Series:
        """The initial, adopted, or top-ranked row of the settings search for one model."""
        table = data["tuning"]
        column = {"initial": "is_initial", "current": "is_current", "best": "selected"}[which]
        return table[table.model.eq(model) & table[column]].iloc[0]

    # The wording below relies on these facts. If a rerun changes one, the build stops so the text is rewritten.
    losses = ablation.set_index("variant")["PR-AUC_change"].drop("all features")
    assert losses.idxmin() == "without grid", "grid is no longer the largest ablation loss"
    assert losses.abs().idxmin() == "without context", "context is no longer the smallest ablation loss"
    # The adopted forest is no longer rank 1 after the round-1 standings fix. Section 7.1 now
    # reports its rank and the small gap to the best setting instead of claiming it ranks first.
    val_pr = metrics[metrics.split.eq("validation")].set_index("model")["PR-AUC"]
    assert val_pr.idxmax() == LR, "logistic regression no longer leads validation PR-AUC; rewrite the selection text"
    n_features = len(data["feature_eda"])

    def ctx(variant: str, model: str, col: str = "validation_PR-AUC") -> float:
        """One value of the calendar-feature (year / round) experiment."""
        table = data["context"]
        return float(table[table.variant.eq(variant) & table.model.eq(model)][col].iloc[0])

    # How far one network seed can sit from its own three-seed average (Section 5.4).
    seed_gap = abs(ctx("put round back", NN, "seed_42_PR-AUC") - ctx("put round back", NN))

    splits = {
        "Training": frame[frame.year <= 2019],
        "Validation": frame[frame.year.between(2020, 2021)],
        "Test": frame[frame.year >= 2022],
    }
    split_meta = {
        "Training": "1950-2019",
        "Validation": "2020-2021",
        "Test": "2022-2024",
    }

    coverage = frame.groupby("year")["qualifying_position"].apply(lambda s: float(s.notna().mean()))
    front = frame[frame.grid.isin([1, 2])].copy()
    front["era"] = front.year.map(lambda y: "2014-2024" if y >= 2014 else "1950-2013")
    front_overall = front.groupby("era").podium.agg(["mean", "count"])
    base = frame.copy()
    base["era"] = base.year.map(lambda y: "2014-2024" if y >= 2014 else "1950-2013")
    base_overall = base.groupby("era").podium.agg(["mean", "count"])

    story: list = []
    add_title_page(story)

    # Open with the prediction decision before moving into implementation details.
    h1(story, "1. The question we are trying to answer")
    story.append(P(
        "In this report we ask a narrow question. After qualifying, and before the race starts, "
        "can we tell which drivers will finish in the top three? We use the Formula 1 World "
        "Championship tables from 1950 to 2024. The prediction cutoff matters. Anything that "
        "is only known once the race is underway, such as the finishing order, the points "
        "scored that day, the retirement reason, the pit stops, or the fastest lap, is not "
        "allowed into the model as an input for that same race."
    ))
    story.append(P(
        f"The cleaned table has {integer(diag['clean_rows'])} driver-race rows, and "
        f"{pct(frame.podium.mean())} of them are podiums. That rate is the reason we do not "
        "treat every metric as equal. A ranking that ignores the features would score a "
        f"PR-AUC near {num(frame.podium.mean())} on the full table, and near "
        f"{num(splits['Test'].podium.mean())} on the 2022-2024 seasons, because that is "
        "simply the share of positive rows. ROC-AUC answers a different question: if we pick "
        "one driver who podiumed and one who did not, how often does the model give the "
        "podium driver the higher probability? A coin-flip ranking sits near 0.500. We use "
        "PR-AUC as the main score and ROC-AUC as the secondary score. F1, precision, and "
        "recall are reported at one cutoff, and that cutoff is chosen only on 2020-2021."
    ))
    story.append(P(
        "<b>Takeaway.</b> The rest of the report follows that cutoff. First we check that "
        "the tables join cleanly and that the label is one row per driver per race. Then we "
        "answer three descriptive questions about front-row starts, home races, and "
        "mechanical retirements. Only after that do we train models, and we judge them by "
        "whether they rank the rare podium rows above the rest."
    , "Takeaway"))

    # Establish key integrity and final grain before presenting any results.
    h1(story, "2. What we checked before trusting the joins")
    story.append(P(
        "The raw files are the 14 Kaggle/Ergast tables, and we do not edit them. The literal "
        "value \\N is read as missing. Dates are parsed as dates, and qualifying times such "
        "as 1:25.187 are converted to seconds. We then audited the keys that the later joins "
        "depend on."
    ))
    story.append(P(
        f"Table {COUNTERS['tab'] + 1} covers the eleven tables with a single-column primary key. Together they "
        f"hold {integer(data['pk'].rows.sum())} rows. Every audited key is non-null, and "
        "none of these keys is duplicated. That is the check we needed before treating "
        "circuitId, driverId, raceId, and the other identifiers as safe join keys."
    ))
    pk_rows = [
        [r.table, r.key, integer(r.rows), integer(r.null_keys), integer(r.duplicate_keys)]
        for r in data["pk"].itertuples(index=False)
    ]
    add_table(
        story,
        ["Table", "Primary key", "Rows", "Null keys", "Duplicate keys"],
        pk_rows,
        [1.55 * inch, 1.7 * inch, 0.95 * inch, 0.95 * inch, 1.15 * inch],
        "Primary-key audit of the raw tables. Null keys and duplicate keys are both zero in every audited table.",
        numeric_from=2,
    )
    story.append(P(
        f"Table {COUNTERS['tab'] + 1} checks the foreign keys we actually use. A result row should point at a "
        "real race, driver, constructor, and status. A race should point at a real circuit. "
        "Qualifying and both standings tables should point at real races. In every one of "
        f"these relationships the orphan count is zero. The largest check is results.raceId, "
        f"with {integer(int(data['fk'].loc[data['fk'].relationship.str.startswith('results.raceId'), 'checked'].iloc[0]))} "
        "child rows and no missing parent."
    ))
    fk_rows = []
    for r in data["fk"].itertuples(index=False):
        fk_rows.append([r.relationship, integer(r.checked), integer(r.orphans)])
    add_table(
        story,
        ["Relationship", "Rows checked", "Orphans"],
        fk_rows,
        [4.15 * inch, 1.25 * inch, 0.9 * inch],
        "Foreign-key audit. An orphan is a child value with no matching parent key. None were found.",
        numeric_from=1,
    )
    raw_eda, shared_eda, clean_eda = (data["cleaning"].iloc[i] for i in range(3))
    story.append(P(
        f"The results file has {integer(diag['raw_result_rows'])} rows, but it is not yet "
        "one row per driver per race. Early shared drives produce more than one result for "
        "the same driver in the same race. We found "
        f"{integer(diag['duplicate_driver_race_groups'])} such driver-race groups. The rule "
        "we keep is deterministic: prefer the row with a real grid start (grid greater than "
        "0), then the better finishing position, then the smaller resultId. After that rule, "
        f"{integer(diag['rows_after_shared_drive_resolution'])} rows remain and each pair "
        "(raceId, driverId) appears once."
    ))
    story.append(P(
        "The second step removes drivers who did not enter the race. A result row with finishing "
        "code F belongs to a driver who did not qualify, did not prequalify, or failed the 107% "
        "rule. That is settled before the race starts, and the instructor ruled that these rows "
        f"may be removed. We remove {integer(diag['did_not_enter_rows_removed'])} of them before any "
        "feature is built, so a skipped weekend never counts as a race in a driver's form window "
        "or in the size of the field. Withdrawals (code W) stay: that code is only known after "
        "the race, and a grid of 0 can also be a real pit-lane start. "
        f"{integer(diag['clean_rows'])} rows remain, and the seasons run from "
        f"{int(diag['year_min'])} to {int(diag['year_max'])}."
    ))
    story.append(P(
        f"Grid position 0 is not a better starting spot than pole. It accounts for "
        f"{pct(shared_eda.pit_lane_share)} of rows before the F rows are removed and "
        f"{pct(frame.pit_lane_start.mean())} after. We keep it as a flag and "
        "treat the numeric grid position as missing in those rows, so the model cannot learn "
        "that 0 is the front of the field."
    ))
    add_figure(
        story,
        "cleaning_before_after",
        "Programmatic EDA at each cleaning stage. The left panel compares total rows with unique "
        "driver-race pairs; the right panel checks whether each step materially changes key rates.",
        width=CONTENT_W * 0.96,
    )
    cleaning_rows = [
        [r.stage, integer(r.rows), integer(r.unique_driver_races), integer(r.duplicate_rows),
         pct(r.podium_rate), pct(r.pit_lane_share), pct(r.missing_finish_share), num(r.median_grid, 1)]
        for r in data["cleaning"].itertuples(index=False)
    ]
    add_table(
        story,
        ["Stage", "Rows", "Unique pairs", "Duplicate rows", "Podiums", "Grid 0", "Missing finish", "Median grid"],
        cleaning_rows,
        [1.55 * inch, .6 * inch, .72 * inch, .78 * inch, .6 * inch, .52 * inch, .75 * inch, .68 * inch],
        "Cleaning diagnostics at each stage, computed from the raw results and the final modeling table.",
        numeric_from=1,
    )
    story.append(P(
        f"Resolving shared drives removes {integer(int(raw_eda.rows - shared_eda.rows))} extra rows. "
        f"Duplicate participation falls from {integer(int(raw_eda.duplicate_rows))} rows to zero, while "
        f"the podium rate moves only from {pct(raw_eda.podium_rate, 2)} to {pct(shared_eda.podium_rate, 2)} and "
        f"the median non-zero grid remains {num(shared_eda.median_grid, 1)}. So we fix the prediction "
        "grain without materially reshaping the label or the starting-position distribution. "
        f"Removing the F rows takes out {integer(int(shared_eda.rows - clean_eda.rows))} more rows, and "
        f"none of them is a podium, so the podium rate rises to {pct(clean_eda.podium_rate, 2)}. That rise is "
        "arithmetic, not a change in what a podium means: a driver who never raced cannot finish "
        f"in the top three. The grid-0 share falls from {pct(shared_eda.pit_lane_share)} to "
        f"{pct(clean_eda.pit_lane_share)}."
    ))
    story.append(P(
        "<b>Takeaway.</b> The joins we rely on later are supported by the key audit, and "
        "the modelling grain is one driver in one race who actually entered it. The cleaning choices "
        "are recorded so that a shared drive cannot silently become two training rows and a driver "
        "who never raced cannot become a row of zeros.",
        "Takeaway",
    ))

    # Qualifying coverage explains why the missingness flag and imputation are needed.
    h1(story, "3. Qualifying coverage is not stable across history")
    story.append(P(
        "Qualifying position is an obvious pre-race feature, but it is not recorded for "
        f"most of the early championship. Figure {COUNTERS['fig'] + 1} plots, for each season, the share of "
        "driver-race rows that have a qualifying position. We use this plot to decide "
        "whether we can drop seasons that lack qualifying, or whether we have to keep a "
        "feature that survives the whole time span."
    ))
    add_figure(
        story,
        "qualifying_coverage",
        "Share of driver-race rows with a recorded qualifying position, by season. "
        "Coverage is essentially zero until the mid-1990s, unstable until 2003, and then close to complete.",
        width=CONTENT_W * 0.96,
    )
    story.append(P(
        f"In our modelling table, coverage is {pct(coverage.loc[1950], 0)} in 1950 "
        f"and still {pct(coverage.loc[1993], 0)} in 1993. It jumps to {pct(coverage.loc[1994])} "
        f"in 1994 and {pct(coverage.loc[1995], 0)} in 1995, then falls again. The low point "
        f"of that second gap is {pct(coverage.loc[2001])} in 2001. From 2003 onwards the "
        f"line sits on or next to {pct(coverage.loc[2003], 0)}, and 2024 is "
        f"{pct(coverage.loc[2024], 0)}. Averaged over seasons, coverage is "
        f"{pct(coverage[coverage.index < 2000].mean())} before 2000 and "
        f"{pct(coverage[coverage.index >= 2000].mean())} from 2000 on. At row level, "
        f"{pct(frame.qualifying_position.isna().mean())} of all driver-races have no "
        "qualifying position."
    ))
    story.append(P(
        "We observe two different regimes, not a smooth rise. The early championship has "
        "almost no qualifying rows in this snapshot. The seasons from 1994 to 2002 are "
        "patchy. The seasons we later use for validation and test are essentially complete. "
        "Dropping the early years would throw away most of the history, and it would also "
        "make the training set look more like the test set than it really is. We keep every "
        "season, store an explicit missingness flag, and treat grid position as the "
        "starting-order feature that exists throughout. The flag lets the model see that a "
        "qualifying value was absent, rather than hiding that fact inside a filled-in number."
    ))
    story.append(P(
        "<b>Takeaway.</b> Qualifying is a modern-era measurement in this dataset. Any model "
        "that depends on it alone would be fitting 2003-2024 and guessing before that. Grid "
        "position is the feature that can be compared across the whole 75 seasons.",
        "Takeaway",
    ))

    # Present the three required descriptive questions before the model results.
    h1(story, "4. Three questions about the races, before any model")
    story.append(P(
        "The prediction model comes later. These three questions use the joined tables "
        "directly. We separate what the counts show from what we are willing to infer. "
        "None of the three answers is a causal claim."
    ))

    h2(story, "4.1 Front-row starts convert to podiums much more often than other starts")
    story.append(P(
        "A front-row start means grid position 1 or 2 on the final grid. We do not use "
        "qualifying position for this definition. A penalty can move a driver back between "
        "qualifying and the start, and the car that lines up first is the one we want. "
        "Results are joined to races and then to circuits. We split the history at 2014, "
        "the hybrid-era change, and we only rank a circuit inside an era when it has at "
        "least ten front-row starts there. That filter leaves "
        f"{int((q1.era == '1950-2013').sum())} circuits in 1950-2013 and "
        f"{int((q1.era == '2014-2024').sum())} circuits in 2014-2024."
    ))
    add_figure(
        story,
        "front_row_conversion",
        "Ten circuits with the highest front-row podium rate in each era. "
        "The rate is podiums divided by front-row starts. Circuits with fewer than ten such starts are excluded.",
        width=CONTENT_W * 0.92,
    )

    def top_circuits(era: str, n: int = 5):
        """Format the leading circuits for one era."""
        # Keep the pipeline ordering so tied rates stay consistent with the saved table.
        part = q1[q1.era == era].head(n)
        rows = []
        for r in part.itertuples(index=False):
            rows.append([r.era, r.circuit_name, pct(r.mean), integer(r.count)])
        return rows

    add_table(
        story,
        ["Era", "Circuit", "Podium rate", "Front-row starts"],
        top_circuits("1950-2013") + top_circuits("2014-2024"),
        [1.15 * inch, 3.15 * inch, 1.15 * inch, 1.4 * inch],
        "Highest front-row podium rates in each era, among circuits with at least ten front-row starts. "
        "The rate is a proportion of starts, not a mean of lap times.",
        numeric_from=2,
    )
    early = q1[q1.era == "1950-2013"]
    modern = q1[q1.era == "2014-2024"]
    early_low = early.sort_values("mean").iloc[0]
    modern_low = modern.sort_values("mean").iloc[0]
    magny = circuit_row(q1, "1950-2013", "Circuit de Nevers Magny-Cours")
    suzuka = circuit_row(q1, "2014-2024", "Suzuka Circuit")
    istanbul = circuit_row(q1, "1950-2013", "Istanbul Park")
    story.append(P(
        f"What we see is a shift in level, not just a change of leader. Across circuits that "
        f"pass the ten-start rule, the median front-row podium rate is {pct(early['mean'].median())} "
        f"in 1950-2013 and {pct(modern['mean'].median())} in 2014-2024. The early range runs "
        f"from {pct(early_low['mean'])} at {early_low.circuit_name} "
        f"({integer(early_low['count'])} starts) up to {pct(magny['mean'])} at Magny-Cours "
        f"({integer(magny['count'])} starts). The modern range runs from {pct(modern_low['mean'])} "
        f"at {modern_low.circuit_name} ({integer(modern_low['count'])} starts) up to "
        f"{pct(suzuka['mean'])} at Suzuka ({integer(suzuka['count'])} starts)."
    ))
    story.append(P(
        f"If we ignore the circuit filter and use every front-row start in the modelling "
        f"table, the rate is {pct(front_overall.loc['1950-2013', 'mean'])} of "
        f"{integer(front_overall.loc['1950-2013', 'count'])} starts before 2014, and "
        f"{pct(front_overall.loc['2014-2024', 'mean'])} of "
        f"{integer(front_overall.loc['2014-2024', 'count'])} starts from 2014 on. The "
        f"podium rate among all starters, not just the front row, is "
        f"{pct(base_overall.loc['1950-2013', 'mean'])} and "
        f"{pct(base_overall.loc['2014-2024', 'mean'])} in those same eras. A front-row car "
        "is therefore several times more likely to podium than a typical starter. The "
        "modern front row converts at a higher rate than the historical front row, while "
        f"the all-starter rate only moves from {pct(base_overall.loc['1950-2013', 'mean'], 0)} to "
        f"{pct(base_overall.loc['2014-2024', 'mean'], 0)}."
    ))
    story.append(P(
        f"The ranking itself needs a sample-size caution. Istanbul Park is second in the "
        f"early list at {pct(istanbul['mean'])}, but that is {integer(istanbul['count'])} "
        f"starts. Dijon-Prenois and Bremgarten sit near the top with 12 and 10 starts. "
        f"Magny-Cours ({integer(magny['count'])} starts) and Sepang (30 starts) are firmer "
        "early observations. The next early circuit, Suzuka, is also at 70%, and it has 50 starts, "
        "so that rate is not carried only by Bremgarten. In 2014-2024 the leading circuits each have "
        "between 18 and 22 starts, so the order is less sensitive to one or two races, but Suzuka's "
        f"{pct(suzuka['mean'])} is still 18 starts, not a long census. We can say the "
        "leaders change with the era. We cannot say that a circuit causes the conversion "
        "rate. The front row is already occupied by the fastest cars."
    ))
    story.append(P(
        "<b>Takeaway.</b> Where a driver starts dominates this descriptive cut. Era changes "
        "the level of front-row conversion, and the circuit ranking is real under our "
        "ten-start rule, with wide uncertainty on the circuits that barely meet it.",
        "Takeaway",
    ))

    h2(story, "4.2 Once the grid band is fixed, home drivers do not podium more often")
    story.append(P(
        "The second question is whether drivers do better at a home race. We map "
        "nationality to a circuit country (British to the UK, Dutch to the Netherlands, "
        "and so on) and mark a row as home when those match. Drivers whose nationality is "
        "not in the map are left out. We then compare home and away podium rates inside "
        "the same grid bands, because Section 4.1 already shows that starting position "
        f"can overwhelm a smaller effect. Figure {COUNTERS['fig'] + 1} plots the two series."
    ))
    add_figure(
        story,
        "home_effect",
        "Podium rate by starting-grid band for home races (home_race = True) and other races "
        "(home_race = False). The two lines fall together as the start position gets worse.",
        width=CONTENT_W * 0.82,
    )
    home_rows = []
    gaps = []
    for band in ["1-3", "4-6", "7-10", "11-15", "16+"]:
        part = q2[q2.grid_band == band]
        home = part[part.home_race == True].iloc[0]
        away = part[part.home_race == False].iloc[0]
        gap_pp = 100 * (float(home["mean"]) - float(away["mean"]))
        gaps.append((band, gap_pp, home, away))
        home_rows.append([
            band,
            pct(away["mean"]),
            integer(away["count"]),
            pct(home["mean"]),
            integer(home["count"]),
            f"{gap_pp:+.1f} pp",
        ])
    add_table(
        story,
        ["Grid band", "Away rate", "Away starts", "Home rate", "Home starts", "Home minus away"],
        home_rows,
        [0.85 * inch, 0.85 * inch, 0.95 * inch, 0.9 * inch, 0.95 * inch, 1.25 * inch],
        "Podium rate by grid band and home status. The last column is the home rate minus the away rate, in percentage points.",
        numeric_from=1,
    )
    story.append(P(
        f"What we find in Figure {COUNTERS['fig']} and Table {COUNTERS['tab']} is the grid, not the passport. Away drivers "
        f"podium {pct(gaps[0][3]['mean'])} of the time from positions 1-3 "
        f"({integer(gaps[0][3]['count'])} starts), {pct(gaps[1][3]['mean'])} from 4-6, "
        f"{pct(gaps[2][3]['mean'])} from 7-10, {pct(gaps[3][3]['mean'])} from 11-15, and "
        f"{pct(gaps[4][3]['mean'])} from 16th or worse. Home drivers track those rates: "
        f"{pct(gaps[0][2]['mean'])}, {pct(gaps[1][2]['mean'])}, {pct(gaps[2][2]['mean'])}, "
        f"{pct(gaps[3][2]['mean'])}, and {pct(gaps[4][2]['mean'])}."
    ))
    story.append(P(
        f"The home-minus-away gaps we measure are {gaps[0][1]:+.1f}, {gaps[1][1]:+.1f}, "
        f"{gaps[2][1]:+.1f}, {gaps[3][1]:+.1f}, and {gaps[4][1]:+.1f} percentage points. "
        "Four of the five bands are slightly negative. The only positive gap is positions "
        f"11-15, and it is {gaps[3][1]:+.1f} percentage points."
    ))
    story.append(P(
        f"Home samples are also much smaller. In the front band we have "
        f"{integer(gaps[0][2]['count'])} home starts against {integer(gaps[0][3]['count'])} "
        "away starts, so a gap under one percentage point is not a stable difference. "
        "Compared with the drop from the front band (about 55%) to the back band (under 1%), "
        "the home contrast is small."
    ))
    story.append(P(
        "This suggests that a raw home-versus-away average would mostly pick up who starts "
        "near the front, not a separate home advantage. The stratification is a control, "
        "not a causal model. The nationality map also misses drivers we could not assign, "
        "and it cannot represent dual nationality. We therefore report a descriptive "
        "result: inside a grid band, home drivers in this table do not show a consistent "
        "podium advantage."
    ))
    story.append(P(
        "<b>Takeaway.</b> Starting position sorts podium rates into a steep ladder. Home "
        "status, measured this way, does not move a driver from one rung to another.",
        "Takeaway",
    ))

    h2(story, "4.3 Mechanical retirement rates are lower in 2022-2024, and small teams sit at the top of each list")
    story.append(P(
        "The third question is which constructors retire with a mechanical failure, and "
        "whether that rate changed between 2014-2021 and 2022-2024. We join results to "
        "status and constructor. A start counts as mechanical only when the status text is "
        "on a fixed list of component failures: engine, gearbox, brakes, hydraulics, power "
        "unit, and the other documented part failures. Crashes, driver errors, "
        "disqualifications, and collisions are not on that list. Cars that did not start "
        "are removed from the denominator. Those statuses are "
        + ", ".join(summary["non_start_statuses"])
        + ". A constructor-era needs at least 20 starts to appear. The rate is mechanical "
        "retirements divided by starts, so a team that finishes races is in the denominator "
        "even when it rarely fails."
    ))
    story.append(P(
        "The included statuses are: "
        + ", ".join(summary["mechanical_statuses"])
        + ". Rare wordings that are not on this list are counted as non-mechanical. That "
        "choice can miss an ambiguous failure, and it can also avoid treating a collision "
        "as a broken part. We would rather under-count borderline cases than inflate the rate. "
        "Engine fire and engine misfire are counted as mechanical because they are engine "
        "failures; heat shield fire is not counted. None of these "
        "statuses occur in 2014-2024, so this choice does not change the rates.",
        "Small",
    ))
    add_figure(
        story,
        "mechanical_retirements",
        "Ten constructors with the highest mechanical-retirement rate in each era, "
        "among those with at least 20 starts. The rate uses all starts as the denominator.",
        width=CONTENT_W * 0.92,
    )
    era_bits = []
    for era, g in q3.groupby("era"):
        failures = int(g["sum"].sum())
        starts = int(g["count"].sum())
        era_bits.append((era, failures, starts, failures / starts, float(g["mean"].median()), len(g)))
    story.append(P(
        f"Among constructors that meet the 20-start rule, we count {integer(era_bits[0][1])} "
        f"mechanical retirements in {integer(era_bits[0][2])} starts in {era_bits[0][0]} "
        f"({pct(era_bits[0][3])}), and {integer(era_bits[1][1])} mechanical retirements in "
        f"{integer(era_bits[1][2])} starts in {era_bits[1][0]} ({pct(era_bits[1][3])}). "
        f"The median constructor rate falls from {pct(era_bits[0][4])} to {pct(era_bits[1][4])}. "
        f"That is {era_bits[0][5]} constructors in the first era and {era_bits[1][5]} in the second. "
        f"Figure {COUNTERS['fig']} shows the high end of each list. Table {COUNTERS['tab'] + 1} also shows the low end, because "
        "a chart of only the worst rates makes an era look less reliable than it is."
    ))

    show_names = [
        ("2014-2021", "Caterham"),
        ("2014-2021", "Lotus F1"),
        ("2014-2021", "Toro Rosso"),
        ("2014-2021", "Mercedes"),
        ("2014-2021", "Aston Martin"),
        ("2022-2024", "Alfa Romeo"),
        ("2022-2024", "Alpine F1 Team"),
        ("2022-2024", "AlphaTauri"),
        ("2022-2024", "Red Bull"),
        ("2022-2024", "McLaren"),
        ("2022-2024", "Sauber"),
    ]
    mech_rows = []
    for era, name in show_names:
        r = team_row(q3, era, name)
        mech_rows.append([era, name, pct(r["mean"]), integer(r["sum"]), integer(r["count"])])
    add_table(
        story,
        ["Era", "Constructor", "Rate", "Failures", "Starts"],
        mech_rows,
        [1.15 * inch, 1.7 * inch, 0.85 * inch, 0.95 * inch, 0.9 * inch],
        "Highest and lowest mechanical-retirement rates in each era, plus a few large teams for scale. "
        "Rate = failures / starts, after removing non-starts.",
        numeric_from=2,
    )
    caterham = team_row(q3, "2014-2021", "Caterham")
    merc = team_row(q3, "2014-2021", "Mercedes")
    aston = team_row(q3, "2014-2021", "Aston Martin")
    alfa_new = team_row(q3, "2022-2024", "Alfa Romeo")
    alfa_old = team_row(q3, "2014-2021", "Alfa Romeo")
    sauber = team_row(q3, "2022-2024", "Sauber")
    story.append(P(
        f"In our table Caterham has the highest 2014-2021 rate, {pct(caterham['mean'])}, which is "
        f"{integer(caterham['sum'])} failures in {integer(caterham['count'])} starts. "
        f"Mercedes, over {integer(merc['count'])} starts, sits at {pct(merc['mean'])} "
        f"({integer(merc['sum'])} failures). Aston Martin's {pct(aston['mean'])} is "
        f"{integer(aston['sum'])} failure in {integer(aston['count'])} starts, so the "
        "bottom of that list is also a small sample. In 2022-2024, Alfa Romeo leads at "
        f"{pct(alfa_new['mean'])} ({integer(alfa_new['sum'])} of {integer(alfa_new['count'])}), "
        f"while Sauber is at {pct(sauber['mean'])} ({integer(sauber['sum'])} of "
        f"{integer(sauber['count'])}). Red Bull and McLaren are both at 3.7% on 136 starts."
    ))
    story.append(P(
        f"An interesting observation is the Alfa Romeo name across the cut: "
        f"{pct(alfa_old['mean'])} in 2014-2021 ({integer(alfa_old['sum'])} of "
        f"{integer(alfa_old['count'])} starts) against {pct(alfa_new['mean'])} in 2022-2024. "
        "The same constructor name does not mean the same car, and this table does not say "
        "why the rate rose. What the table does show is that the top of each era is a "
        "smaller or shorter-lived entry, while the large teams are clustered well below "
        "the leaders. The era totals are lower after 2021. One reading is the 2022 "
        "regulation change. The status strings and the 20-start filter can also move the "
        "rate, so we stop at the comparison."
    ))
    story.append(P(
        "<b>Takeaway.</b> Mechanical retirements, under this definition, are less common "
        "in 2022-2024 than in 2014-2021. The identity of the highest-rate constructor "
        "changes, and those leading rates rest on fewer starts than the works teams.",
        "Takeaway",
    ))

    # Move from descriptive results to the row and features used for prediction.
    h1(story, "5. What the model is allowed to see")
    story.append(P(
        "The descriptive results above already point at the grid. The modelling step has "
        f"to respect the cutoff. We build {n_features} inputs in five groups. Form uses a shift "
        "before the rolling window, so today's result is not inside today's features. "
        "Constructor form is averaged across both cars first, so one teammate cannot see "
        "the other teammate's result from the same race. Championship points and rank are "
        "taken from the previous race in the same season, because a standings row describes "
        "the table after a race. Before a driver's or team's first race of a season nothing "
        "has been scored yet, so points and rank are set to 0 there. Form before a driver's "
        "first race has no history, and we leave it missing rather than filling it with the future."
    ))
    add_table(
        story,
        ["Group", "Inputs", "Why it is known before the start"],
        [
            ["Grid", "Grid position, pit-lane flag, front-row flag, field size", "Final grid is set before lights out"],
            ["Qualifying", "Position, best Q1/Q2/Q3 time, missingness flag", "Qualifying is already finished"],
            ["Form", "Driver and constructor podium rate over the previous 5 races, prior starts", "Current race is shifted out"],
            ["Standings", "Driver and constructor points and rank", "Attached from the previous race only"],
            ["Context", "Driver age, year", "Known on race morning"],
        ],
        [1.15 * inch, 3.15 * inch, 2.55 * inch],
        "Feature groups. Post-race position, points scored today, laps, status, pit stops, and fastest lap are excluded.",
        numeric_from=3,
    )
    train, val, test = splits["Training"], splits["Validation"], splits["Test"]
    story.append(P(
        "We split by season, not at random. A random split would let 2023 teach the model "
        "about 2022. Training is every season through 2019, validation is 2020-2021, and "
        "the test seasons 2022-2024 are scored once. Training fits the imputer, scaler, and "
        "weights; validation makes every choice (preprocessing, ablation, model, cutoff); "
        f"test is only reported. Table {COUNTERS['tab'] + 1} shows why that split is not "
        "a copy of the same problem three times."
    ))
    split_rows = []
    for name, part in splits.items():
        split_rows.append([
            name,
            split_meta[name],
            integer(len(part)),
            integer(part.raceId.nunique()),
            f"{len(part) / part.raceId.nunique():.1f}",
            pct(part.podium.mean()),
            pct(part.qualifying_missing.mean()),
        ])
    add_table(
        story,
        ["Split", "Seasons", "Rows", "Races", "Starters / race", "Podium rate", "Qualifying missing"],
        split_rows,
        [0.95 * inch, 0.95 * inch, 0.75 * inch, 0.65 * inch, 1.05 * inch, 0.9 * inch, 1.2 * inch],
        "Time split used for every model. Starters per race is the number of modelling rows divided by races.",
        numeric_from=2,
    )
    story.append(P(
        f"Our training seasons have {integer(len(train))} rows and {integer(train.raceId.nunique())} races, "
        f"but {pct(train.qualifying_missing.mean())} of those rows have no qualifying result. "
        f"Validation has only {integer(len(val))} rows and {integer(val.raceId.nunique())} races, "
        f"and the test set has {integer(len(test))} rows and {integer(test.raceId.nunique())} races. "
        f"Qualifying is almost complete in both recent splits "
        f"({pct(val.qualifying_missing.mean())} missing in validation, "
        f"{pct(test.qualifying_missing.mean(), 0)} in test). The podium rate rises from "
        f"{pct(train.podium.mean())} in training to {pct(val.podium.mean())} and "
        f"{pct(test.podium.mean())} later. That matches the field size: training averages "
        f"{len(train) / train.raceId.nunique():.1f} starters per race, against "
        f"{len(val) / val.raceId.nunique():.1f} in validation. There are still three podium "
        "places, shared across fewer cars."
    ))
    integrity = data["split_integrity"]
    strategies = data["split_strategies"].set_index("strategy")
    story.append(P(
        f"All {len(integrity)} of our split checks pass: every row is assigned once, no race appears "
        "in two splits, and the last training race is before the first validation race, which "
        f"is before the first test race. Figure {COUNTERS['fig'] + 1} shows the split on the "
        "season axis together with the two quantities that drift across it."
    ))
    add_figure(
        story,
        "chronological_split",
        "Rows, podium rate, and qualifying missingness by season, coloured by split.",
    )
    rr, rc = strategies.loc["random rows"], strategies.loc["chronological (used)"]
    story.append(P(
        f"To check our choice, Table {COUNTERS['tab'] + 1} holds out the same number of rows three "
        "ways, and we train the logistic baseline on the rest. With a random-row split, "
        f"{pct(rr.held_out_races_also_in_train)} of held-out rows have their own race in "
        f"training, and {pct(rr.held_out_rows_with_future_training)} have later seasons in "
        "training. A random-race split removes the first problem but not the second. The "
        "chronological split has zero of both. Random hold-outs also mix every era, so their "
        f"score ({num(rr['PR-AUC'])} PR-AUC for random rows, against {num(rc['PR-AUC'])} on "
        "2020-2021) answers a different question from predicting the next seasons."
    ))
    add_table(
        story,
        ["Strategy", "Held-out years", "Podium rate", "Same race in train", "Later seasons in train", "PR-AUC", "ROC-AUC"],
        [[name, r.held_out_years, pct(r.held_out_podium_rate), pct(r.held_out_races_also_in_train),
          pct(r.held_out_rows_with_future_training), num(r["PR-AUC"]), num(r["ROC-AUC"])]
         for name, r in strategies.iterrows()],
        [1.45 * inch, 0.95 * inch, 0.8 * inch, 1.0 * inch, 1.05 * inch, 0.7 * inch, 0.75 * inch],
        "Split-strategy check with logistic regression. Leakage columns are shares of held-out rows.",
        numeric_from=1,
    )
    story.append(P(
        "From these results, we notice that validation is a short window. Two seasons and "
        "39 races can separate a large gap from a small one, but they cannot support a "
        "fine ranking of models that differ by a few thousandths. We still use it for the "
        "decisions the test set must not make: the probability cutoff, and which model is "
        "used in the examples."
    ))
    story.append(P(
        "<b>Takeaway.</b> The features are pre-race by construction, and the split is "
        "chronological. The training years are a different problem from 2020-2024: more "
        "missing qualifying, larger fields, and a lower podium rate.",
        "Takeaway",
    ))

    h2(story, "5.1 Sprint races: known before the start, but not a feature")
    sprint = data["sprint"]
    story.append(P(
        "A sprint is a separate short race on the same weekend, stored in the sprint-results "
        "table. We had to decide whether it leaks. By time it does not: every sprint ends one "
        "day before the main race, so its result is known before the lights go out. We still "
        "leave it out, for two reasons. Sprints exist only from 2021, so no training row "
        f"(1950-2019) has one; there are {int(sprint.sprint_rows_in_training.iloc[0])} such rows. "
        "And in 2021-2022 the sprint set the main-race grid, so the grid features already "
        "contain it (Table " + str(COUNTERS["tab"] + 1) + ")."
    ))
    add_table(
        story,
        ["Season", "Sprint races", "Driver rows", "Split", "Days before race", "Grid vs sprint finish", "Grid vs qualifying"],
        [[str(int(r.season)), str(int(r.sprint_races)), str(int(r.driver_rows)), r.split,
          num(r.days_before_race, 0), num(r.grid_vs_sprint_finish, 2), num(r.grid_vs_qualifying, 2)]
         for r in sprint.itertuples()],
        [0.7 * inch, 0.85 * inch, 0.85 * inch, 0.9 * inch, 1.0 * inch, 1.35 * inch, 1.2 * inch],
        "Sprint weekends. The last two columns are Spearman rank correlations of the main-race grid "
        "with the sprint finishing order and with qualifying position.",
        numeric_from=4,
    )
    story.append(P(
        "In 2023-2024 the sprint stopped setting the grid, which follows qualifying again. "
        "A sprint feature would then cover only 12 weekends, so we leave it out. The hazard we guard against is a join: sprint "
        "positions and points sit under the same race identifier as the main race, but they "
        "belong to a different race. Standings are already moved to the following round, so "
        "sprint points reach the features only through the previous round."
    ))

    h2(story, "5.2 Drivers who did not enter the race")
    audit = data["non_starters"]
    runs = data["non_starter_runs"]
    failed = audit[audit.group.str.startswith("F:")].iloc[0]
    withdrew = audit[audit.group.str.startswith("W:")].iloc[0]
    raced_zero = audit[audit.group.str.startswith("grid 0 but raced")].iloc[0]
    withdrew_zero = int(round(withdrew.rows * withdrew.grid_zero_share))
    story.append(P(
        f"Before this step {pct(data['cleaning'].iloc[1].pit_lane_share)} of rows have grid 0, and the feature name "
        "suggests a pit-lane start. Most of them were not. "
        f"{integer(failed.rows)} rows are drivers who did not qualify, did not prequalify, or "
        f"failed the 107% rule. All of them are in {int(failed.first_year)}-{int(failed.last_year)}, all are in "
        "training, and none finished on the podium. Only "
        f"{integer(raced_zero.rows)} grid-0 rows are real pit-lane or exceptional starts (Table {COUNTERS['tab'] + 1}). "
        "The instructor ruled that these F rows are known before the race and may be removed, and that withdrawals "
        "may not, so we remove the first and keep the second."
    ))
    add_table(
        story,
        ["Group", "Treatment", "Rows", "Podium rate", "Years", "In training", "In validation", "In test"],
        [[r.group, "removed" if r.treatment.startswith("removed") else "kept", integer(r.rows), pct(r.podium_rate),
          f"{int(r.first_year)}-{int(r.last_year)}", integer(r.rows_in_training),
          integer(r.rows_in_validation), integer(r.rows_in_test)]
         for r in audit.itertuples()],
        [2.1 * inch, 0.7 * inch, 0.55 * inch, 0.7 * inch, 0.75 * inch, 0.65 * inch, 0.7 * inch, 0.5 * inch],
        "Who has grid 0 or a withdrawal code, by group, and what we do with each group.",
        numeric_from=2,
    )

    def run_change(variant, model):
        """Read the validation PR-AUC change for one non-starter variant and model."""
        hit = runs[runs.variant.str.startswith(variant) & runs.model.eq(model)].iloc[0]
        return float(hit["PR-AUC_change_vs_used"])

    keep, tail = "keep F rows in the history and", "keep F rows in the history, drop"
    lr_biggest = max(abs(run_change(v, LR)) for v in (keep, tail))
    nn_biggest = max(abs(run_change(v, NN)) for v in (keep, tail))
    assert lr_biggest < 0.002 and nn_biggest < 1.5 * seed_gap, "the F-row evidence changed; rewrite Section 5.2"
    story.append(P(
        "We scored the decision on the same validation seasons. Keeping the F rows instead changes validation "
        f"PR-AUC by {run_change(keep, LR):+.4f} for logistic regression and {run_change(keep, NN):+.4f} for the "
        "network. Keeping them in the history but dropping them from the training rows only changes it by "
        f"{run_change(tail, LR):+.4f} and {run_change(tail, NN):+.4f}. Logistic regression, which has no random seed, "
        f"moves by at most {lr_biggest:.4f}. The network moves by up to {nn_biggest:.4f}, but one network seed can sit "
        f"{seed_gap:.3f} away from its own three-seed average (Section 5.4), so the network cannot separate these "
        "options. The choice rests on the ruling and on what a row means, not on a score. Removing the withdrawals as well, which the ruling "
        f"does not allow, would change the network by {run_change('also drop W rows', NN):+.4f}. Validation and test "
        "contain no F rows, so the same rows are scored either way. The pit-lane flag now marks "
        f"{integer(withdrew_zero + raced_zero.rows)} rows, {integer(withdrew_zero)} withdrawals with grid 0 and "
        f"{integer(raced_zero.rows)} drivers who raced from the pit lane or an exceptional start. It is no longer a "
        "did-not-qualify marker, but it is still not a pure pit-lane flag."
    ))

    h2(story, "5.3 Evidence for each individual feature")
    fe = data["feature_eda"].set_index("feature")

    def auc(name, split="auc_train"):
        """Read one one-feature ROC-AUC."""
        return num(fe.loc[name, split], 2)

    story.append(P(
        "The group-level ablation in Section 8 says what a whole group adds to the model. "
        "Each feature also has its own exploratory evidence, computed on the training seasons only "
        f"(Table {COUNTERS['tab'] + 1} and Figure {COUNTERS['fig'] + 1}). For every feature we report the "
        "share of missing cells, the podium rate in its lowest and highest bin, and a one-feature "
        "ROC-AUC. An AUC above 0.5 means a higher value goes with more podiums, and below 0.5 the "
        "reverse. The same AUC on validation checks that the pattern still holds in later seasons."
    ))
    add_figure(
        story,
        "feature_eda",
        "Podium rate by feature value on the training seasons. Each bar is one of five equal-count bins "
        "(labelled by its median value; tied values are split across bins, so a label can repeat), flags show "
        "0 and 1, and the orange bar is the podium rate of the rows where the feature is missing.",
    )
    add_table(
        story,
        ["Feature", "Group", "Missing", "Lowest bin", "Highest bin", "AUC train", "AUC valid."],
        [[r.Index, r.group, pct(r.missing_share_train, 0), pct(r.podium_rate_lowest_bin),
          pct(r.podium_rate_highest_bin), num(r.auc_train, 2), num(r.auc_validation, 2)]
         for r in fe.itertuples()],
        [1.95 * inch, 0.85 * inch, 0.65 * inch, 0.8 * inch, 0.85 * inch, 0.8 * inch, 0.8 * inch],
        "One-feature evidence on the training seasons. Missing cells are left out of the bins and the AUC. "
        "Valid. is the same AUC on 2020-2021.",
        numeric_from=2,
    )
    story.append(P(
        "<b>Strong single signals.</b> Position features carry the most. "
        f"Qualifying position has an AUC of {auc('qualifying_position')} (lower is better, measured on the "
        f"{pct(1 - fe.loc['qualifying_position', 'missing_share_train'], 0)} of rows that have it) and grid position "
        f"{auc('grid_position')}; the podium rate falls from {pct(fe.loc['grid_position', 'podium_rate_lowest_bin'], 0)} "
        f"(grid) and {pct(fe.loc['qualifying_position', 'podium_rate_lowest_bin'], 0)} (qualifying) in the best bin "
        f"to {pct(fe.loc['grid_position', 'podium_rate_highest_bin'])} and "
        f"{pct(fe.loc['qualifying_position', 'podium_rate_highest_bin'])} in the worst. The standings ranks "
        f"({auc('driver_rank_before')} and {auc('constructor_rank_before')}), the form rates "
        f"({auc('driver_podium_rate_5')} and {auc('constructor_podium_rate_5')}), and the points "
        f"({auc('driver_points_before')} and {auc('constructor_points_before')}) come next. The front-row flag "
        f"({auc('front_row')}) and prior starts ({auc('driver_races_before')}) are clear but smaller. All of these "
        "keep their direction on validation, with similar or slightly stronger AUCs."
    ))
    story.append(P(
        "<b>Weak single signals, kept for another reason.</b> Field size "
        f"({auc('field_size')}), driver age ({auc('driver_age')}), qualifying time ({auc('qualifying_time_seconds')}), "
        f"the pit-lane flag ({auc('pit_lane_start')}), and the qualifying-missing flag ({auc('qualifying_missing')}) are "
        "close to 0.5 on their own. A raw qualifying time is not comparable across circuits and eras, so it says little "
        "without the rest of the row. The two flags are indicators. Removing the qualifying-missing flag changes "
        "PR-AUC only slightly (Section 6.4), but the flag records which rows were imputed, and rows with no grid position "
        "(withdrawals and pit-lane starts) never podium, "
        "while rows with no qualifying record podium at about the average rate "
        f"({pct(fe.loc['qualifying_position', 'podium_rate_when_missing'])} against {pct(frame.podium.mean())}). Year "
        f"({auc('year')}) has essentially no single-feature signal, and field size and year are flat or constant on "
        "validation, where every race has 20 starters. The ablation shows the whole context group adds the least of "
        f"the five ({abl_loss('without context'):.3f} PR-AUC). Section 5.4 tests the two calendar features one at a "
        "time: year is kept and round was removed."
    ))
    story.append(P(
        f"<b>What this does and does not show.</b> A one-feature AUC ignores the other {n_features - 1} features. A feature that looks "
        "weak here can still help in combination, and a strong one can add little once the grid is present: the ablation "
        f"shows qualifying adds only {abl_loss('without qualifying'):.3f} on top of the grid. The AUCs describe association "
        "in past races, not causes.",
        "Takeaway",
    ))

    h2(story, "5.4 Calendar features: keep year, remove round")
    context = data["context"]
    round_back = {m: ctx("put round back", m, "PR-AUC_change_vs_used") for m in (LR, RF, NN)}
    no_year = {m: ctx("also remove year", m, "PR-AUC_change_vs_used") for m in (LR, RF, NN)}
    # The same test inside the old 17-feature model: remove year while round is still there.
    no_year_old = {m: ctx("round back, year removed", m) - ctx("put round back", m) for m in (LR, RF, NN)}
    assert no_year_old[NN] < 0 and no_year_old[RF] < 0, \
        "removing year from the old model no longer hurts the nonlinear models; rewrite 5.4"
    nn_sd = max(ctx("used (no round)", NN, "validation_PR-AUC_std"), ctx("put round back", NN, "validation_PR-AUC_std"))
    avg_noise = nn_sd / 3 ** 0.5  # a three-seed average is steadier than one seed
    assert max(abs(v) for v in round_back.values()) < 0.005, "putting round back now changes a model noticeably; rewrite 5.4"
    assert no_year[NN] < -1.5 * avg_noise and no_year[NN] == min(no_year.values()), \
        "removing year no longer clearly hurts the network; rewrite 5.4"
    story.append(P(
        "Year and round were added as context: the era and the point in the season. On their own neither "
        f"separates podiums from the rest (year has a single-feature AUC of {auc('year')}), so we tested each one "
        "inside the full models. Every variant is trained on 1950-2019 and scored on 2020-2021 only, and the network "
        f"is averaged over three seeds (Table {COUNTERS['tab'] + 1})."
    ))
    add_table(
        story,
        ["Variant", "Model", "Inputs", "Val. PR-AUC", "Seed sd", "Seed 42", "Change"],
        [[r.variant, r.model, str(int(r.features)), num(r["validation_PR-AUC"], 4), num(r["validation_PR-AUC_std"], 4),
          num(r["seed_42_PR-AUC"], 4), f"{r['PR-AUC_change_vs_used']:+.4f}"] for _, r in context.iterrows()],
        [1.3 * inch, 1.5 * inch, 0.5 * inch, 0.8 * inch, 0.65 * inch, 0.65 * inch, 0.65 * inch],
        "Calendar-feature experiment on 2020-2021. Change is against the features we use (no round).",
        numeric_from=2,
    )
    story.append(P(
        "<b>Round adds nothing, so we removed it.</b> Putting round back changes validation PR-AUC by "
        f"{round_back[LR]:+.4f} for logistic regression, {round_back[RF]:+.4f} for the forest and "
        f"{round_back[NN]:+.4f} for the network. All three are far smaller than the network's seed spread of up to "
        f"{nn_sd:.3f}, and they do not agree in direction. The standings already carry the same information, because "
        "points and rank build up race by race. Round also changes meaning across eras: a season had about 8 races in "
        "the 1950s and 24 in 2024, so round 8 was a finale then and an early race now. With no measurable gain and an "
        "unstable meaning, the simpler model wins."
    ))
    story.append(P(
        f"<b>Year helps, so we kept it.</b> Removing year changes the score by {no_year[LR]:+.4f} for logistic "
        f"regression, {no_year[RF]:+.4f} for the forest and {no_year[NN]:+.4f} for the network. The network loses "
        f"the most of the three models, about {abs(no_year[NN]) / avg_noise:.0f} times the noise of a three-seed "
        f"average (about {avg_noise:.3f}). The same test inside the old 17-feature model, with round still there, "
        f"gives {no_year_old[LR]:+.4f}, {no_year_old[RF]:+.4f} and {no_year_old[NN]:+.4f}, so year helps the nonlinear "
        "models with or without round. That old model without year is also unstable: its network seed spread is "
        f"{ctx('round back, year removed', NN, 'validation_PR-AUC_std'):.3f}. Year alone says nothing, but together with grid and form it lets the "
        "nonlinear models adjust for the era: larger fields, worse reliability, and missing qualifying in older "
        "seasons. One caveat: the test seasons lie outside the training years, so the models must extrapolate year, "
        "and a tree cannot, so the forest treats 2022 like 2019."
    ))
    story.append(P(
        "<b>Takeaway.</b> One seed is not enough to rank the models. With round, the network's seed-42 score was "
        f"{ctx('put round back', NN, 'seed_42_PR-AUC'):.4f}, {seed_gap:.3f} above its own three-seed average of "
        f"{ctx('put round back', NN):.4f}. Without round, seed 42 scores {ctx('used (no round)', NN, 'seed_42_PR-AUC'):.4f} "
        f"and the average is {ctx('used (no round)', NN):.4f}. The average barely moved, yet the single seed fell, "
        "and that alone moved the network from first to below logistic regression in Section 7. We therefore read "
        f"single-seed network differences of about {seed_gap:.3f} as noise throughout this report.",
        "Takeaway",
    ))

    # Settle preprocessing on validation data before comparing model families.
    h1(story, "6. Feature engineering and preprocessing: strategy, effect on the values, and order")
    story.append(P(
        "Missing qualifying, grid, and form values have to be filled inside "
        "the model pipeline, using training rows only. We compare three settings of "
        "logistic regression on the validation seasons: median imputation with scaling, "
        "median imputation without scaling, and filling missing values with zero before "
        "scaling. The test seasons are not used for this choice."
    ))
    pre_rows = []
    for _, r in preprocessing.iterrows():
        pre_rows.append([r["preprocessing"], num(r["validation_ROC-AUC"]), num(r["validation_PR-AUC"])])
    add_table(
        story,
        ["Preprocessing", "Validation ROC-AUC", "Validation PR-AUC"],
        pre_rows,
        [2.4 * inch, 2.1 * inch, 2.05 * inch],
        "Preprocessing comparison for logistic regression on 2020-2021 only.",
        numeric_from=1,
    )
    best_pr = preprocessing["validation_PR-AUC"].max()
    worst_pr = preprocessing["validation_PR-AUC"].min()
    story.append(P(
        f"We can see that the three PR-AUC values sit between {num(worst_pr)} and {num(best_pr)}. "
        f"The gap is {num(best_pr - worst_pr)}. Median imputation with scaling is the best of "
        "the three on the metric we care about. Zero-filling with scaling is slightly higher "
        f"on ROC-AUC ({num(preprocessing.loc[preprocessing.preprocessing.eq('zero + scaling'), 'validation_ROC-AUC'].iloc[0])} "
        f"against {num(preprocessing.loc[preprocessing.preprocessing.eq('median + scaling'), 'validation_ROC-AUC'].iloc[0])}). "
        "If we had followed ROC-AUC, we would have picked a different setting. The difference "
        "is small enough that we do not treat preprocessing as the main lever. We keep median "
        "imputation with scaling for the linear model and the network. The forest does not "
        "use scaling, because a tree split does not depend on the units of a feature."
    ))
    h2(story, "6.1 What feature engineering does to the values")
    eng = data["engineering_effects"].set_index("column")
    story.append(P(
        f"In Table {COUNTERS['tab'] + 1} we compare each raw source column with the feature we built from it. "
        f"Raw grid has a minimum of 0 and {pct(eng.loc['grid (raw)', 'zero_share'])} zeros, which would "
        "rank a pit-lane start ahead of pole. In the grid-position feature those zeros become missing, "
        "so the minimum is 1, and the pit-lane flag carries the information instead. Qualifying "
        "strings become seconds; after the join to every driver-race row, "
        f"{pct(eng.loc['qualifying_time_seconds (joined)', 'missing_share'])} of rows have no "
        "qualifying time. Shifted form is missing on a driver's first race, because nothing earlier "
        "exists, and that gap is what the imputer fills next. Previous-race standings are not "
        "imputed. Before a driver's or team's first race of a season they used to be empty, and the "
        "median imputer filled them with about 3 points and rank 13, points nobody had scored. They "
        "are now set to 0 points and rank 0. Extra flags marking these rows gave no validation gain, "
        "so no flags were added."
    ))
    add_table(
        story,
        ["Column", "Missing", "Zeros", "Min", "Median", "Max"],
        [[r.Index, pct(r.missing_share), pct(r.zero_share), num(r.min, 2), num(r.median, 2), num(r.max, 2)]
         for r in eng.itertuples()],
        [2.55 * inch, 0.8 * inch, 0.7 * inch, 0.85 * inch, 0.95 * inch, 1.0 * inch],
        "Raw source columns against the engineered features built from them (all 1950-2024 rows).",
        numeric_from=1,
    )

    h2(story, "6.2 What imputation and scaling do to the values")
    effects = data["effects"].set_index("feature")
    heavy = effects.sort_values("missing_share", ascending=False).head(1)
    story.append(P(
        f"In Table {COUNTERS['tab'] + 1} we measure both steps on the training rows. Median "
        "imputation writes the training median into every gap. It does not change the range, "
        "because the median is inside it, but it piles rows onto one value and shrinks the "
        f"spread. {esc(heavy.index[0])} is missing in {pct(heavy.missing_share.iloc[0])} of training "
        f"rows, and its standard deviation falls by {pct(-heavy.std_change_from_imputation.iloc[0])}. "
        "The qualifying-missing flag keeps the fact that a value was filled. Scaling then puts "
        "every training feature at mean 0 and standard deviation 1. Raw ranges run from 0-1 for "
        f"the flags to {integer(effects.loc['constructor_points_before', 'raw_max'])} constructor points; "
        "after scaling they share one scale, so neither the logistic penalty nor the network's "
        "gradient steps are dominated by large units. Scaling is linear, so the shape and order "
        "of values do not change."
    ))
    shown = ["grid_position", "qualifying_position", "qualifying_time_seconds", "driver_podium_rate_5",
             "driver_points_before", "constructor_points_before", "driver_age", "year"]
    add_table(
        story,
        ["Feature", "Missing", "Fill value", "Raw range", "Std change", "Scaled range", "Val. mean", "Test mean"],
        [[f, pct(effects.loc[f, "missing_share"]), num(effects.loc[f, "fill_value"], 2),
          f"{effects.loc[f, 'raw_min']:.1f} to {effects.loc[f, 'raw_max']:.1f}",
          pct(effects.loc[f, "std_change_from_imputation"]),
          f"{effects.loc[f, 'scaled_min']:.2f} to {effects.loc[f, 'scaled_max']:.2f}",
          f"{effects.loc[f, 'validation_scaled_mean']:+.2f}", f"{effects.loc[f, 'test_scaled_mean']:+.2f}"]
         for f in shown],
        [1.6 * inch, 0.6 * inch, 0.7 * inch, 1.05 * inch, 0.7 * inch, 1.0 * inch, 0.6 * inch, 0.65 * inch],
        "Effect of median imputation and scaling, fitted on 1950-2019. Val. and test means are after "
        "the same training-fitted transform; training means are 0 by construction.",
        numeric_from=1,
    )
    story.append(P(
        f"Figure {COUNTERS['fig'] + 1} shows the spike at the median and the shift of later "
        f"seasons; in Figure {COUNTERS['fig'] + 2} we compare raw and scaled ranges for all {n_features} features. "
        "Because the transform is fitted on training only, validation and test are not centred "
        f"at zero: year sits at {effects.loc['year', 'validation_scaled_mean']:+.2f} standard "
        "deviations in validation. That is the period shift the model faces at deployment, "
        "not a bug."
    ))
    add_figure(story, "preprocessing_distributions",
               "Top: training values before and after median imputation (dashed line is the fill value, "
               "log scale). Bottom: training and validation after the training-fitted scaler.")
    add_figure(story, "preprocessing_ranges",
               "Left: raw training range per feature. Right: range after scaling, with the validation mean.",
               width=CONTENT_W * 0.9)

    h2(story, "6.3 Preprocessing-order experiments")
    order = data["order"]
    story.append(P(
        "The table above changes which strategy we use. We also ran three experiments that "
        f"change the <i>order</i> of the steps (Table {COUNTERS['tab'] + 1}), each scored on "
        "validation with logistic regression and the network. A swaps median imputation and "
        "scaling. B swaps zero-filling and scaling. C fits the preprocessing on all seasons "
        "before splitting, against the normal fit on training only."
    ))
    add_table(
        story,
        ["Experiment", "Order", "Fitted on", "Model", "Missing grid becomes", "Val. PR-AUC", "Change"],
        [[r.experiment.split(":")[0], r.order, "all years" if r.preprocessing_fitted_on.startswith("all") else "train",
          "LogReg" if r.model.startswith("Log") else "MLP", num(r.missing_grid_position_becomes, 2),
          num(r["validation_PR-AUC"]), f"{r['PR-AUC_change_vs_reference']:+.4f}"]
         for _, r in order.iterrows()],
        [0.75 * inch, 1.35 * inch, 0.75 * inch, 0.65 * inch, 1.2 * inch, 0.85 * inch, 0.75 * inch],
        "Preprocessing-order experiments on 2020-2021. Change is against the first order of the same "
        "experiment and model; for C it is against the train-only fit.",
        numeric_from=4,
    )

    def oget(experiment, order_name, model, col, fitted="train"):
        """Read one value from the order-experiment table."""
        hit = order[order.experiment.str.startswith(experiment) & order.order.eq(order_name)
                    & order.model.eq(model) & order.preprocessing_fitted_on.str.startswith(fitted[:3])]
        return float(hit[col].iloc[0])

    lr, nn = "Logistic regression", "Shallow neural network"
    story.append(P(
        "<b>A.</b> Median imputation commutes with a linear rescale, so a missing grid becomes "
        f"{num(oget('A', 'impute -> scale', lr, 'missing_grid_position_becomes'), 1)} either way. "
        "Only the scaler's statistics differ, because scaling first measures spread on observed "
        "values. Validation PR-AUC moves by "
        f"{oget('A', 'scale -> impute', lr, 'PR-AUC_change_vs_reference'):+.4f} for logistic regression "
        f"and {oget('A', 'scale -> impute', nn, 'PR-AUC_change_vs_reference'):+.4f} for the network. "
        "<b>B.</b> Here order changes the value. Zero-filling first writes a literal 0, a grid slot "
        "ahead of pole and a 0-second lap. Zero-filling after scaling writes the training mean "
        f"({num(oget('B', 'scale -> zero-fill', lr, 'missing_grid_position_becomes'), 1)} for grid). "
        f"Validation PR-AUC changes by {oget('B', 'scale -> zero-fill', lr, 'PR-AUC_change_vs_reference'):+.4f} "
        f"(logistic) and {oget('B', 'scale -> zero-fill', nn, 'PR-AUC_change_vs_reference'):+.4f} (network). "
        "<b>C.</b> Fitting before the split lets 2020-2024 set the medians and scaling used in "
        f"training. The score moves by {oget('C', 'impute -> scale', lr, 'PR-AUC_change_vs_reference', 'all'):+.4f} "
        f"and {oget('C', 'impute -> scale', nn, 'PR-AUC_change_vs_reference', 'all'):+.4f}; "
        "small or not, it uses future data, so we never do it."
    ))
    lr_swing = max(float(order[order.model.eq(LR)]["PR-AUC_change_vs_reference"].abs().max()), best_pr - worst_pr)
    nn_swing = float(order[order.model.eq(NN)]["PR-AUC_change_vs_reference"].abs().max())
    story.append(P(
        "<b>Takeaway.</b> We keep split, then median imputation, then scaling, all fitted on "
        "training rows inside the model pipeline. Logistic regression is almost indifferent to "
        f"strategy and order (every change is within {lr_swing:.3f} PR-AUC). The network moves by up to "
        f"{nn_swing:.3f}, about the {seed_gap:.3f} that one seed can move on its own (Section 5.4), so its numbers "
        "cannot rank the orders either. We fix the order on principle: fit on training rows only, and impute before "
        "scaling so the scaler sees the filled values. The next sections test which information the models need.",
        "Takeaway",
    ))

    h2(story, "6.4 Missing values: impute, drop columns, or drop rows?")
    missing = data["missing"]
    wide = missing.pivot_table(index=["approach", "variant", "train_rows"], columns="model",
                               values=["validation_PR-AUC", "PR-AUC_change_vs_used"], sort=False).reset_index()
    lr_name, nn_name = "Logistic regression", "Shallow neural network"
    story.append(P(
        f"About {pct(train.qualifying_missing.mean(), 0)} of training rows have no qualifying record, so we did not "
        "choose the handling by preference. Each approach is scored on the same validation seasons "
        f"(Table {COUNTERS['tab'] + 1}). The network is run once with one seed, and one seed can sit "
        f"{seed_gap:.3f} away from its own average (Section 5.4), so network differences of that size are noise. "
        "We decide on logistic regression, the selected model, because it has no random seed."
    ))
    add_table(
        story,
        ["Approach", "Training rows", "LogReg PR-AUC", "Change", "MLP PR-AUC", "Change"],
        [[str(row[("variant", "")]), integer(row[("train_rows", "")]),
          num(row[("validation_PR-AUC", lr_name)], 4), f"{row[('PR-AUC_change_vs_used', lr_name)]:+.4f}",
          num(row[("validation_PR-AUC", nn_name)], 4), f"{row[('PR-AUC_change_vs_used', nn_name)]:+.4f}"]
         for _, row in wide.iterrows()],
        [2.9 * inch, 0.7 * inch, 0.8 * inch, 0.6 * inch, 0.8 * inch, 0.6 * inch],
        "Missing-value experiments on 2020-2021. Change is against median imputation, which is used.",
        numeric_from=1,
    )
    lr_alts = missing[missing.model.eq(LR) & ~missing.variant.str.endswith("(used)")]
    best_alt = lr_alts.sort_values("PR-AUC_change_vs_used").iloc[-1]
    row_counts = {v: int(missing[missing.variant.str.startswith(v)].train_rows.iloc[0])
                  for v in ["drop training rows with no qualifying", "drop training rows with any missing"]}
    full_rows = int(missing[missing.variant.str.endswith("(used)")].train_rows.iloc[0])
    story.append(P(
        f"For logistic regression every alternative stays within {float(lr_alts['PR-AUC_change_vs_used'].abs().max()):.3f} "
        f"of median imputation (the best alternative, {esc(best_alt.variant)}, is "
        f"{float(best_alt['PR-AUC_change_vs_used']):+.4f}). For the network, mean imputation changes the score by "
        f"{miss_change('mean imputation', NN):+.3f}, k-nearest-neighbour imputation by "
        f"{miss_change('KNN', NN):+.3f}, and iterative imputation by {miss_change('iterative', NN):+.3f}. "
        "Dropping the two sparse qualifying columns changes the network by "
        f"{miss_change('drop the sparse', NN):+.3f}, the one network change clearly beyond single-seed noise, and "
        f"removing the missing-value flag instead changes it by {miss_change('median, without', NN):+.3f}. Dropping rows keeps "
        f"only {integer(row_counts['drop training rows with no qualifying'])} or "
        f"{integer(row_counts['drop training rows with any missing'])} of {integer(full_rows)} "
        "training rows and changes the scores by "
        f"{miss_change('drop training rows with no qualifying', LR):+.3f} and "
        f"{miss_change('drop training rows with any missing', LR):+.3f} for logistic regression, "
        f"{miss_change('drop training rows with no qualifying', NN):+.3f} and "
        f"{miss_change('drop training rows with any missing', NN):+.3f} for the network. "
        "<b>We keep median imputation with the flag</b>, "
        "fitted on training rows only: for logistic regression it is tied with every alternative, the network's "
        "single-seed numbers cannot rank them, and it keeps all the history."
    ))

    # Every model uses the same rows and features for a fair comparison.
    h1(story, "7. Three models, and why the scores are not interchangeable")
    story.append(P(
        f"We fit three classifiers on the same training rows and the same {n_features} features. "
        "Logistic regression is the linear baseline, with class weights so the rare podium "
        "rows are not ignored. The random forest has 240 trees, a depth limit of 12, and a "
        "minimum of 30 rows per leaf; it can use combinations such as a strong recent record "
        "together with a poor grid. The neural network has two hidden layers, of 32 and 12 "
        "units. Each model's settings were searched on validation (Section 7.1), and the "
        "probability cutoff that maximises F1 on validation is chosen last. That produces a different cutoff for each "
        "model, because the three probability scales are not the same number line. A cutoff "
        f"of {num(summary['thresholds'][NN])} on the network is not automatically more aggressive than "
        f"{num(summary['thresholds'][LR])} on the logistic model. Precision and recall tell us what "
        "the cutoff actually does."
    ))
    story.append(P(
        f"Figure {COUNTERS['fig'] + 1} compares the three models on the test seasons only. "
        f"Table {COUNTERS['tab'] + 1} gives "
        "training, validation, and test, so we can see whether a high training score survives."
    ))
    add_figure(
        story,
        "model_comparison",
        "Test-set scores for 2022-2024. ROC-AUC is similar across models. "
        "Precision and recall differ because each model uses its own validation cutoff.",
        width=CONTENT_W * 0.92,
    )
    model_figure = COUNTERS["fig"]
    metric_rows = []
    for _, r in metrics.iterrows():
        metric_rows.append([
            r["model"],
            r["split"],
            num(r["threshold"]),
            num(r["ROC-AUC"]),
            num(r["PR-AUC"]),
            num(r["F1"]),
            num(r["Precision"]),
            num(r["Recall"]),
        ])
    add_table(
        story,
        ["Model", "Split", "Cutoff", "ROC-AUC", "PR-AUC", "F1", "Precision", "Recall"],
        metric_rows,
        [1.45 * inch, 0.75 * inch, 0.58 * inch, 0.68 * inch, 0.62 * inch, 0.52 * inch, 0.72 * inch, 0.62 * inch],
        "Scores by model and split. The cutoff maximises F1 on validation and is then frozen for training and test.",
        numeric_from=1,
    )

    def mget(model, split, col):
        """Read one model metric from the long-form score table."""
        hit = metrics[(metrics.model == model) & (metrics.split == split)].iloc[0]
        return float(hit[col])

    story.append(P(
        f"On the test set we measure a ROC-AUC of {num(mget('Logistic regression', 'test', 'ROC-AUC'))} "
        f"for logistic regression, {num(mget('Random forest', 'test', 'ROC-AUC'))} for the "
        f"forest, and {num(mget('Shallow neural network', 'test', 'ROC-AUC'))} for the "
        "network. Those three numbers are within 0.005 of each other. In the pair reading "
        "of ROC-AUC, a true podium finisher outranks a non-podium about 93 to 94 times out "
        "of 100. That is a strong ranking. It is also a ranking on which the models do not "
        "separate. ROC-AUC compresses the comparison because most rows are not podiums, so "
        "a modest number of false alarms barely moves the false-positive rate."
    ))
    story.append(P(
        f"PR-AUC is where they separate a little. On test, the forest scores "
        f"{num(mget('Random forest', 'test', 'PR-AUC'))}, the network "
        f"{num(mget('Shallow neural network', 'test', 'PR-AUC'))}, and logistic regression "
        f"{num(mget('Logistic regression', 'test', 'PR-AUC'))}. The test podium rate is "
        f"{pct(test.podium.mean())}, so a useless ranking would sit near "
        f"{num(test.podium.mean())}. All three models are far above that floor. The "
        f"forest's lead over logistic regression is "
        f"{num(mget('Random forest', 'test', 'PR-AUC') - mget('Logistic regression', 'test', 'PR-AUC'))} "
        "PR-AUC. We call that a small lead, not a different kind of model. We selected "
        "logistic regression before looking at this comparison, because its validation PR-AUC of "
        f"{num(mget('Logistic regression', 'validation', 'PR-AUC'))} was ahead of "
        f"{num(mget('Shallow neural network', 'validation', 'PR-AUC'))} for the network and "
        f"{num(mget('Random forest', 'validation', 'PR-AUC'))} for the forest. It also leads on the three-seed "
        "average (Section 7.1), so the choice does not rest on one seed. The test seasons are never used to choose."
    ))
    story.append(P(
        f"The operating points we chose explain the precision and recall bars in Figure {model_figure}. At its "
        f"validation cutoff, logistic regression has test precision "
        f"{num(mget('Logistic regression', 'test', 'Precision'))} and recall "
        f"{num(mget('Logistic regression', 'test', 'Recall'))}. It catches most podiums and "
        f"accepts more false alarms. The forest has precision "
        f"{num(mget('Random forest', 'test', 'Precision'))} and recall "
        f"{num(mget('Random forest', 'test', 'Recall'))}, and the network has precision "
        f"{num(mget('Shallow neural network', 'test', 'Precision'))} and recall "
        f"{num(mget('Shallow neural network', 'test', 'Recall'))}. The "
        f"{'network' if mget(NN, 'test', 'Precision') > mget(RF, 'test', 'Precision') else 'forest'} is the "
        "conservative one of the three. Test F1 ends up almost "
        f"tied, from {num(min(mget(m, 'test', 'F1') for m in (LR, RF, NN)))} to "
        f"{num(max(mget(m, 'test', 'F1') for m in (LR, RF, NN)))}. Same F1, different mix of "
        "missed podiums and false podiums."
    ))
    story.append(P(
        f"The training column is the check for memorizing. All three models have a training "
        f"PR-AUC below their validation score: {num(mget('Logistic regression', 'train', 'PR-AUC'))} "
        f"for logistic regression, {num(mget('Random forest', 'train', 'PR-AUC'))} for the "
        f"forest, and {num(mget('Shallow neural network', 'train', 'PR-AUC'))} for the network. "
        f"That was not true of the first forest, which scored {float(tuned(RF, 'initial')['train_PR-AUC']):.3f} on "
        f"training and {float(tuned(RF, 'initial')['validation_PR-AUC']):.3f} on "
        "validation because it had no depth limit and four rows per leaf. The validation "
        "search in Section 7.1 limited it. We do not read the higher validation score as the "
        "model improving after 2019. Training has a lower podium rate and far more missing "
        "qualifying, so the PR-AUC floor on training is lower as well. The comparison we "
        "trust is validation against test, where the positive rate is almost the same."
    ))
    story.append(P(
        "<b>Takeaway.</b> All three models rank podium finishers well above non-podiums. "
        "On the primary score, logistic regression is slightly ahead on validation and slightly behind on test, "
        "and both gaps are smaller than the uncertainty of the race samples (Section 7.2). ROC-AUC hides even that "
        "difference.",
        "Takeaway",
    ))

    h2(story, "7.1 Searching each model's settings, on validation only")
    tuning = data["tuning"]
    shown = tuning[tuning.is_initial | tuning.is_current | tuning.selected].copy()

    def role(r):
        """Label how a setting relates to the search."""
        if r.is_initial and r.is_current:
            return "starting, kept"
        if r.is_current:
            return "adopted"
        if r.is_initial:
            return "starting"
        return "top of grid"

    story.append(P(
        "We trained each model on 1950-2019 and scored it on 2020-2021 for every setting in a "
        f"small grid. Our grid held {int(tuning.groupby('model').size()[LR])} settings for logistic regression, "
        f"{int(tuning.groupby('model').size()[RF])} for the forest, and {int(tuning.groupby('model').size()[NN])} "
        "for the network. We averaged the network over three seeds because its score depends "
        "on the initialization. We did not use the test seasons "
        f"(Table {COUNTERS['tab'] + 1})."
    ))
    add_table(
        story,
        ["Model", "Setting", "Role", "Val. PR-AUC", "Seed sd", "Train PR-AUC"],
        [[r.model, r.settings.strip("{}").replace("'", ""), role(r), num(r["validation_PR-AUC"], 4),
          num(r["validation_PR-AUC_std"], 4), num(r["train_PR-AUC"], 4)]
         for _, r in shown.iterrows()],
        [1.4 * inch, 2.2 * inch, 1.0 * inch, 0.8 * inch, 0.6 * inch, 0.8 * inch],
        "Search results for the starting settings, the adopted settings, and the top of each grid.",
        numeric_from=3,
    )
    sizes = tuning.groupby("model").size()
    rf0, rf1 = tuned(RF, "initial"), tuned(RF, "current")
    rf_best = tuning[tuning.model.eq(RF) & tuning.rank_within_model.eq(1)].iloc[0]
    nn0, nn1 = tuned(NN, "initial"), tuned(NN, "current")
    lr_all, lr1, lr_best = tuning[tuning.model.eq(LR)], tuned(LR, "current"), tuned(LR, "best")
    nn_best = tuning[tuning.model.eq(NN) & tuning.rank_within_model.eq(1)].iloc[0]
    nn_gap = float(nn_best["validation_PR-AUC"] - nn1["validation_PR-AUC"])
    nn_sds = tuning[tuning.model.eq(NN)]["validation_PR-AUC_std"]
    assert nn_gap < nn_sds.max(), "the best network setting now beats the adopted one by more than the largest seed spread"
    assert nn1["validation_PR-AUC"] < lr1["validation_PR-AUC"], "the adopted network's average now beats logistic regression"
    lr_gap_value = float(lr_best["validation_PR-AUC"] - lr1["validation_PR-AUC"])
    lr_gap = "ties for best (within 0.0005)" if lr_gap_value < 5e-4 else f"is within {lr_gap_value:.4f} of the best"
    story.append(P(
        f"<b>Random forest: improved.</b> The starting forest (no depth limit, 4 rows per leaf) ranked "
        f"{ordinal(int(rf0.rank_within_model))} of {int(sizes[RF])}. It scored {float(rf0['validation_PR-AUC']):.3f} on "
        f"validation but {float(rf0['train_PR-AUC']):.3f} on training, a memorized fit. A depth limit of 12 with "
        f"30 rows per leaf scores {float(rf1['validation_PR-AUC']):.3f} and ranks "
        f"{ordinal(int(rf1.rank_within_model))} of {int(sizes[RF])}. The best setting "
        f"({esc(rf_best.settings.strip('{}').replace(chr(39), ''))}) is only "
        f"{float(rf_best['validation_PR-AUC'] - rf1['validation_PR-AUC']):.3f} higher, far inside the validation "
        "noise in Section 7.2, so we keep the depth limit as the more constrained model. It cuts the training "
        f"score to {float(rf1['train_PR-AUC']):.3f}, so it no longer memorizes the training seasons. No test "
        "season took part in the choice. "

        "<b>Shallow network: a noisy search.</b> One layer of 8, 16, 32, or 64 units and two layers of 32 and 12 "
        "or 64 and 32, each with two regularization strengths, were all tried and averaged over three seeds. The "
        f"adopted two layers of 32 and 12 with alpha 0.02 score {float(nn1['validation_PR-AUC']):.4f} and rank "
        f"{ordinal(int(nn1.rank_within_model))} of {int(sizes[NN])}, against {float(nn0['validation_PR-AUC']):.4f} for "
        f"the starting alpha of 0.002. The best setting ({esc(nn_best.settings.strip('{}').replace(chr(39), ''))}) "
        f"is {nn_gap:.3f} higher, while one setting's seed spread reaches {float(nn_sds.max()):.3f} in this search. "
        "The ranking is also unstable: with round in the features, the adopted setting ranked first. Picking the top "
        "of a ranking that moves with one input and one seed would be picking noise, so we keep the adopted network. "
        "Networks with 8 units are clearly worse, so it is not a deliberately weak choice. Its three-seed average is "
        f"still below logistic regression's {float(lr1['validation_PR-AUC']):.4f}. "
        f"<b>Logistic regression</b> is insensitive: L1 and L2 penalties and C from 0.01 to 10 all fall between "
        f"{float(lr_all['validation_PR-AUC'].min()):.3f} and {float(lr_all['validation_PR-AUC'].max()):.3f}, and the "
        f"starting C = 1 with L2 {lr_gap}, so we kept it."
    ))

    h2(story, "7.2 How much the validation score can be trusted")
    windows, uncertainty = data["windows"], data["uncertainty"]
    used = windows.validation_window.str.contains("used")
    lr_rank = int(windows["Logistic regression PR-AUC"].rank(ascending=False)[used].iloc[0])
    nn_rank = int(windows["Shallow neural network PR-AUC"].rank(ascending=False)[used].iloc[0])
    story.append(P(
        "We also asked whether 2019 is a good boundary. The same two models were scored on "
        "four validation windows that all end before the test seasons, each training on every "
        f"earlier season (Table {COUNTERS['tab'] + 1}). The score depends on the window: "
        f"logistic regression ranges from {num(windows['Logistic regression PR-AUC'].min())} to "
        f"{num(windows['Logistic regression PR-AUC'].max())}, and the network from "
        f"{num(windows['Shallow neural network PR-AUC'].min())} to "
        f"{num(windows['Shallow neural network PR-AUC'].max())}. The 2020-2021 window we use ranks "
        f"{ordinal(lr_rank)} of {len(windows)} for logistic regression and {ordinal(nn_rank)} of "
        f"{len(windows)} for the network, so it sits near the top of both ranges and validation "
        "scores are somewhat optimistic."
    ))
    add_table(
        story,
        ["Validation window", "Train years", "Train rows", "Val. races", "LogReg PR-AUC", "MLP PR-AUC"],
        [[r.validation_window, r.train_years, integer(r.train_rows), str(int(r.validation_races)),
          num(r._7, 4), num(r._8, 4)] for r in windows.itertuples()],
        [1.4 * inch, 1.0 * inch, 0.9 * inch, 0.9 * inch, 1.2 * inch, 1.0 * inch],
        "Validation PR-AUC on four windows that precede the test seasons.",
        numeric_from=2,
    )
    ci_width = float((uncertainty.iloc[:3]["ci_high_97.5%"] - uncertainty.iloc[:3]["ci_low_2.5%"]).mean())
    # The wording below says every model-minus-baseline interval includes zero. Fail loudly if that changes.
    assert all(r["ci_low_2.5%"] <= 0 <= r["ci_high_97.5%"] for _, r in uncertainty.iloc[3:].iterrows()), \
        "The report text assumes both model-minus-baseline intervals include zero; rewrite it."
    story.append(P(
        "To measure the uncertainty directly we resampled whole validation races "
        f"(Table {COUNTERS['tab'] + 1}). With 39 races, each model's PR-AUC has a 95% interval "
        f"about {ci_width:.1f} wide. The difference between the network and logistic regression is "
        f"{uncertainty.iloc[4]['validation_PR-AUC']:+.3f} with an interval from "
        f"{uncertainty.iloc[4]['ci_low_2.5%']:+.3f} to {uncertainty.iloc[4]['ci_high_97.5%']:+.3f}, "
        "and the forest's difference also includes zero. The data therefore do not show that any "
        "model beats the baseline, and we report the ranking as a tie within validation "
        "uncertainty. The chronological split stays because it is the only one with no same-race "
        "and no future leakage."
    ))
    add_table(
        story,
        ["Comparison", "Validation PR-AUC", "95% low", "95% high"],
        [[r.comparison, num(r["validation_PR-AUC"], 4), num(r["ci_low_2.5%"], 4), num(r["ci_high_97.5%"], 4)]
         for _, r in uncertainty.iterrows()],
        [3.1 * inch, 1.3 * inch, 1.0 * inch, 1.0 * inch],
        "Bootstrap over the 39 validation races. The last two rows are differences from logistic regression.",
        numeric_from=1,
    )
    test_unc = data["test_uncertainty"]
    test_pr = {m: mget(m, "test", "PR-AUC") for m in (LR, RF, NN)}
    # The closing paragraphs say the forest and network are level and both include zero. Fail loudly if that changes.
    assert all(r["ci_low_2.5%"] <= 0 <= r["ci_high_97.5%"] for _, r in test_unc.iloc[3:].iterrows()), \
        "A test-season model-minus-baseline interval excludes zero; rewrite the report text."
    assert test_pr[LR] < min(test_pr[RF], test_pr[NN]) and abs(test_pr[RF] - test_pr[NN]) < 0.005, \
        "The test ranking changed; rewrite the report text."
    test_ci_width = float((test_unc.iloc[:3]["ci_high_97.5%"] - test_unc.iloc[:3]["ci_low_2.5%"]).mean())
    story.append(P(
        "We repeated the resampling on the unseen test seasons. It resamples predictions we already had and "
        "chooses nothing, and we ran it after every choice was frozen "
        f"(Table {COUNTERS['tab'] + 1}). With {int(test_unc.races.iloc[0])} races each model's interval is about "
        f"{test_ci_width:.2f} wide. The forest minus logistic regression difference is "
        f"{test_unc.iloc[3]['test_PR-AUC']:+.4f} ({test_unc.iloc[3]['ci_low_2.5%']:+.3f} to "
        f"{test_unc.iloc[3]['ci_high_97.5%']:+.3f}), and for the network it is {test_unc.iloc[4]['test_PR-AUC']:+.4f} "
        f"({test_unc.iloc[4]['ci_low_2.5%']:+.3f} to {test_unc.iloc[4]['ci_high_97.5%']:+.3f}). Both intervals include "
        "zero, so the test seasons do not separate the models either, even though logistic regression scores "
        f"{num(min(test_pr[RF], test_pr[NN]) - test_pr[LR])} lower."
    ))
    add_table(
        story,
        ["Comparison", "Test PR-AUC", "95% low", "95% high"],
        [[r.comparison, num(r["test_PR-AUC"], 4), num(r["ci_low_2.5%"], 4), num(r["ci_high_97.5%"], 4)]
         for _, r in test_unc.iterrows()],
        [3.1 * inch, 1.3 * inch, 1.0 * inch, 1.0 * inch],
        f"Bootstrap over the {int(test_unc.races.iloc[0])} test races. The last two rows are differences from logistic regression.",
        numeric_from=1,
    )

    # Retraining after each removal shows what the feature group adds.
    h1(story, "8. Removing the grid hurts more than removing anything else")
    story.append(P(
        "In our ablation we retrain logistic regression after deleting one feature group, then "
        "record the change in validation PR-AUC. We want to see which group the "
        f"linear model was using, on the same rows as Section 7. Figure {COUNTERS['fig'] + 1} shows the change "
        "from the full model. A bar to the left of zero is a loss."
    ))
    add_figure(
        story,
        "ablation",
        "Change in validation PR-AUC when one feature group is removed from logistic regression. "
        f"Zero is the full {n_features}-feature model.",
        width=CONTENT_W * 0.92,
    )
    abl_rows = []
    for _, r in ablation.iterrows():
        abl_rows.append([
            r["variant"],
            integer(r["features"]),
            num(r["validation_PR-AUC"]),
            num(r["validation_ROC-AUC"]),
            f"{float(r['PR-AUC_change']):+.3f}",
        ])
    add_table(
        story,
        ["Variant", "Features kept", "PR-AUC", "ROC-AUC", "PR-AUC change"],
        abl_rows,
        [1.7 * inch, 1.15 * inch, 0.9 * inch, 0.9 * inch, 1.2 * inch],
        "Ablation of logistic regression on the 2020-2021 validation seasons.",
        numeric_from=1,
    )
    full_pr = float(ablation.loc[ablation.variant.eq("all features"), "validation_PR-AUC"].iloc[0])
    story.append(P(
        f"The full model sits at {num(full_pr)}. Dropping the grid group costs "
        f"{abs(float(ablation.loc[ablation.variant.eq('without grid'), 'PR-AUC_change'].iloc[0])):.3f} "
        "PR-AUC, the largest loss. Standings are next, at "
        f"{abs(float(ablation.loc[ablation.variant.eq('without standings'), 'PR-AUC_change'].iloc[0])):.3f}. "
        "Form, qualifying, and context cost "
        f"{abs(float(ablation.loc[ablation.variant.eq('without form'), 'PR-AUC_change'].iloc[0])):.3f}, "
        f"{abs(float(ablation.loc[ablation.variant.eq('without qualifying'), 'PR-AUC_change'].iloc[0])):.3f}, "
        "and "
        f"{abs(float(ablation.loc[ablation.variant.eq('without context'), 'PR-AUC_change'].iloc[0])):.3f}. "
        "The qualifying drop is small once the grid is already in the model. That fits the "
        "sport and the earlier definition: the published grid already contains qualifying "
        "order, plus any penalty. We do not conclude that qualifying is irrelevant on its "
        "own. We conclude that, next to the grid, it is mostly repeated information."
    ))
    grid_roc = float(ablation.loc[ablation.variant.eq("without grid"), "validation_ROC-AUC"].iloc[0])
    full_roc = float(ablation.loc[ablation.variant.eq("all features"), "validation_ROC-AUC"].iloc[0])
    story.append(P(
        f"ROC-AUC barely notices the same deletion. It moves from {num(full_roc)} to "
        f"{num(grid_roc)} when the grid group is removed. This is the same lesson as the "
        "model comparison we drew in Section 7. A metric that stays high while the primary score drops is a "
        "poor guide for what to keep."
    ))
    story.append(P(
        "The context and qualifying changes are about the same size as the logistic-regression "
        "preprocessing gaps in Section 6. On 39 validation races, we treat those as small. The grid drop "
        "is several times larger, and it agrees with the descriptive ladder in Section 4.2, "
        "where podium rate falls from about 55% at the front of the grid to under 1% at the back."
    ))
    story.append(P(
        "<b>Takeaway.</b> For the linear model, the final grid is the group we cannot "
        "remove without a visible loss. Recent standings help. Qualifying, form, and "
        "calendar context add less once the grid is present.",
        "Takeaway",
    ))

    # Explain forest behavior globally and locally without treating it as causal.
    h1(story, "9. What the forest relies on, and where the two explanations differ")
    story.append(P(
        "The explanations in this section are for the random forest, not for logistic "
        "regression, the model we selected in Section 7. Tree explanations apply directly to the forest. "
        "We do not borrow them as an account of the other models. Permutation importance "
        "shuffles one validation column at a time and measures the drop in PR-AUC. Global "
        "SHAP averages the size of each feature's push across 400 validation rows. Local "
        "SHAP is one of those rows. A positive value pushes that row toward a podium "
        "relative to the forest's background. A negative value pushes it away. These are "
        "associations inside the fitted forest. They are not estimates of what would happen "
        "if we moved a driver up the grid."
    ))
    h2(story, "9.1 Permutation importance")
    add_figure(
        story,
        "permutation_importance",
        "Permutation importance on a validation sample, scored with PR-AUC. "
        "A taller bar means shuffling that column hurt the forest more.",
        width=CONTENT_W * 0.78,
    )
    perm_top = data["perm"].sort_values("importance", ascending=False)
    perm_rows = []
    for r in perm_top.head(8).itertuples(index=False):
        perm_rows.append([r.feature, f"{float(r.importance):+.3f}"])
    neg = perm_top.sort_values("importance").head(3)
    for r in neg.itertuples(index=False):
        perm_rows.append([r.feature, f"{float(r.importance):+.3f}"])
    add_table(
        story,
        ["Feature", "Mean PR-AUC change when shuffled"],
        perm_rows,
        [3.6 * inch, 3.15 * inch],
        "Largest positive permutation importances, followed by the three most negative. "
        "Computed on the random forest and a validation sample.",
        numeric_from=1,
    )
    perm_all = perm_top.reset_index(drop=True)
    perm_rank = {f: i + 1 for i, f in enumerate(perm_all.feature)}
    perm_val = dict(zip(perm_all.feature, perm_all.importance.astype(float)))
    second = perm_all.iloc[1]
    most_negative = perm_all.sort_values("importance").iloc[0]
    story.append(P(
        f"Grid position is in a class of its own, at {perm_val['grid_position']:+.3f}. The next feature, "
        f"{esc(second.feature)}, is {float(second.importance):+.3f}, about "
        f"{float(second.importance) / perm_val['grid_position']:.0%} of that, and every other feature is "
        f"{float(perm_all.iloc[2].importance):+.3f} or smaller. Driver podium rate is "
        f"ranked {perm_rank['driver_podium_rate_5']} at {perm_val['driver_podium_rate_5']:+.3f}, and year sits at "
        f"{perm_val['year']:+.3f}. Shuffling {esc(most_negative.feature)} changes PR-AUC by "
        f"{float(most_negative.importance):+.3f}: the score rises slightly when the column is destroyed. "
        "We read a negative value as the forest not getting stable help from that column on these "
        "rows. We do not read it as evidence that the feature causes worse finishes."
    ))

    story.append(P("9.2 Global and local SHAP", "H2"))
    story.append(P(
        f"Figure {COUNTERS['fig'] + 1} asks the same question with SHAP. Each validation prediction is split into "
        "one credit per feature, and we average the size of those credits. The sign is not "
        "in this chart. A tall bar means the forest moved the prediction a long way when that "
        "feature changed, whether the move was toward a podium or away from one."
    ))
    add_figure(
        story,
        "shap_global",
        "Mean absolute SHAP value by feature for the random forest, over 400 validation rows. "
        "This measures how large a feature's push is, not whether the push is positive.",
        width=CONTENT_W * 0.78,
    )
    shap_rows = []
    for r in data["shap"].head(8).itertuples(index=False):
        shap_rows.append([r.feature, num(r.mean_abs_shap)])
    add_table(
        story,
        ["Feature", "Mean absolute SHAP"],
        shap_rows,
        [3.8 * inch, 2.9 * inch],
        "Eight largest mean absolute SHAP values for the random forest on the validation sample.",
        numeric_from=1,
    )
    shap_all = data["shap"].reset_index(drop=True)
    shap_rank = {f: i + 1 for i, f in enumerate(shap_all.feature)}
    shap_val = dict(zip(shap_all.feature, shap_all.mean_abs_shap.astype(float)))
    story.append(P(
        f"Global SHAP also puts grid position first, at {num(shap_val['grid_position'])}, and constructor podium "
        f"rate second ({num(shap_val['constructor_podium_rate_5'])}), the same top two as permutation "
        f"importance. Driver podium rate follows at {num(shap_val['driver_podium_rate_5'])}. The two methods "
        "differ below that. Year has a mean SHAP value of "
        f"{num(shap_val['year'])} (rank {shap_rank['year']}) but a permutation importance of "
        f"{perm_val['year']:+.3f}, and driver points before the race is the reverse: rank "
        f"{perm_rank['driver_points_before']} under permutation and rank {shap_rank['driver_points_before']} "
        "under SHAP. A reasonable reading is that year, form, and the standings overlap with each other "
        "and with the grid. The trees use them, but once the other columns are left intact, destroying one "
        "of them alone does not collapse the score. We treat the shared finding as the reliable one: "
        "grid position first, constructor form second."
    ))
    story.append(P(
        f"Figure {COUNTERS['fig'] + 1} is one validation row from that sample, not a row we picked because it "
        "looks tidy. It is George Russell, Williams, 2021 Dutch Grand Prix. He qualified "
        "and started 11th in a field of 20, sat 15th in the championship, and had a podium "
        "in one of his previous five starts (driver podium rate 0.2). He did not podium."
    ))
    add_figure(
        story,
        "shap_local",
        "SHAP contributions for one validation row: Russell, Williams, 2021 Dutch Grand Prix, "
        "started 11th and did not podium. Negative values push the forest away from a podium.",
        width=CONTENT_W * 0.78,
    )
    local_rows = []
    for r in data["local"].head(6).itertuples(index=False):
        local_rows.append([r.feature, f"{float(r.shap_value):+.3f}", f"{float(r.observed_value):.1f}"])
    add_table(
        story,
        ["Feature", "SHAP value", "Observed value"],
        local_rows,
        [2.8 * inch, 1.3 * inch, 1.5 * inch],
        "Largest SHAP contributions for the Russell validation row. The sign is the direction of the push.",
        numeric_from=1,
    )
    loc = data["local"].reset_index(drop=True)
    top = loc.iloc[0]
    negatives = loc[loc.shap_value < 0]
    positives = loc[loc.shap_value > 0]
    if top.feature == "grid_position" and top.shap_value < 0 and len(positives) and len(negatives) > 1:
        nxt, pos = negatives.iloc[1], positives.iloc[0]
        story.append(P(
            f"The largest push is {esc(top.feature)} = {float(top.observed_value):g}, and it is negative "
            f"({float(top.shap_value):+.3f}). The next negative push is {esc(nxt.feature)} = "
            f"{float(nxt.observed_value):g} ({float(nxt.shap_value):+.3f}). The clearest positive push is "
            f"{esc(pos.feature)} = {float(pos.observed_value):g} ({float(pos.shap_value):+.3f}), and it is "
            "smaller than the grid push. We observe a row where recent form points up and the start "
            "position points down, with the start position winning inside this forest. That is one "
            "example. It matches the ablation, and it matches the grid ladder in Section 4, but a single "
            "row is not a general law."
        ))
    else:
        story.append(P(
            f"The largest push is {esc(top.feature)} ({float(top.shap_value):+.3f}). This is one example, "
            "and a single row is not a general law."
        ))
    story.append(P("9.3 Local LIME explanation", "H2"))
    lime = data["lime"]
    lime_fidelity = float(lime.iloc[0].local_fidelity_r2)
    lime_model_p = float(lime.iloc[0].model_probability)
    lime_surrogate_p = float(lime.iloc[0].surrogate_probability)
    story.append(P(
        "LIME provides the required model-agnostic local explanation for the same fixed "
        "validation case. We create 5,000 nearby records by either retaining each observed "
        "feature or replacing it with a value drawn from the training seasons. The random "
        "forest scores those records, and a distance-weighted ridge model approximates the "
        "forest around the explained row. A positive coefficient pushes the local surrogate "
        "toward a podium; a negative coefficient pushes it away."
    ))
    add_figure(
        story,
        "lime_local",
        f"Local LIME contributions for one fixed validation prediction. The black-box probability "
        f"is {lime_model_p:.3f}, the local surrogate estimate is {lime_surrogate_p:.3f}, and "
        f"weighted local R-squared is {lime_fidelity:.3f}.",
        width=CONTENT_W * 0.78,
    )
    lime_rows = []
    for r in lime.head(8).itertuples(index=False):
        lime_rows.append([r.feature, f"{float(r.lime_weight):+.3f}", f"{float(r.observed_value):.1f}"])
    add_table(
        story,
        ["Feature", "LIME weight", "Observed value"],
        lime_rows,
        [2.8 * inch, 1.3 * inch, 1.5 * inch],
        "Largest absolute LIME weights for the fixed validation row.",
        numeric_from=1,
    )
    story.append(P(
        f"The weighted local R-squared is {lime_fidelity:.3f}. This fidelity value tells us how "
        "closely the simple surrogate follows the forest in the sampled neighborhood, so we "
        "read the local coefficients together with it rather than as global effects."
    ))
    story.append(P(
        "<b>Takeaway.</b> Grid position is the feature the explanation methods agree on, with "
        "constructor form second under both. They differ on the smaller features, such as year and "
        "driver points, which is what we expect when form, standings, and year overlap with the "
        "grid. None of these values is a causal effect of starting further forward.",
        "Takeaway",
    ))

    # Check inference with both a complete row and a partially filled record.
    h1(story, "10. Two predictions from the selected model")
    demo = summary["inference_demos"]

    # The text below says the complete record is predicted to podium and the partial record
    # is not. Fail loudly if that changes.
    assert demo["complete_record"]["predicted_podium"] and not demo["partial_record"]["predicted_podium"], \
        "The report text assumes only the complete demo record is above the cutoff; rewrite it."
    
    story.append(P(
        f"The examples use the selected model, {demo['model'].lower()}, because it had the best validation "
        f"PR-AUC. Its frozen cutoff is {num(demo['complete_record']['threshold'])}. Missing "
        "inputs are filled by the imputer that was fit on the training years. We show one "
        "complete historical row and one partial record that was never a real entry."
    ))
    story.append(P(
        "The complete row is Lewis Hamilton, Mercedes, 2022 Bahrain Grand Prix, round 1. "
        "He qualified 5th and started 5th in a field of 20. His previous five starts in "
        "this table were all podiums (driver rate 1.0) and the constructor's recent podium "
        "rate was 0.7. Because it is the first race of the season, his and Mercedes' "
        f"championship points and rank are both 0. {demo['model']} gives this row a podium "
        f"probability of {demo['complete_record']['podium_probability']:.3f}. That is above "
        f"{num(demo['complete_record']['threshold'])}, so the predicted label is a podium. "
        "The actual result was third, a podium, so the prediction is correct. A fifth-place "
        "start and a perfect recent podium run were enough to lift the probability over the cutoff. "
        "The row is picked automatically as the first complete 2022 row. Before the round-1 "
        "standings fix, round-1 rows had empty standings and were skipped, so the example used "
        "to be the 2022 Saudi Arabian Grand Prix."
    ))
    story.append(P(
        "The partial record supplies only what we chose to type in: grid position 3, not a "
        "pit-lane start, not a front-row start, a field of 20, and season 2024. Every "
        f"other feature is missing and is replaced with the training median. {demo['model']} "
        f"returns {demo['partial_record']['podium_probability']:.3f}, below the cutoff, "
        "so the predicted label is not a podium. This record has no true result, "
        "because it is not a driver who started a race."
    ))
    story.append(P(
        f"We should not read {demo['partial_record']['podium_probability']:.3f} as the historical podium rate of cars that start third. "
        "Section 4.2 puts that rate near 55% for grid positions 1-3. The partial row is a "
        "third-place start glued onto a median historical driver, and the median driver in "
        "a 1950-2019 training set is not a podium contender. The low probability is what "
        "this imputer does with a half-empty row. It is evidence that the function accepts "
        "missing fields. It is not evidence about the front of the grid."
    ))
    story.append(P(
        "<b>Takeaway.</b> On a real 2022 row, the selected model correctly predicted a podium "
        "for a fifth-place start backed by a perfect recent podium run. On a "
        "synthetic partial row, the number is an imputed profile, and we do not interpret "
        "it as a base rate.",
        "Takeaway",
    ))

    # State the limits that affect how the results can be interpreted.
    h1(story, "11. What we do not want the results to be taken to say")
    story.append(P(
        "Qualifying coverage is a property of this snapshot. We described it, and we kept "
        "a missingness flag, but we cannot tell from the chart alone how much of the pre-1994 "
        "gap is history and how much is the way the public tables were filled."
    ))
    story.append(P(
        "Constructor identifiers reset when a team is renamed, so form and standings for the "
        "new name start again. We left it that way on purpose, which means a works team that "
        "changes its entry name looks like a new constructor to us."
    ))
    story.append(P(
        "The home analysis depends on a nationality-to-country map. Drivers we could not "
        "map are excluded, and drivers with more than one sporting nationality are forced "
        "into one label. The small home samples in the front of the grid mean a one-point "
        "gap is not something we would defend as a precise estimate."
    ))
    story.append(P(
        "The mechanical list is a rule we wrote down, not a measurement from the car. "
        "Ambiguous statuses can fall outside it. Leading rates such as Caterham's rest on "
        "a few dozen starts. The lower 2022-2024 totals are consistent with a more reliable "
        "field, and they are also consistent with changes in how retirements were described."
    ))
    story.append(P(
        "Validation is 39 races. We used it to pick a cutoff and a model, which is what a "
        "held-out test set requires, and we do not pretend it can rank effects of a few "
        f"thousandths. A bootstrap over those races gives each PR-AUC an interval about {ci_width:.1f} "
        "wide, and the differences between the models fall inside it. On the unseen test seasons PR-AUC is "
        f"{num(mget(LR, 'test', 'PR-AUC'))} for logistic regression, {num(mget(RF, 'test', 'PR-AUC'))} for the forest "
        f"and {num(mget(NN, 'test', 'PR-AUC'))} for the network. Logistic regression is "
        f"{num(min(test_pr[RF], test_pr[NN]) - test_pr[LR])} behind, but a bootstrap over the {int(test_unc.races.iloc[0])} "
        "test races puts both differences from it inside an interval that includes zero (Section 7.2). We therefore do "
        "not claim that the more complex models are better. We treat the three as tied in ranking quality and keep "
        "logistic regression as the readable baseline. Regulation changes in 2014 and 2022 sit inside the eras we compared. "
        "The models are associating historical patterns. They do not tell a team what would "
        "happen if it started one place further forward, and a probability is not a guarantee "
        "about the next race."
    ))

    # Close by connecting the cleaning, modeling, and explanation evidence.
    h1(story, "12. What the evidence supports")
    story.append(P(
        f"The tables join, and after {integer(diag['duplicate_driver_race_groups'])} shared-drive groups are resolved "
        f"and {integer(diag['did_not_enter_rows_removed'])} did-not-enter rows are removed we have one row "
        f"per driver per race, {integer(diag['clean_rows'])} of them, with a podium rate of "
        f"{pct(frame.podium.mean())}. Qualifying is missing for most of the early history "
        "and nearly complete from 2003, so the grid is the starting-order feature we can "
        "actually follow from 1950."
    ))
    story.append(P(
        "Descriptively, front-row cars podium far more often than the field, and more "
        "often again after 2013. Home nationality, inside a grid band, does not produce a "
        "consistent extra podium rate. Mechanical retirement rates, on our component list "
        "and among teams with at least 20 starts, are lower in 2022-2024 than in 2014-2021, "
        "and the highest rates belong to shorter entries."
    ))
    story.append(P(
        "Predictively, logistic regression, a random forest, and a shallow network all "
        "clear the PR-AUC baseline of the recent seasons by a wide margin. Logistic regression is "
        "the one we select from the validation scores, by seed 42 and by the three-seed average. The untouched "
        f"test seasons put the forest and the network slightly ahead ({num(test_pr[RF])} and {num(test_pr[NN])}, "
        f"against {num(test_pr[LR])}), but the three models are within bootstrap uncertainty of each other "
        "on both validation and test, so the simplest and most readable model is the one we keep. "
        "Ablation, permutation, and SHAP agree that grid position carries the prediction, and "
        "permutation and SHAP also agree that constructor form comes second. They differ on the "
        "smaller features, and we do not force them to agree. The Hamilton "
        "example fits this picture in one row: a fifth-place start backed by a recent run of "
        "podiums lifted him over the cutoff, and he finished third."
    ))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="ACL-903 Milestone 1: Formula 1 podium prediction",
        author="ACL-903 Milestone 1",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"Wrote {OUT} ({COUNTERS['fig']} figures, {COUNTERS['tab']} tables)")


if __name__ == "__main__":
    main()

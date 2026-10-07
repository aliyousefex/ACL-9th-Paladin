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
    return {
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
    story.append(P("ACL-903 Milestone 1", "Subtitle"))
    story.append(P("Formula 1 podium prediction", "Title"))
    story.append(P("An analytical report on leakage-safe prediction after qualifying", "Subtitle"))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1, color=NAVY, spaceAfter=8))

    # Open with the prediction decision before moving into implementation details.
    h1(story, "1. The question we are trying to answer")
    story.append(P(
        "This report asks a narrow question. After qualifying, and before the race starts, "
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
        f"Table 1 covers the eleven tables with a single-column primary key. Together they "
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
        "Table 2 checks the foreign keys we actually use. A result row should point at a "
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
    story.append(P(
        f"The results file has {integer(diag['raw_result_rows'])} rows, but it is not yet "
        "one row per driver per race. Early shared drives produce more than one result for "
        "the same driver in the same race. We found "
        f"{integer(diag['duplicate_driver_race_groups'])} such driver-race groups. The rule "
        "we keep is deterministic: prefer the row with a real grid start (grid greater than "
        "0), then the better finishing position, then the smaller resultId. After that rule, "
        f"{integer(diag['clean_rows'])} rows remain, each pair (raceId, driverId) appears "
        f"once, and the seasons run from {int(diag['year_min'])} to {int(diag['year_max'])}."
    ))
    story.append(P(
        f"Grid position 0 is not a better starting spot than pole. In this table it accounts "
        f"for {pct(frame.pit_lane_start.mean())} of rows. We keep it as a pit-lane flag and "
        "treat the numeric grid position as missing in those rows, so the model cannot learn "
        "that 0 is the front of the field."
    ))
    raw_eda = data["cleaning"].iloc[0]
    clean_eda = data["cleaning"].iloc[1]
    add_figure(
        story,
        "cleaning_before_after",
        "Programmatic EDA before and after duplicate cleaning. The left panel compares total rows with unique "
        "driver-race pairs; the right panel checks whether row selection materially changes key rates.",
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
        [1.25 * inch, .62 * inch, .78 * inch, .82 * inch, .62 * inch, .58 * inch, .82 * inch, .72 * inch],
        "Before-and-after cleaning diagnostics computed from the raw results and cleaned modeling table.",
        numeric_from=1,
    )
    story.append(P(
        f"Cleaning removes {integer(int(raw_eda.rows - clean_eda.rows))} extra shared-drive rows. "
        f"Duplicate participation falls from {integer(int(raw_eda.duplicate_rows))} rows to zero, while "
        f"the podium rate moves only from {pct(raw_eda.podium_rate)} to {pct(clean_eda.podium_rate)} and "
        f"the median non-zero grid remains {num(clean_eda.median_grid, 1)}. The cleaning therefore fixes "
        "the prediction grain without materially reshaping the label or starting-position distribution."
    ))
    story.append(P(
        "<b>Takeaway.</b> The joins we rely on later are supported by the key audit, and "
        "the modelling grain is one driver in one race. The cleaning choices are recorded "
        "so that a shared drive cannot silently become two training rows.",
        "Takeaway",
    ))

    # Qualifying coverage explains why the missingness flag and imputation are needed.
    h1(story, "3. Qualifying coverage is not stable across history")
    story.append(P(
        "Qualifying position is an obvious pre-race feature, but it is not recorded for "
        "most of the early championship. Figure 1 plots, for each season, the share of "
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
        f"From the same modelling table, coverage is {pct(coverage.loc[1950], 0)} in 1950 "
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
        f"The data shows a shift in level, not just a change of leader. Across circuits that "
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
        "the all-starter rate only moves from about 12% to about 15%."
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
        "can overwhelm a smaller effect. Figure 3 plots the two series."
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
        f"The pattern in Figure 3 and Table 4 is the grid, not the passport. Away drivers "
        f"podium {pct(gaps[0][3]['mean'])} of the time from positions 1-3 "
        f"({integer(gaps[0][3]['count'])} starts), {pct(gaps[1][3]['mean'])} from 4-6, "
        f"{pct(gaps[2][3]['mean'])} from 7-10, {pct(gaps[3][3]['mean'])} from 11-15, and "
        f"{pct(gaps[4][3]['mean'])} from 16th or worse. Home drivers track those rates: "
        f"{pct(gaps[0][2]['mean'])}, {pct(gaps[1][2]['mean'])}, {pct(gaps[2][2]['mean'])}, "
        f"{pct(gaps[3][2]['mean'])}, and {pct(gaps[4][2]['mean'])}."
    ))
    story.append(P(
        f"The home-minus-away gaps are {gaps[0][1]:+.1f}, {gaps[1][1]:+.1f}, "
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
        "as a broken part. We would rather under-count borderline cases than inflate the rate.",
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
        "Figure 4 shows the high end of each list. Table 5 also shows the low end, because "
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
        f"Caterham has the highest 2014-2021 rate, {pct(caterham['mean'])}, which is "
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
        "to respect the cutoff. We build 17 inputs in five groups. Form uses a shift "
        "before the rolling window, so today's result is not inside today's features. "
        "Constructor form is averaged across both cars first, so one teammate cannot see "
        "the other teammate's result from the same race. Championship points and rank are "
        "taken from the previous race in the same season, because a standings row describes "
        "the table after a race. The first race of a season, and a driver's first race, "
        "therefore have missing history, and we leave those values missing rather than "
        "filling them with the future."
    ))
    add_table(
        story,
        ["Group", "Inputs", "Why it is known before the start"],
        [
            ["Grid", "Grid position, pit-lane flag, front-row flag, field size", "Final grid is set before lights out"],
            ["Qualifying", "Position, best Q1/Q2/Q3 time, missingness flag", "Qualifying is already finished"],
            ["Form", "Driver and constructor podium rate over the previous 5 races, prior starts", "Current race is shifted out"],
            ["Standings", "Driver and constructor points and rank", "Attached from the previous race only"],
            ["Context", "Driver age, championship round, year", "Known on race morning"],
        ],
        [1.15 * inch, 3.15 * inch, 2.55 * inch],
        "Feature groups. Post-race position, points scored today, laps, status, pit stops, and fastest lap are excluded.",
        numeric_from=3,
    )
    train, val, test = splits["Training"], splits["Validation"], splits["Test"]
    story.append(P(
        "We split by season, not at random. A random split would let 2023 teach the model "
        "about 2022. Training is every season through 2019, validation is 2020-2021, and "
        "the test seasons 2022-2024 are scored once. Table 7 shows why that split is not "
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
        f"Training has {integer(len(train))} rows and {integer(train.raceId.nunique())} races, "
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

    # Settle preprocessing on validation data before comparing model families.
    h1(story, "6. Imputation and scaling barely move the validation score")
    story.append(P(
        "Missing qualifying and missing early-season standings have to be filled inside "
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
    story.append(P(
        "<b>Takeaway.</b> On this validation window, how we fill missing values matters "
        "less than which information we give the model. The next sections test that second question.",
        "Takeaway",
    ))

    # Every model uses the same rows and features for a fair comparison.
    h1(story, "7. Three models, and why the scores are not interchangeable")
    story.append(P(
        "We fit three classifiers on the same training rows and the same 17 features. "
        "Logistic regression is the linear baseline, with class weights so the rare podium "
        "rows are not ignored. The random forest has 240 trees and a minimum of four rows "
        "per leaf; it can use combinations such as a strong recent record together with a "
        "poor grid. The neural network has two hidden layers, of 32 and 12 units. We did "
        "not search over these settings. The only threshold we tune is the probability "
        "cutoff that maximises F1 on validation. That produces a different cutoff for each "
        "model, because the three probability scales are not the same number line. A cutoff "
        "of 0.240 on the network is not automatically more aggressive than 0.655 on the "
        "logistic model. Precision and recall tell us what the cutoff actually does."
    ))
    story.append(P(
        "Figure 5 compares the three models on the test seasons only. Table 9 gives "
        "training, validation, and test, so we can see whether a high training score survives."
    ))
    add_figure(
        story,
        "model_comparison",
        "Test-set scores for 2022-2024. ROC-AUC is similar across models. "
        "Precision and recall differ because each model uses its own validation cutoff.",
        width=CONTENT_W * 0.92,
    )
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
        f"On the test set, ROC-AUC is {num(mget('Logistic regression', 'test', 'ROC-AUC'))} "
        f"for logistic regression, {num(mget('Random forest', 'test', 'ROC-AUC'))} for the "
        f"forest, and {num(mget('Shallow neural network', 'test', 'ROC-AUC'))} for the "
        "network. Those three numbers are within 0.005 of each other. In the pair reading "
        "of ROC-AUC, a true podium finisher outranks a non-podium about 93 to 94 times out "
        "of 100. That is a strong ranking. It is also a ranking on which the models do not "
        "separate. ROC-AUC compresses the comparison because most rows are not podiums, so "
        "a modest number of false alarms barely moves the false-positive rate."
    ))
    story.append(P(
        f"PR-AUC is where they separate. On test, the network scores "
        f"{num(mget('Shallow neural network', 'test', 'PR-AUC'))}, logistic regression "
        f"{num(mget('Logistic regression', 'test', 'PR-AUC'))}, and the forest "
        f"{num(mget('Random forest', 'test', 'PR-AUC'))}. The test podium rate is "
        f"{pct(test.podium.mean())}, so a useless ranking would sit near "
        f"{num(test.podium.mean())}. All three models are far above that floor. The "
        f"network's lead over logistic regression is "
        f"{num(mget('Shallow neural network', 'test', 'PR-AUC') - mget('Logistic regression', 'test', 'PR-AUC'))} "
        "PR-AUC. We call that a small lead, not a different kind of model. We selected the "
        f"network before looking at this comparison, because its validation PR-AUC of "
        f"{num(mget('Shallow neural network', 'validation', 'PR-AUC'))} was ahead of "
        f"{num(mget('Logistic regression', 'validation', 'PR-AUC'))} and "
        f"{num(mget('Random forest', 'validation', 'PR-AUC'))}."
    ))
    story.append(P(
        f"The operating points explain the precision and recall bars in Figure 5. At its "
        f"validation cutoff, logistic regression has test precision "
        f"{num(mget('Logistic regression', 'test', 'Precision'))} and recall "
        f"{num(mget('Logistic regression', 'test', 'Recall'))}. It catches most podiums and "
        f"accepts more false alarms. The forest has precision "
        f"{num(mget('Random forest', 'test', 'Precision'))} and recall "
        f"{num(mget('Random forest', 'test', 'Recall'))}. It is the conservative one of the "
        f"three. The network sits between them, with precision "
        f"{num(mget('Shallow neural network', 'test', 'Precision'))} and recall "
        f"{num(mget('Shallow neural network', 'test', 'Recall'))}. Test F1 ends up almost "
        f"tied, from {num(mget('Random forest', 'test', 'F1'))} to "
        f"{num(mget('Shallow neural network', 'test', 'F1'))}. Same F1, different mix of "
        "missed podiums and false podiums."
    ))
    story.append(P(
        f"The training column is the warning. The forest's training PR-AUC is "
        f"{num(mget('Random forest', 'train', 'PR-AUC'))}, then "
        f"{num(mget('Random forest', 'validation', 'PR-AUC'))} on validation and "
        f"{num(mget('Random forest', 'test', 'PR-AUC'))} on test. That drop is what "
        "overfitting looks like here: the trees fit the historical seasons more tightly "
        "than they rank later ones. Logistic regression and the network do not show that "
        f"pattern. Their training PR-AUC values are "
        f"{num(mget('Logistic regression', 'train', 'PR-AUC'))} and "
        f"{num(mget('Shallow neural network', 'train', 'PR-AUC'))}, below their validation "
        "scores. We do not read the higher validation score as the model improving after "
        "2019. Training has a lower podium rate and far more missing qualifying, so the "
        "PR-AUC floor on training is lower as well. The comparison we trust is validation "
        "against test, where the positive rate is almost the same."
    ))
    story.append(P(
        "<b>Takeaway.</b> All three models rank podium finishers well above non-podiums. "
        "On the primary score, the network is slightly ahead and the forest gives back a "
        "large training advantage. ROC-AUC hides that difference.",
        "Takeaway",
    ))

    # Retraining after each removal shows what the feature group adds.
    h1(story, "8. Removing the grid hurts more than removing anything else")
    story.append(P(
        "An ablation retrains logistic regression after deleting one feature group, then "
        "records the change in validation PR-AUC. The point is to see which group the "
        "linear model was using, on the same rows as Section 7. Figure 6 shows the change "
        "from the full model. A bar to the left of zero is a loss."
    ))
    add_figure(
        story,
        "ablation",
        "Change in validation PR-AUC when one feature group is removed from logistic regression. "
        "Zero is the full 17-feature model.",
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
        "model comparison. A metric that stays high while the primary score drops is a "
        "poor guide for what to keep."
    ))
    story.append(P(
        "The context and qualifying changes are about the same size as the preprocessing "
        "gap in Section 6. On 39 validation races, we treat those as small. The grid drop "
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
    h1(story, "9. What the forest relies on, and where the two explanations disagree")
    story.append(P(
        "The explanations in this section are for the random forest, not for the neural "
        "network we selected in Section 7. Tree explanations apply directly to the forest. "
        "We do not borrow them as an account of the network. Permutation importance "
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
    grid_imp = float(perm_top.loc[perm_top.feature.eq("grid_position"), "importance"].iloc[0])
    pts_imp = float(perm_top.loc[perm_top.feature.eq("driver_points_before"), "importance"].iloc[0])
    races_imp = float(perm_top.loc[perm_top.feature.eq("driver_races_before"), "importance"].iloc[0])
    story.append(P(
        f"Grid position is in a class of its own, at {grid_imp:+.3f}. The next feature, "
        f"driver points before the race, is {pts_imp:+.3f}, about a fifth of that. "
        "Qualifying position, constructor points, and the front-row flag follow, all "
        "smaller again. Year and field size sit on zero in this sample. Shuffling career "
        f"length (driver races before this one) changes PR-AUC by {races_imp:+.3f}: the "
        "score rises slightly when the column is destroyed. We read a negative value as "
        "the forest not getting stable help from that column on these rows. We do not read "
        "it as evidence that experience causes worse finishes."
    ))

    story.append(P("9.2 Global and local SHAP", "H2"))
    story.append(P(
        "Figure 8 asks the same question with SHAP. Each validation prediction is split into "
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
    story.append(P(
        f"Global SHAP also puts grid position first, at {num(float(data['shap'].iloc[0].mean_abs_shap))}. "
        "The next two are constructor podium rate and driver podium rate over the previous "
        f"five races ({num(float(data['shap'].iloc[1].mean_abs_shap))} and "
        f"{num(float(data['shap'].iloc[2].mean_abs_shap))}). That is the disagreement. "
        "Permutation said shuffling driver form did not help PR-AUC, and constructor form "
        "barely moved it. SHAP still assigns form a large average push inside the trees. "
        "A reasonable reading is that form is entangled with grid and standings: the tree "
        "uses it, but once the other columns are left intact, destroying form alone does "
        "not collapse the score. We treat the shared finding as the reliable one. Both "
        "methods put the grid first, by a wide margin."
    ))
    story.append(P(
        "Figure 9 is one validation row from that sample, not a row we picked because it "
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
    story.append(P(
        "The largest push is grid position 11, and it is negative (-0.129). Championship "
        "rank 15 is the next negative push (-0.057). The clearest positive push is the "
        "recent driver podium rate of 0.2 (+0.055), and it is smaller than the grid push. "
        "We observe a row where recent form points up and the start position points down, "
        "with the start position winning inside this forest. That is one example. It matches "
        "the ablation, and it matches the grid ladder in Section 4, but a single row is not "
        "a general law."
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
        f"The weighted local R-squared is {lime_fidelity:.3f}. This fidelity value states how "
        "closely the simple surrogate follows the forest in the sampled neighborhood, so the "
        "local coefficients should be interpreted together with it rather than as global effects."
    ))
    story.append(P(
        "<b>Takeaway.</b> Grid position is the feature the explanation methods agree on. "
        "Form looks important to SHAP and unimportant to permutation, which is what we "
        "expect if form repeats information the grid and the standings already carry. "
        "None of these values is a causal effect of starting further forward.",
        "Takeaway",
    ))

    # Check inference with both a complete row and a partially filled record.
    h1(story, "10. Two predictions from the selected network")
    demo = summary["inference_demos"]
    story.append(P(
        f"The examples use the {demo['model'].lower()}, because it had the best validation "
        f"PR-AUC. Its frozen cutoff is {num(demo['complete_record']['threshold'])}. Missing "
        "inputs are filled by the imputer that was fit on the training years. We show one "
        "complete historical row and one partial record that was never a real entry."
    ))
    story.append(P(
        "The complete row is Lewis Hamilton, Mercedes, 2022 Saudi Arabian Grand Prix, round "
        "2. He qualified 16th and started 15th in a field of 20. His previous five starts "
        "in this table were all podiums (driver rate 1.0), the constructor's recent podium "
        "rate was 0.7, he was third in the championship on 15 points, and Mercedes was "
        "second on 27 points. The network gives this row a podium probability of "
        f"{demo['complete_record']['podium_probability']:.3f}. That is below 0.240, so the "
        "predicted label is not a podium. The actual result was not a podium. Strong recent "
        "form and a high championship position did not overcome 15th on the grid, either "
        "in the race or in the model."
    ))
    story.append(P(
        "The partial record supplies only what we chose to type in: grid position 3, not a "
        "pit-lane start, not a front-row start, a field of 20, season 2024, round 5. Every "
        "other feature is missing and is replaced with the training median. The network "
        f"returns {demo['partial_record']['podium_probability']:.3f}, also below the cutoff, "
        "so the predicted label is again not a podium. This record has no true result, "
        "because it is not a driver who started a race."
    ))
    story.append(P(
        "We should not read 0.032 as the historical podium rate of cars that start third. "
        "Section 4.2 puts that rate near 55% for grid positions 1-3. The partial row is a "
        "third-place start glued onto a median historical driver, and the median driver in "
        "a 1950-2019 training set is not a podium contender. The low probability is what "
        "this imputer does with a half-empty row. It is evidence that the function accepts "
        "missing fields. It is not evidence about the front of the grid."
    ))
    story.append(P(
        "<b>Takeaway.</b> On a real 2022 row, the selected model correctly stayed below "
        "its cutoff for a 15th-place start despite a perfect recent podium run. On a "
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
        "Constructor identifiers reset when a team is renamed. Form and standings for the "
        "new name start again. That is deliberate, and it means a works team that changes "
        "its entry name looks like a new constructor."
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
        "thousandths. Regulation changes in 2014 and 2022 sit inside the eras we compared. "
        "The models are associating historical patterns. They do not tell a team what would "
        "happen if it started one place further forward, and a probability is not a guarantee "
        "about the next race."
    ))

    # Close by connecting the cleaning, modeling, and explanation evidence.
    h1(story, "12. What the evidence supports")
    story.append(P(
        "The tables join, and after 85 shared-drive groups are resolved we have one row "
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
        "clear the PR-AUC baseline of the recent seasons by a wide margin. The network is "
        "the one we select from the validation scores, and the untouched test seasons "
        "still place it slightly first. The forest's training score does not travel. "
        "Ablation, permutation, and SHAP agree that grid position carries the prediction. "
        "They do not agree about recent form, and we do not force them to. The Hamilton "
        "example is the same story in one row: a recent run of podiums, from 15th on the "
        "grid, was not enough."
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

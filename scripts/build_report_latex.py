"""Render the analytical report as one LaTeX file for Overleaf.

The prose, tables, and numbers come from ``build_report.py`` itself, so the PDF report and
the LaTeX report cannot drift apart. Every chart is drawn natively with pgfplots from the
saved artifacts, so the single ``.tex`` file compiles without any image upload.

    python scripts/build_report_latex.py
"""

from __future__ import annotations

import contextlib
import html
import io
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

import build_report as br  # noqa: E402
from f1podium import pipeline as pl  # noqa: E402

ART, FIG = br.ART, br.FIG
OUT = ROOT / "reports" / "milestone_1_analytical_report.tex"

MODEL_COLORS = {"Logistic regression": "modelA", "Random forest": "modelB", "Shallow neural network": "modelC"}


# ---------------------------------------------------------------- text helpers
SPECIAL = {
    "\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#", "_": r"\_",
    "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "^": r"\textasciicircum{}",
}
TAG = re.compile(r"(</?[bi]>|<br\s*/?>)")


def tex(text) -> str:
    """Escape plain text for LaTeX."""
    out = "".join(SPECIAL.get(c, c) for c in html.unescape(str(text)))
    out = out.replace("->", r"$\rightarrow$")
    # A leading minus in front of a digit should be a real minus sign, not a hyphen.
    out = re.sub(r"(?<![\w}])-(?=\d)", r"$-$", out)
    return out


def markup(text: str) -> str:
    """Convert the small ReportLab markup used in the report prose to LaTeX."""
    pieces = []
    for part in TAG.split(text):
        if part == "<b>":
            pieces.append(r"\textbf{")
        elif part == "<i>":
            pieces.append(r"\textit{")
        elif part in ("</b>", "</i>"):
            pieces.append("}")
        elif part.startswith("<br"):
            pieces.append(r"\\ ")
        else:
            pieces.append(tex(part))
    return "".join(pieces)


class Raw:
    """One block of finished LaTeX in the story."""

    def __init__(self, source: str):
        self.source = source


# ------------------------------------------------------------ story renderers
HEADINGS = {"sec": 0, "sub": 0}


def heading(level: int, text: str) -> Raw:
    """Emit a numbered heading and check that the written number matches LaTeX's own."""
    match = re.match(r"^(\d+(?:\.\d+)*)\.?\s+(.*)$", text)
    written, title = (match.group(1), match.group(2)) if match else ("", text)
    if level == 1:
        HEADINGS["sec"] += 1; HEADINGS["sub"] = 0
        expected = str(HEADINGS["sec"])
        command = "section"
    else:
        HEADINGS["sub"] += 1
        expected = f"{HEADINGS['sec']}.{HEADINGS['sub']}"
        command = "subsection"
    if written and written != expected:
        print(f"warning: heading '{text}' is numbered {expected} in LaTeX")
    return Raw(f"\n\\{command}{{{markup(title)}}}\n")


def P(text: str, style: str = "Body"):
    """Render a paragraph; headings, the title block, and takeaways get their own form."""
    if style == "H1":
        return heading(1, text)
    if style == "H2":
        return heading(2, text)
    body = markup(text)
    if style == "Title":
        return Raw("\\begin{center}{\\LARGE\\bfseries\\color{navy} " + body + "\\par}\\end{center}\n")
    if style == "Subtitle":
        return Raw("\\begin{center}{\\itshape\\color{muted} " + body + "\\par}\\end{center}\n")
    if style == "Takeaway":
        return Raw("\\begin{takeaway}\n" + body + "\n\\end{takeaway}\n")
    if style == "Small":
        return Raw("{\\small " + body + "\\par}\n")
    return Raw(body + "\n")


def h1(story, text: str):
    """Add a first-level heading."""
    story.append(heading(1, text))


def h2(story, text: str):
    """Add a second-level heading."""
    story.append(heading(2, text))


def add_title_page(story):
    """Add the title page with the team members."""
    members = " \\\\\n".join(" & ".join(tex(cell) for cell in member) for member in br.TEAM) + " \\\\"
    story.append(Raw(
        "\\thispagestyle{empty}\n\\vspace*{0.17\\textheight}\n\\begin{center}\n"
        "{\\itshape\\color{muted}\\large ACL-903 Milestone 1\\par}\n\\vspace{8pt}\n"
        "{\\fontsize{27}{31}\\selectfont\\bfseries\\color{navy} Formula 1 podium prediction\\par}\n\\vspace{8pt}\n"
        "\\vspace{22pt}\n"
        "{\\LARGE\\bfseries\\color{navy} Paladin\\par}\n\\vspace{14pt}\n"
        "{\\small\\setlength{\\tabcolsep}{9pt}\\renewcommand{\\arraystretch}{1.35}\n"
        "\\begin{tabular}{llll}\n\\toprule\n"
        "\\textbf{Name} & \\textbf{ID} & \\textbf{Email} & \\textbf{Tutorial} \\\\\n\\midrule\n"
        + members + "\n\\bottomrule\n\\end{tabular}}\n\\end{center}\n\\clearpage\n"
    ))


def add_table(story, headers, rows, widths, caption: str, numeric_from: int = 1):
    """Add a numbered table sized to the text width."""
    br.COUNTERS["tab"] += 1
    n, total = len(headers), float(sum(widths))
    columns = []
    for i, width in enumerate(widths):
        align = r">{\raggedleft\arraybackslash}" if i >= numeric_from else r">{\raggedright\arraybackslash}"
        share = int(round(width / total * 1000))
        columns.append(f"{align}p{{\\dimexpr(\\linewidth-{2 * n}\\tabcolsep)*{share}/1000\\relax}}")
    head = " & ".join(r"\textcolor{white}{\textbf{" + tex(h) + "}}" for h in headers)
    lines = [f"{head} \\\\"]
    body = [" & ".join(tex(cell) for cell in row) + " \\\\" for row in rows]
    size = r"\footnotesize" if n >= 7 else r"\small"
    source = (
        "\\begin{table}[H]\n\\centering\n"
        f"\\caption{{{markup(caption)}}}\n"
        f"{{{size}\\rowcolors{{2}}{{white}}{{zebra}}\n"
        f"\\begin{{tabular}}{{{''.join(columns)}}}\n\\toprule\n"
        f"\\rowcolor{{navy}}\n{lines[0]}\n\\midrule\n" + "\n".join(body) + "\n\\bottomrule\n"
        "\\end{tabular}}\n\\end{table}\n"
    )
    story.append(Raw(source))


def add_figure(story, name: str, caption: str, width: float | None = None):
    """Add a numbered figure drawn natively with pgfplots."""
    br.COUNTERS["fig"] += 1
    fraction = 1.0 if width is None else min(1.0, width / br.CONTENT_W)
    drawing = FIGURES[name](fraction)
    story.append(Raw(
        "\\begin{figure}[H]\n\\centering\n" + drawing + "\n"
        f"\\caption{{{markup(caption)}}}\n\\end{{figure}}\n"
    ))


# ------------------------------------------------------------------ pgfplots
def label(text: str) -> str:
    """Escape an axis label and keep commas out of pgfplots lists."""
    return tex(text).replace(",", "")


def labels(items) -> str:
    """Join axis labels for a pgfplots list."""
    return "{" + ",".join(label(x) for x in items) + "}"


def points(xs, ys) -> str:
    """Return pgfplots coordinates."""
    return " ".join(f"({x:.6g},{y:.6g})" for x, y in zip(xs, ys))


def hbar(frac, title, names, values, *, xlabel, color="navy", height=None, colors=None, extra="") -> str:
    """One horizontal bar chart with the first item at the top."""
    n = len(names)
    height = height or max(3.0, 0.42 * n + 1.2)
    plots = []
    if colors is None:
        plots.append(f"\\addplot[xbar, fill={color}, draw=none] coordinates {{{points(values, range(n))}}};")
    else:
        for shade in dict.fromkeys(colors):
            idx = [i for i, c in enumerate(colors) if c == shade]
            plots.append(f"\\addplot[xbar, fill={shade}, draw=none] coordinates "
                         f"{{{points([values[i] for i in idx], idx)}}};")
    return (
        "\\begin{tikzpicture}\n\\begin{axis}[xbar, bar width=6pt, "
        f"width={0.62 * frac:.3f}\\linewidth, height={height:.1f}cm, scale only axis, "
        f"ytick={{{','.join(map(str, range(n)))}}}, yticklabels={labels(names)}, y dir=reverse, "
        f"ymin=-0.7, ymax={n - 0.3}, xlabel={{{xlabel}}}, xmajorgrids, "
        + ("xmin=0, " if min(values) >= 0 else "") +
        f"yticklabel style={{font=\\scriptsize}}, enlarge x limits=0.1, "
        f"title={{{label(title)}}}, {extra}]\n" + "\n".join(plots) + "\n\\end{axis}\n\\end{tikzpicture}"
    )


def fig_cleaning(frac):
    """Rows and unique pairs at each cleaning stage, and the rates row selection could change."""
    c = pd.read_csv(ART / "cleaning_eda.csv")
    stages = ["Raw", "Shared drives resolved", "F rows removed"]
    n = len(c)
    left = (
        "\\nextgroupplot[ybar, bar width=9pt, title={Grain at each cleaning stage}, ylabel={Rows / unique pairs}, "
        f"xtick={{0,1,2}}, xticklabels={labels(stages)}, xticklabel style={{font=\\tiny, text width=1.5cm, align=center}}, "
        "ymin=0, ymax=42000, scaled y ticks=false, legend pos=north east]\n"
        f"\\addplot[fill=modelA, draw=none] coordinates {{{points(range(n), c.rows)}}};\n"
        f"\\addplot[fill=modelB, draw=none] coordinates {{{points(range(n), c.unique_driver_races)}}};\n"
        "\\legend{rows, unique driver-race pairs}\n"
    )
    measures = ["podium_rate", "pit_lane_share", "missing_finish_share"]
    shades = ["modelA", "modelB", "modelC"]
    series = "".join(
        f"\\addplot[fill={shades[i]}, draw=none] coordinates {{{points(range(3), [c.loc[i, m] for m in measures])}}};\n"
        for i in range(n))
    right = (
        "\\nextgroupplot[ybar, bar width=7pt, title={Rates affected by row selection}, ylabel={Share of rows}, "
        f"xtick={{0,1,2}}, xticklabels={{podium,grid 0,missing finish}}, ymin=0, legend pos=north east]\n"
        + series + "\\legend{Raw, Shared drives resolved, F rows removed}\n"
    )
    return (
        "\\begin{tikzpicture}\n\\begin{groupplot}[group style={group size=2 by 1, horizontal sep=1.7cm}, "
        f"width={0.40 * frac:.3f}\\linewidth, height=5.2cm, ymajorgrids, "
        "enlarge x limits=0.35]\n" + left + right + "\\end{groupplot}\n\\end{tikzpicture}"
    )


def fig_coverage(frac):
    """Share of rows with a qualifying position, by season."""
    frame = pd.read_csv(ART / "modeling_table.csv", low_memory=False, usecols=["year", "qualifying_position"])
    cov = frame.groupby("year").qualifying_position.apply(lambda s: float(s.notna().mean()))
    return (
        "\\begin{tikzpicture}\n\\begin{axis}[width=" f"{0.92 * frac:.3f}\\linewidth, height=5.2cm, "
        "xlabel={Season}, ylabel={Qualifying coverage}, ymin=0, ymax=1.05, xmin=1950, xmax=2024, "
        "ymajorgrids, scaled ticks=false, xtick distance=10]\n"
        f"\\addplot[navy, thick] coordinates {{{points(cov.index, cov.values)}}};\n"
        "\\end{axis}\n\\end{tikzpicture}"
    )


def two_hbar(frac, table, era_col, name_col, xlabel, eras, colors, per_era=10):
    """Two stacked horizontal bar charts, one per era."""
    charts = []
    for era, color in zip(eras, colors):
        part = table[table[era_col] == era].head(per_era)
        charts.append(hbar(frac, era, list(part[name_col]), list(part["mean"]), xlabel=xlabel, color=color,
                           height=5.0))
    return "\n\\medskip\n".join(charts)


def fig_front_row(frac):
    """Front-row podium conversion by circuit, per era."""
    q1 = pd.read_csv(ART / "front_row_circuits.csv")
    return two_hbar(frac, q1, "era", "circuit_name", "Front-row to podium rate", ["1950-2013", "2014-2024"],
                    ["modelA", "modelB"])


def fig_home(frac):
    """Podium rate by grid band for home and away drivers."""
    q2 = pd.read_csv(ART / "home_effect.csv")
    bands = ["1-3", "4-6", "7-10", "11-15", "16+"]
    series = []
    for flag, color, name in [(False, "modelA", "away"), (True, "modelB", "home")]:
        part = q2[q2.home_race == flag].set_index("grid_band").loc[bands]
        series.append(f"\\addplot[{color}, thick, mark=*] coordinates {{{points(range(5), part['mean'])}}};")
    return (
        "\\begin{tikzpicture}\n\\begin{axis}[" f"width={0.72 * frac:.3f}\\linewidth, height=5.4cm, "
        f"xlabel={{Starting-grid band}}, ylabel={{Podium rate}}, xtick={{0,1,2,3,4}}, xticklabels={labels(bands)}, "
        "ymin=0, ymajorgrids, legend pos=north east, enlarge x limits=0.1]\n" + "\n".join(series)
        + "\n\\legend{Other races, Home races}\n\\end{axis}\n\\end{tikzpicture}"
    )


def fig_home_exact(frac):
    """Podium rate by exact grid position for home and away starts."""
    q2 = pd.read_csv(ART / "home_exact_grid.csv")
    series = []
    for flag, color in [(False, "modelA"), (True, "modelB")]:
        part = q2[q2.home_race == flag].sort_values("grid_position")
        series.append(f"\\addplot[{color}, thick, mark=*, mark size=1.2pt] coordinates "
                      f"{{{points(part.grid_position, part['mean'])}}};")
    return ("\\begin{tikzpicture}\n\\begin{axis}[" f"width={0.9 * frac:.3f}\\linewidth, height=5.4cm, "
            "xlabel={Exact starting-grid position}, ylabel={Podium rate}, xmin=1, xmax=24, ymin=0, "
            "ymajorgrids, legend pos=north east]\n" + "\n".join(series)
            + "\n\\legend{Other races, Home races}\n\\end{axis}\n\\end{tikzpicture}")


def fig_raw_profile(frac):
    """Initial table sizes and missing-cell shares for all fourteen source tables."""
    d = pd.read_csv(ART / "raw_table_profile.csv").sort_values("rows")
    left = hbar(frac, "Rows in raw table", list(d.table), list(np.log10(d.rows)), xlabel="log10(rows)",
                color="modelA", height=7.0)
    right = hbar(frac, "Missing cells before cleaning", list(d.table), list(d.missing_share),
                 xlabel="Missing-cell share", color="modelB", height=7.0)
    return left + "\n\\medskip\n" + right


def fig_mechanical(frac):
    """Highest mechanical-retirement rates per era."""
    q3 = pd.read_csv(ART / "mechanical_retirements.csv")
    return two_hbar(frac, q3, "era", "constructor_name", "Mechanical-retirement rate", ["2014-2021", "2022-2024"],
                    ["modelA", "modelB"])


def fig_split(frac):
    """Rows, podium rate, and qualifying missingness by season, coloured by split."""
    frame = pd.read_csv(ART / "modeling_table.csv", low_memory=False,
                        usecols=["year", "podium", "qualifying_missing"])
    parts = [(name, frame[frame.year.between(a, b)]) for name, (a, b) in pl.SPLIT_YEARS.items()]
    colors = {"train": "splitA", "validation": "splitB", "test": "splitC"}
    panels = []
    for column, how, title, ymax in [("podium", "size", "Driver-race rows", 900),
                                     ("podium", "mean", "Podium rate", 0.25),
                                     ("qualifying_missing", "mean", "Qualifying missing", 1.05)]:
        plots = []
        for name, part in parts:
            by_year = part.groupby("year")[column].agg(how)
            plots.append(f"\\addplot[ybar, bar shift=0pt, bar width=1.6pt, fill={colors[name]}, draw=none] coordinates "
                         f"{{{points(by_year.index, by_year.values)}}};")
        limit = f", ymax={ymax}" if ymax else ""
        legend = "\\legend{train, validation, test}\n" if title == "Driver-race rows" else ""
        panels.append(f"\\nextgroupplot[title={{{title}}}, xlabel={{Season}}, ymin=0{limit}, xtick={{1950,1975,2000}}, "
                      "scaled ticks=false, area legend, legend pos=north west]\n" + "\n".join(plots) + "\n" + legend)
    return (
        "\\begin{tikzpicture}\n\\begin{groupplot}[group style={group size=3 by 1, horizontal sep=1.35cm}, "
        f"width={0.30 * frac:.3f}\\linewidth, height=4.4cm, ymajorgrids, xmin=1948, xmax=2026]\n"
        + "\n".join(panels) + "\\end{groupplot}\n\\end{tikzpicture}"
    )


def _histogram(values, edges, density=False):
    """Return pgfplots interval-bar coordinates for a histogram."""
    counts, edges = np.histogram(values, bins=edges, density=density)
    floor = 0.5 if not density else 0.0
    ys = [c if c > 0 else floor for c in counts]
    return points(list(edges[:-1]) + [edges[-1]], ys + [ys[-1]])


def fig_preprocessing_distributions(frac):
    """Imputation spike (top) and training-fitted scaling shift (bottom)."""
    frame = pd.read_csv(ART / "modeling_table.csv", low_memory=False, parse_dates=["date"])
    splits = pl.split_by_time(frame)
    train, val = splits["train"][pl.FEATURES], splits["validation"][pl.FEATURES]
    imputer = SimpleImputer(strategy="median").fit(train)
    imputed = pd.DataFrame(imputer.transform(train), columns=pl.FEATURES)
    scaler = StandardScaler().fit(imputed)
    scaled = pd.DataFrame(scaler.transform(imputed), columns=pl.FEATURES)
    val_scaled = pd.DataFrame(scaler.transform(pd.DataFrame(imputer.transform(val), columns=pl.FEATURES)),
                              columns=pl.FEATURES)
    shown = ["grid_position", "qualifying_time_seconds", "driver_points_before", "constructor_podium_rate_5"]
    axes = []
    for row in (0, 1):
        for j, feature in enumerate(shown):
            if row == 0:
                edges = np.histogram_bin_edges(imputed[feature], bins=40)
                median = float(imputer.statistics_[pl.FEATURES.index(feature)])
                title = f"{label(feature)}\\\\{train[feature].isna().mean():.0%} missing".replace("%", "\\%")
                body = (
                    f"\\nextgroupplot[title={{{title}}}, ymode=log, ymin=1, ymax=100000, "
                    "title style={align=center, font=\\tiny}"
                    + (", ylabel={rows (log)}" if j == 0 else "") + "]\n"
                    f"\\addplot[ybar interval, fill=modelB, draw=none] coordinates "
                    f"{{{_histogram(imputed[feature], edges)}}};\n"
                    f"\\addplot[ybar interval, fill=splitA, draw=none] coordinates "
                    f"{{{_histogram(train[feature].dropna(), edges)}}};\n"
                    f"\\addplot[black, dashed] coordinates {{({median:.6g},1) ({median:.6g},100000)}};\n"
                )
            else:
                both = np.r_[scaled[feature], val_scaled[feature]]
                edges = np.histogram_bin_edges(both, bins=40)
                body = (
                    "\\nextgroupplot[xlabel={standardized value}" + (", ylabel={density}" if j == 0 else "") + "]\n"
                    f"\\addplot[ybar interval, fill=modelC, fill opacity=0.6, draw=none] coordinates "
                    f"{{{_histogram(scaled[feature], edges, True)}}};\n"
                    f"\\addplot[ybar interval, fill=splitB, fill opacity=0.6, draw=none] coordinates "
                    f"{{{_histogram(val_scaled[feature], edges, True)}}};\n"
                )
            axes.append(body)
    key = ("{\\scriptsize Top row: \\textcolor{modelB}{\\rule{1.2ex}{1.2ex}} after median imputation, "
           "\\textcolor{splitA}{\\rule{1.2ex}{1.2ex}} observed values, dashed line = fill value. "
           "Bottom row: \\textcolor{modelC}{\\rule{1.2ex}{1.2ex}} training, "
           "\\textcolor{splitB}{\\rule{1.2ex}{1.2ex}} validation.\\par}\\smallskip\n")
    return key + (
        "\\begin{tikzpicture}\n\\begin{groupplot}[group style={group size=4 by 2, horizontal sep=1.1cm, "
        "vertical sep=1.5cm}, " f"width={0.215 * frac:.3f}\\linewidth, height=3.6cm, ymajorgrids, "
        "tick label style={font=\\tiny}]\n"
        + "".join(axes) + "\\end{groupplot}\n\\end{tikzpicture}"
    )


def fig_preprocessing_ranges(frac):
    """Raw range per feature (left) and range after scaling with the validation mean (right)."""
    e = pd.read_csv(ART / "preprocessing_effects.csv").sort_values("raw_std").reset_index(drop=True)
    n = len(e)
    common = (f"ytick={{{','.join(map(str, range(n)))}}}, yticklabels={labels(e.feature)}, y dir=reverse, "
              f"ymin=-0.7, ymax={n - 0.3}, height=7.6cm, scale only axis, yticklabel style={{font=\\tiny}}, "
              "xmajorgrids")
    raw = "\\addplot[xbar, fill=splitA, draw=none] coordinates {" + points(e.raw_max - e.raw_min, range(n)) + "};"
    lines = "\n".join(f"\\addplot[modelC, line width=2.2pt, forget plot] coordinates {{({r.scaled_min:.6g},{i}) ({r.scaled_max:.6g},{i})}};"
                      for i, r in e.iterrows())
    marks = f"\\addplot[only marks, mark=*, mark size=1.6pt, modelB] coordinates {{{points(e.validation_scaled_mean, range(n))}}};"
    return (
        "\\begin{tikzpicture}\n"
        f"\\begin{{axis}}[name=left, xbar, bar width=5pt, width={0.30 * frac:.3f}\\linewidth, xmode=log, "
        f"xmin=0.5, title={{Raw training range (max - min)}}, {common}]\n{raw}\n\\end{{axis}}\n"
        f"\\begin{{axis}}[at={{(left.east)}}, anchor=west, xshift=0.6cm, width={0.30 * frac:.3f}\\linewidth, "
        f"title={{Range after scaling}}, {common}, yticklabels=\\empty, legend pos=south east, "
        f"legend style={{font=\\tiny}}]\n{lines}\n{marks}\n\\legend{{validation mean}}\n"
        "\\end{axis}\n\\end{tikzpicture}"
    )


def fig_model_comparison(frac):
    """Test-set scores of the three models."""
    metrics = pd.read_csv(ART / "model_metrics.csv")
    names = ["ROC-AUC", "PR-AUC", "F1", "Precision", "Recall"]
    plots = []
    for model, color in MODEL_COLORS.items():
        row = metrics[(metrics.model == model) & (metrics.split == "test")].iloc[0]
        plots.append(f"\\addplot[ybar, fill={color}, draw=none] coordinates {{{points(range(5), [row[m] for m in names])}}};")
    return (
        "\\begin{tikzpicture}\n\\begin{axis}[ybar, bar width=11pt, " f"width={0.9 * frac:.3f}\\linewidth, height=6cm, "
        f"xtick={{0,1,2,3,4}}, xticklabels={labels(names)}, ymin=0, ymax=1.05, ylabel={{score}}, ymajorgrids, "
        "enlarge x limits=0.12, legend style={at={(0.5,-0.18)}, anchor=north, legend columns=3}]\n"
        + "\n".join(plots) + "\n\\legend{Logistic regression, Random forest, Shallow neural network}\n"
        "\\end{axis}\n\\end{tikzpicture}"
    )


def fig_ablation(frac):
    """Change in validation PR-AUC when one feature group is removed."""
    a = pd.read_csv(ART / "ablation_results.csv")
    # Fixed ticks with three decimals: the losses are a few thousandths, so two decimals repeat the same label.
    return hbar(frac, "Validation PR-AUC change", list(a.variant), list(a["PR-AUC_change"]),
                xlabel="Change in validation PR-AUC (logistic regression)", color="modelA", height=4.6,
                extra="xtick distance=0.005, scaled x ticks=false, "
                      "xticklabel style={/pgf/number format/fixed, /pgf/number format/precision=3}")


def fig_permutation(frac):
    """Largest permutation importances of the random forest."""
    d = pd.read_csv(FIG / "permutation_importance.csv").sort_values("importance", ascending=False).head(12)
    return hbar(frac, "Permutation importance", list(d.feature), list(d.importance),
                xlabel="Mean change in PR-AUC when shuffled", color="modelA", height=6.2)


def fig_shap_global(frac):
    """Largest mean absolute SHAP values of the random forest."""
    d = pd.read_csv(FIG / "shap_global.csv").sort_values("mean_abs_shap", ascending=False).head(12)
    return hbar(frac, "Global SHAP", list(d.feature), list(d.mean_abs_shap),
                xlabel="Mean absolute SHAP value", color="modelA", height=6.2)


def _signed(frac, path, column, title, xlabel):
    """Signed horizontal bars: teal pushes toward a podium, orange away."""
    d = pd.read_csv(path).head(12)
    colors = ["modelC" if v >= 0 else "modelB" for v in d[column]]
    return hbar(frac, title, list(d.feature), list(d[column]), xlabel=xlabel, colors=colors, height=6.2)


def fig_shap_local(frac):
    """Local SHAP for one validation row."""
    return _signed(frac, FIG / "shap_local.csv", "shap_value", "Local SHAP", "SHAP value (toward podium is positive)")


def fig_lime_local(frac):
    """Local LIME for one validation row."""
    return _signed(frac, FIG / "lime_local.csv", "lime_weight", "Local LIME", "LIME weight (toward podium is positive)")


def fig_logistic_weights(frac):
    """Standardized coefficients of the selected logistic model."""
    return _signed(frac, FIG / "logistic_weights.csv", "coefficient", "Selected logistic model",
                   "Coefficient per +1 training standard deviation")


def fig_logistic_local(frac):
    """Exact local log-odds decomposition of the selected logistic model."""
    return _signed(frac, FIG / "logistic_local.csv", "log_odds_contribution", "Selected model: one prediction",
                   "Contribution to log-odds (toward podium is positive)")


def fig_feature_eda(frac):
    """Seventeen small panels: podium rate by feature bin on the training seasons."""
    frame = pd.read_csv(ART / "modeling_table.csv", low_memory=False, parse_dates=["date"])
    panels = pl.feature_eda_panels(frame)
    axes = []
    for index, (feature, panel) in enumerate(panels.items()):
        heights, names = panel["heights"], panel["labels"]
        n = len(heights)
        main = n - 1 if panel["has_missing_bar"] else n
        title = f"{label(feature)}\\\\AUC {panel['auc']:.2f}, {panel['missing_share']:.0%} missing".replace("%", "\\%")
        plots = [f"\\addplot[ybar, bar shift=0pt, fill=splitA, draw=none] coordinates {{{points(range(main), heights[:main])}}};"]
        if panel["has_missing_bar"]:
            plots.append(f"\\addplot[ybar, bar shift=0pt, fill=modelB, draw=none] coordinates {{({n - 1},{heights[-1]:.6g})}};")
        axes.append(
            f"\\nextgroupplot[ybar, bar width=7pt, title={{{title}}}, title style={{align=center, font=\\tiny}}, xtick={{{','.join(map(str, range(n)))}}}, "
            f"xticklabels={labels(names)}, xticklabel style={{rotate=45, anchor=east, font=\\tiny}}, ymin=0, ymax=1, "
            f"ytick={{0,0.5,1}}, enlarge x limits=0.15" + (", ylabel={podium rate}" if index % 5 == 0 else "") + "]\n"
            + "\n".join(plots) + "\n"
        )
    return (
        "\\resizebox{\\linewidth}{!}{%\n\\begin{tikzpicture}\n\\begin{groupplot}[group style={group size=4 by 4, "
        "horizontal sep=0.8cm, vertical sep=1.3cm}, width=4.2cm, height=3.2cm, ymajorgrids, "
        "tick label style={font=\\tiny}, label style={font=\\tiny}]\n" + "".join(axes)
        + "\\end{groupplot}\n\\end{tikzpicture}}"
    )


FIGURES = {
    "cleaning_before_after": fig_cleaning,
    "qualifying_coverage": fig_coverage,
    "front_row_conversion": fig_front_row,
    "home_effect": fig_home,
    "home_effect_exact_grid": fig_home_exact,
    "raw_table_profile": fig_raw_profile,
    "mechanical_retirements": fig_mechanical,
    "chronological_split": fig_split,
    "preprocessing_distributions": fig_preprocessing_distributions,
    "preprocessing_ranges": fig_preprocessing_ranges,
    "model_comparison": fig_model_comparison,
    "ablation": fig_ablation,
    "permutation_importance": fig_permutation,
    "shap_global": fig_shap_global,
    "shap_local": fig_shap_local,
    "lime_local": fig_lime_local,
    "logistic_weights": fig_logistic_weights,
    "logistic_local": fig_logistic_local,
    "feature_eda": fig_feature_eda,
}


# ------------------------------------------------------------------- document
PREAMBLE = r"""\documentclass[10pt,a4paper]{article}

% ---- Paladin | ACL-903 Milestone 1 | generated by scripts/build_report_latex.py ----
% Compile with pdfLaTeX (the Overleaf default). Every chart is drawn with pgfplots, so
% this one file is all you need: no images or data files to upload.

\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{mathptmx}
\usepackage[a4paper,left=17mm,right=17mm,top=20mm,bottom=19mm,headheight=19pt]{geometry}
\usepackage{microtype}
\usepackage[table,dvipsnames]{xcolor}
\usepackage{booktabs,array,colortbl}
\usepackage[font=small,labelfont=bf,labelsep=period,skip=4pt]{caption}
\usepackage{float}
\usepackage[section]{placeins}
\usepackage{titlesec}
\usepackage{fancyhdr}
\usepackage[most]{tcolorbox}
\usepackage{pgfplots}
\usepgfplotslibrary{groupplots}
\pgfplotsset{compat=1.17}
\usepackage[colorlinks=true,linkcolor=navy,urlcolor=navy,pdftitle={ACL-903 Milestone 1: Formula 1 podium prediction},pdfauthor={Paladin}]{hyperref}

\definecolor{navy}{HTML}{1E3A5F}
\definecolor{muted}{HTML}{5C6B7A}
\definecolor{zebra}{HTML}{F4F7FB}
\definecolor{modelA}{HTML}{4C72B0}
\definecolor{modelB}{HTML}{DD8452}
\definecolor{modelC}{HTML}{55A868}
\definecolor{splitA}{HTML}{264653}
\definecolor{splitB}{HTML}{F4A261}
\definecolor{splitC}{HTML}{E76F51}

\pgfplotsset{every axis/.append style={font=\footnotesize, tick label style={font=\scriptsize},
  label style={font=\scriptsize}, title style={font=\footnotesize\bfseries}, legend style={font=\scriptsize, draw=none, fill=none},
  /pgf/number format/1000 sep={}, /pgf/number format/fixed, scaled ticks=false}}

\setlength{\parindent}{0pt}
\setlength{\parskip}{4.2pt plus 1pt}
\renewcommand{\arraystretch}{1.12}
\setlength{\tabcolsep}{3.5pt}
\setlength{\textfloatsep}{10pt plus 2pt minus 2pt}
\setlength{\floatsep}{8pt plus 2pt minus 2pt}
\setlength{\intextsep}{8pt plus 2pt minus 2pt}

\titleformat{\section}{\large\bfseries\color{navy}}{\thesection.}{0.55em}{}
\titleformat{\subsection}{\normalsize\bfseries\color{navy!85!black}}{\thesubsection}{0.55em}{}
\titlespacing*{\section}{0pt}{12pt plus 3pt}{4pt}
\titlespacing*{\subsection}{0pt}{9pt plus 2pt}{3pt}

\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0.5pt}
\renewcommand{\footrulewidth}{0.5pt}
\renewcommand{\headrule}{\hbox to\headwidth{\color{navy}\leaders\hrule height \headrulewidth\hfill}}
\renewcommand{\footrule}{\hbox to\headwidth{\color{navy}\leaders\hrule height \footrulewidth\hfill}}
\fancyhead[L]{\footnotesize\color{muted} ACL-903 Milestone 1}
\fancyhead[R]{\footnotesize\color{muted} Formula 1 podium prediction}
\fancyfoot[L]{\footnotesize\color{muted} Paladin}
\fancyfoot[R]{\footnotesize\color{muted} \thepage}

\newtcolorbox{takeaway}{enhanced, breakable, colback=zebra, colframe=navy, boxrule=0pt, leftrule=2.2pt,
  sharp corners, left=7pt, right=7pt, top=3pt, bottom=3pt, before skip=6pt, after skip=8pt}

\begin{document}
\sloppy
"""


class _Capture:
    """Stand-in for ReportLab's document: keep the story and let this script render it."""

    story: list = []

    def __init__(self, *args, **kwargs):
        pass

    def build(self, story, **kwargs):
        _Capture.story = story


def main():
    """Run the report script with LaTeX renderers swapped in, and write the .tex file."""
    br.P, br.h1, br.h2 = P, h1, h2
    br.add_table, br.add_figure, br.add_title_page = add_table, add_figure, add_title_page
    br.SimpleDocTemplate = _Capture
    with contextlib.redirect_stdout(io.StringIO()):
        br.main()
    blocks = [item.source for item in _Capture.story if isinstance(item, Raw)]
    document = PREAMBLE + "\n\n".join(blocks) + "\n\\end{document}\n"
    OUT.write_text(document, encoding="utf-8")
    nonascii = sorted({c for c in document if ord(c) > 127})
    print(f"Wrote {OUT} ({len(document):,} characters)")
    if nonascii:
        print("non-ASCII characters present (pdfLaTeX handles Latin letters):", "".join(nonascii))


if __name__ == "__main__":
    main()

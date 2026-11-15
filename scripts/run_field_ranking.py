"""Field-level podium model: a Plackett-Luce ranking experiment next to the coursework classifier.

The coursework model scores every driver on their own, so nothing stops it naming four podium finishers
or two. A podium is a *set of three* places in one race. This script fits the simplest model that respects
that: each driver gets one utility ``u = w . z`` from the same 16 pre-race inputs, and a race's top three
is drawn without replacement with probability proportional to ``exp(u)`` (a Plackett-Luce / conditional-logit
model, trained by maximising the likelihood of the real top three in order).

What this is, and is not
------------------------
* It is an *experimental successor*, reported beside the frozen logistic regression. It does not replace it
  and nothing in ``artifacts/`` that the freeze check reads is touched.
* Same 16 inputs, same imputer medians and scaler statistics (1950-2019). Two inputs, ``field_size`` and
  ``year``, are constant within a race, so they cancel out of a within-race softmax and cannot matter here.
  That is a property of the objective, not a mistake.
* Only the L2 strength is chosen, and it is chosen on 2020-2021 validation log-likelihood. 2022-2024 is scored
  once afterwards. As in the advanced research report, that period has been looked at during earlier product
  iterations, so it is a retrospective benchmark, not a pristine final hold-out.
* Needs only numpy, pandas and scipy. It does not import scikit-learn.

Run from the repository root::

    .venv\\Scripts\\python.exe scripts\\run_field_ranking.py
"""

from __future__ import annotations

import importlib.util
import itertools
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import minimize

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
OUT = ART / "field-ranking"
UI_DATA = ROOT / "ui" / "src" / "data"

_spec = importlib.util.spec_from_file_location("export_site_data", ROOT / "scripts" / "export_site_data.py")
export = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(export)  # type: ignore[union-attr]

FEATURES: list[str] = export.FEATURES
TRAIN_LAST_YEAR = 2019
VALIDATION_YEARS = (2020, 2021)
TEST_FIRST_YEAR = 2022
LAMBDAS = [0.0, 1e-4, 1e-3, 1e-2, 1e-1, 1.0]
BOOTSTRAP_DRAWS = 5000
BOOTSTRAP_SEED = 903
CONTRACT = "paladin.field-ranking.v1"

# --------------------------------------------------------------------------- the model


def _masked_softmax(u: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Per-race log-sum-exp and softmax over the drivers still in the draw."""
    shifted = np.where(mask, u, -np.inf)
    top = shifted.max(axis=1, keepdims=True)
    top = np.where(np.isfinite(top), top, 0.0)
    e = np.where(mask, np.exp(u - top), 0.0)
    total = e.sum(axis=1)
    return np.log(total) + top[:, 0], e / total[:, None]


def nll_and_gradient(w: np.ndarray, z: np.ndarray, mask: np.ndarray, top: np.ndarray, lam: float) -> tuple[float, np.ndarray]:
    """Mean negative log-likelihood of the real ordered top three, plus an L2 penalty, and its gradient."""
    u = z @ w
    races = np.arange(u.shape[0])
    remaining = mask.copy()
    nll = 0.0
    d_u = np.zeros_like(u)
    for place in range(3):
        lse, soft = _masked_softmax(u, remaining)
        winner = top[:, place]
        nll += float(np.sum(lse - u[races, winner]))
        d_u += soft
        d_u[races, winner] -= 1.0
        remaining = remaining.copy()
        remaining[races, winner] = False
    n = u.shape[0]
    grad = np.einsum("rn,rnp->p", d_u / n, z) + 2.0 * lam * w
    return nll / n + lam * float(w @ w), grad


def fit(z: np.ndarray, mask: np.ndarray, top: np.ndarray, lam: float) -> np.ndarray:
    result = minimize(
        nll_and_gradient,
        np.zeros(z.shape[2]),
        args=(z, mask, top, lam),
        jac=True,
        method="L-BFGS-B",
        options={"maxiter": 2000, "ftol": 1e-12, "gtol": 1e-9},
    )
    if not result.success and result.status != 2:  # 2 = abnormal line search at a flat optimum; fine here
        raise RuntimeError(f"Plackett-Luce fit did not converge: {result.message}")
    return result.x


def podium_distribution(u: np.ndarray) -> np.ndarray:
    """P(a first, b second, c third) for every ordered triple of one race: exact, no sampling."""
    n = len(u)
    if n < 3:
        raise ValueError("a podium needs at least three drivers")
    e = np.exp(u - u.max())
    total = e.sum()
    with np.errstate(divide="ignore", invalid="ignore"):
        pab = (e[:, None] / total) * e[None, :] / (total - e[:, None])
        pabc = pab[:, :, None] * e[None, None, :] / (total - e[:, None, None] - e[None, :, None])
    idx = np.arange(n)
    pabc[idx, idx, :] = 0.0
    pabc[idx, :, idx] = 0.0
    pabc[:, idx, idx] = 0.0
    return np.nan_to_num(pabc, nan=0.0, posinf=0.0, neginf=0.0)


def top3_marginals(pabc: np.ndarray) -> np.ndarray:
    """P(driver finishes in the top three) = first + second + third."""
    return pabc.sum(axis=(1, 2)) + pabc.sum(axis=(0, 2)) + pabc.sum(axis=(0, 1))


def set_probabilities(pabc: np.ndarray) -> dict[tuple[int, int, int], float]:
    """Probability of each unordered podium set (the six orderings of {a, b, c} added together)."""
    out = {}
    for a, b, c in itertools.combinations(range(pabc.shape[0]), 3):
        out[(a, b, c)] = float(sum(pabc[p] for p in itertools.permutations((a, b, c))))
    return out


# --------------------------------------------------------------------------- data


class Field:
    """Races as padded arrays: z[r, i, :] are the standardised inputs of driver i in race r."""

    def __init__(self, frame: pd.DataFrame, model, columns: list[int] | None = None):
        groups = [g for _, g in frame.groupby("raceId", sort=True)]
        width = max(len(g) for g in groups)
        p = len(FEATURES) if columns is None else len(columns)
        self.z = np.zeros((len(groups), width, p))
        self.mask = np.zeros((len(groups), width), dtype=bool)
        self.top = np.zeros((len(groups), 3), dtype=int)
        self.valid = np.ones(len(groups), dtype=bool)
        self.race_ids = np.array([int(g.raceId.iloc[0]) for g in groups])
        self.years = np.array([int(g.year.iloc[0]) for g in groups])
        self.names = [str(g["name"].iloc[0]) for g in groups]
        self.driver_ids = np.full((len(groups), width), -1, dtype=int)
        self.podium = np.zeros((len(groups), width), dtype=int)
        self.score = np.full((len(groups), width), np.nan)
        self.grid = np.full((len(groups), width), np.nan)
        for r, g in enumerate(groups):
            g = g.sort_values(["positionOrder", "driverId"]).reset_index(drop=True)
            x = model.standardize(g[FEATURES].to_numpy(float))
            if columns is not None:
                x = x[:, columns]
            n = len(g)
            self.z[r, :n] = x
            self.mask[r, :n] = True
            self.driver_ids[r, :n] = g.driverId.to_numpy(int)
            self.podium[r, :n] = g.podium.to_numpy(int)
            self.score[r, :n] = model.score(g[FEATURES].to_numpy(float))
            self.grid[r, :n] = g.grid_position.to_numpy(float)
            order = g.positionOrder.to_numpy(int)
            # Ties inside the top three (a shared drive in the early years) have no single ordered podium.
            if not (set(order[:3]) == {1, 2, 3} and len(set(order[:3])) == 3 and (n < 4 or order[3] > 3)):
                self.valid[r] = False
            self.top[r] = [0, 1, 2]  # rows are sorted by finishing order, so the podium is rows 0, 1, 2

    @property
    def n_races(self) -> int:
        return int(self.valid.sum())

    def trainable(self) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        keep = self.valid
        return self.z[keep], self.mask[keep], self.top[keep]


def utilities(field: Field, w: np.ndarray) -> np.ndarray:
    return field.z @ w


# --------------------------------------------------------------------------- evaluation


def mean_nll(u: np.ndarray, field: Field) -> float:
    keep = field.valid
    mask = field.mask[keep]
    top = field.top[keep]
    uu = u[keep]
    races = np.arange(uu.shape[0])
    remaining = mask.copy()
    total = 0.0
    for place in range(3):
        lse, _ = _masked_softmax(uu, remaining)
        total += float(np.sum(lse - uu[races, top[:, place]]))
        remaining = remaining.copy()
        remaining[races, top[:, place]] = False
    return total / uu.shape[0]


def uniform_nll(field: Field) -> float:
    n = field.mask[field.valid].sum(axis=1).astype(float)
    return float(np.mean(np.log(n) + np.log(n - 1) + np.log(n - 2)))


def race_hits(rank_score: np.ndarray, field: Field) -> np.ndarray:
    """Podium names in the three highest scores, per race. Ties break by driver id, as the site does."""
    hits = np.zeros(rank_score.shape[0], dtype=int)
    for r in range(rank_score.shape[0]):
        n = int(field.mask[r].sum())
        order = sorted(range(n), key=lambda i: (-rank_score[r, i], field.driver_ids[r, i]))[:3]
        hits[r] = int(sum(field.podium[r, i] for i in order))
    return hits


def grid_hits(field: Field) -> np.ndarray:
    hits = np.zeros(field.z.shape[0], dtype=int)
    for r in range(field.z.shape[0]):
        n = int(field.mask[r].sum())
        usable = [i for i in range(n) if not np.isnan(field.grid[r, i])]
        order = sorted(usable, key=lambda i: (field.grid[r, i], field.driver_ids[r, i]))[:3]
        hits[r] = int(sum(field.podium[r, i] for i in order))
    return hits


def paired_bootstrap(differences: np.ndarray, draws: int = BOOTSTRAP_DRAWS, seed: int = BOOTSTRAP_SEED) -> dict:
    rng = np.random.default_rng(seed)
    n = len(differences)
    means = differences[rng.integers(0, n, size=(draws, n))].mean(axis=1)
    lo, hi = np.percentile(means, [2.5, 97.5])
    return {"mean": float(differences.mean()), "lower": float(lo), "upper": float(hi), "draws": draws, "races": int(n)}


def reliability(prob: np.ndarray, y: np.ndarray, bins: int = 10) -> list[dict]:
    edges = np.linspace(0, 1, bins + 1)
    rows = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        pick = (prob >= lo) & ((prob < hi) if hi < 1 else (prob <= hi))
        rows.append({"lo": round(float(lo), 2), "hi": round(float(hi), 2), "n": int(pick.sum()),
                     "podiums": int(y[pick].sum()), "meanProbability": float(prob[pick].mean()) if pick.any() else None})
    return rows


def platt_fit(raw_logit: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    """Slope and intercept that turn a score's logit into a probability, fitted by minimum log-loss."""

    def loss(params: np.ndarray) -> tuple[float, np.ndarray]:
        a, b = params
        t = a * raw_logit + b
        # log(1 + e^t) - y t, written to stay finite for large |t|
        value = float(np.mean(np.logaddexp(0.0, t) - y * t))
        p = 1.0 / (1.0 + np.exp(-t))
        return value, np.array([np.mean((p - y) * raw_logit), np.mean(p - y)])

    return tuple(minimize(loss, np.array([1.0, 0.0]), jac=True, method="L-BFGS-B").x)  # type: ignore[return-value]


def apply_platt(raw_logit: np.ndarray, params: tuple[float, float]) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-(params[0] * raw_logit + params[1])))


# --------------------------------------------------------------------------- the experiment


def run() -> dict:
    table = pd.read_csv(ART / "modeling_table.csv", low_memory=False)
    model = export.SelectedModel(table)
    export_report = model.verify(table)  # the rebuilt logistic must still match the saved pipeline metrics

    train = Field(table[table.year <= TRAIN_LAST_YEAR], model)
    validation = Field(table[table.year.between(*VALIDATION_YEARS)], model)
    test = Field(table[table.year >= TEST_FIRST_YEAR], model)
    assert test.valid.all() and validation.valid.all(), "held-out seasons must have an unambiguous ordered podium"

    z, mask, top = train.trainable()
    search = []
    fitted = {}
    for lam in LAMBDAS:
        w = fit(z, mask, top, lam)
        fitted[lam] = w
        u_val = utilities(validation, w)
        search.append({
            "lambda": lam,
            "trainNLL": mean_nll(utilities(train, w), train),
            "validationNLL": mean_nll(u_val, validation),
            "validationHitsPerRace": float(race_hits(u_val, validation).mean()),
        })
    best = min(search, key=lambda row: row["validationNLL"])
    lam = best["lambda"]
    w = fitted[lam]

    # The one-input comparison: how much of the field model is just the starting grid?
    grid_col = [FEATURES.index("grid_position")]
    g_train, g_validation, g_test = (Field(f, model, grid_col) for f in (table[table.year <= TRAIN_LAST_YEAR], table[table.year.between(*VALIDATION_YEARS)], table[table.year >= TEST_FIRST_YEAR]))
    gz, gm, gt = g_train.trainable()
    grid_w = fit(gz, gm, gt, 0.0)

    logit = lambda f: np.where(f.mask, np.log(np.clip(f.score, 1e-12, 1 - 1e-12) / (1 - np.clip(f.score, 1e-12, 1 - 1e-12))), 0.0)  # noqa: E731

    u_test = utilities(test, w)
    hits = {"fieldModel": race_hits(u_test, test), "logistic": race_hits(test.score, test), "grid": grid_hits(test)}

    # Exact podium distributions on the held-out races.
    races = []
    marginal = np.full(test.score.shape, np.nan)
    p_set_actual = []
    p_order_actual = []
    exact_order = 0
    modal_set_matches = 0
    for r in range(test.z.shape[0]):
        n = int(test.mask[r].sum())
        pabc = podium_distribution(u_test[r, :n])
        m = top3_marginals(pabc)
        marginal[r, :n] = m
        sets = set_probabilities(pabc)
        ranked = sorted(sets.items(), key=lambda kv: -kv[1])
        modal_set, modal_p = ranked[0]
        modal_order = np.unravel_index(int(np.argmax(pabc)), pabc.shape)
        exact_order += int(tuple(modal_order) == (0, 1, 2))  # rows are in finishing order
        modal_set_matches += int(modal_set == (0, 1, 2))
        p_set_actual.append(sets[(0, 1, 2)])
        p_order_actual.append(float(pabc[0, 1, 2]))
        picks = [int(i) for i in np.argsort(-u_test[r, :n], kind="stable")[:3]]
        races.append({
            "id": int(test.race_ids[r]), "year": int(test.years[r]), "name": test.names[r],
            "hits": int(hits["fieldModel"][r]), "logisticHits": int(hits["logistic"][r]), "gridHits": int(hits["grid"][r]),
            "top3": [int(test.driver_ids[r, i]) for i in picks],
            "modalSet": [int(test.driver_ids[r, i]) for i in modal_set], "modalSetProbability": float(modal_p),
            "actualSetProbability": float(p_set_actual[-1]),
            "actualOrderProbability": float(p_order_actual[-1]),
        })

    y = test.podium[test.mask]
    flat_marginal = marginal[test.mask]
    flat_logistic = test.score[test.mask]
    to_logit = lambda p: np.log(np.clip(p, 1e-12, 1 - 1e-12) / (1 - np.clip(p, 1e-12, 1 - 1e-12)))  # noqa: E731
    platt = platt_fit(to_logit(validation.score[validation.mask]), validation.podium[validation.mask].astype(float))
    flat_logistic_calibrated = apply_platt(to_logit(flat_logistic), platt)
    race_diff = {
        "fieldModelMinusLogistic": paired_bootstrap((hits["fieldModel"] - hits["logistic"]).astype(float)),
        "fieldModelMinusGrid": paired_bootstrap((hits["fieldModel"] - hits["grid"]).astype(float)),
        "logisticMinusGrid": paired_bootstrap((hits["logistic"] - hits["grid"]).astype(float)),
    }

    summary = {
        "contract": CONTRACT,
        "status": "experimental",
        "officialCourseworkBaselineChanged": False,
        "evaluationStatus": "Retrospective benchmark. 2022-2024 was reviewed during earlier product iterations; only the L2 strength was chosen, on 2020-2021 validation log-likelihood.",
        "model": "Plackett-Luce top-three ranking (conditional logit), linear in the 16 pre-race inputs",
        "features": FEATURES,
        "raceConstantFeatures": ["field_size", "year"],
        "split": {"train": "1950-2019", "validation": "2020-2021", "test": "2022-2024"},
        "trainRaces": int(train.n_races), "trainRacesDroppedForTiedPodium": int((~train.valid).sum()),
        "validationRaces": int(validation.n_races), "testRaces": int(test.n_races),
        "selectedLambda": lam,
        "validationSearch": search,
        "nll": {
            "fieldModel": {"train": mean_nll(utilities(train, w), train), "validation": mean_nll(utilities(validation, w), validation), "test": mean_nll(u_test, test)},
            "gridOnly": {"train": mean_nll(utilities(g_train, grid_w), g_train), "validation": mean_nll(utilities(g_validation, grid_w), g_validation), "test": mean_nll(utilities(g_test, grid_w), g_test)},
            "logisticLogitAsUtility": {"train": mean_nll(logit(train), train), "validation": mean_nll(logit(validation), validation), "test": mean_nll(logit(test), test)},
            "uniform": {"train": uniform_nll(train), "validation": uniform_nll(validation), "test": uniform_nll(test)},
        },
        "test": {
            "meanHitsPerRace": {k: float(v.mean()) for k, v in hits.items()},
            "totalHits": {k: int(v.sum()) for k, v in hits.items()},
            "perfectPodiumSets": {k: int((v == 3).sum()) for k, v in hits.items()},
            "zeroHitRaces": {k: int((v == 0).sum()) for k, v in hits.items()},
            "fieldModelModalOrderMatchesActual": int(exact_order),
            "fieldModelModalSetMatchesActual": int(modal_set_matches),
            "meanActualSetProbability": float(np.mean(p_set_actual)),
            "meanActualOrderProbability": float(np.mean(p_order_actual)),
            "marginalPRAUC": {"fieldModel": export.average_precision(y, flat_marginal), "logistic": export.average_precision(y, flat_logistic)},
            "marginalROCAUC": {"fieldModel": export.roc_auc(y, flat_marginal), "logistic": export.roc_auc(y, flat_logistic)},
            "brier": {"fieldModelMarginal": float(np.mean((flat_marginal - y) ** 2)), "logisticScore": float(np.mean((flat_logistic - y) ** 2)),
                      "logisticRecalibratedOnValidation": float(np.mean((flat_logistic_calibrated - y) ** 2))},
            "brierNote": "The logistic was trained with class_weight=balanced, so its raw score is a ranking score, not a probability, and its raw Brier score is not comparable. The fair comparison recalibrates it with Platt scaling fitted on 2020-2021 only.",
            "plattScaling": {"slope": float(platt[0]), "intercept": float(platt[1]), "fittedOn": "2020-2021 validation"},
            "marginalPRAUCNote": "PR-AUC is rank-based, so recalibration does not change it.",
            "meanModalSetProbability": float(np.mean([r["modalSetProbability"] for r in races])),
            "meanMarginalSum": float(np.mean([marginal[r][test.mask[r]].sum() for r in range(test.z.shape[0])])),
            "reliability": {"fieldModelMarginal": reliability(flat_marginal, y), "logisticScore": reliability(flat_logistic, y), "logisticRecalibrated": reliability(flat_logistic_calibrated, y)},
            "pairedBootstrapHits": race_diff,
        },
        "bySeason": {
            str(year): {
                "races": int((test.years == year).sum()),
                **{k: float(v[test.years == year].mean()) for k, v in hits.items()},
            }
            for year in sorted(set(test.years.tolist()))
        },
        "logisticRebuildCheck": {k: v["maxAbsDifference"] for k, v in export_report.items() if "maxAbsDifference" in v},
        "weights": {feature: float(value) for feature, value in zip(FEATURES, w)},
    }
    return {"summary": summary, "races": races, "weights": w, "model": model, "test": test, "u_test": u_test, "marginal": marginal}


# --------------------------------------------------------------------------- output


def write(result: dict) -> None:
    summary, races, w, model, test, u_test, marginal = (result[k] for k in ("summary", "races", "weights", "model", "test", "u_test", "marginal"))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    pd.DataFrame(summary["validationSearch"]).to_csv(OUT / "validation_search.csv", index=False)
    pd.DataFrame(races).to_csv(OUT / "test_races.csv", index=False)
    pd.DataFrame({"feature": FEATURES, "weight": w}).to_csv(OUT / "weights.csv", index=False)
    rel = summary["test"]["reliability"]
    pd.DataFrame({"lo": [b["lo"] for b in rel["fieldModelMarginal"]], "hi": [b["hi"] for b in rel["fieldModelMarginal"]],
                  "fieldModelN": [b["n"] for b in rel["fieldModelMarginal"]], "fieldModelPodiums": [b["podiums"] for b in rel["fieldModelMarginal"]],
                  "logisticN": [b["n"] for b in rel["logisticScore"]], "logisticPodiums": [b["podiums"] for b in rel["logisticScore"]]}).to_csv(OUT / "test_reliability.csv", index=False)

    # What the browser needs: the weights, the same preprocessing the logistic model uses, and per-race results.
    rid = {int(r): i for i, r in enumerate(test.race_ids)}
    parity = []
    for race in races[:: max(1, len(races) // 4)][:4]:
        r = rid[race["id"]]
        n = int(test.mask[r].sum())
        parity.append({"raceId": race["id"], "drivers": [int(d) for d in test.driver_ids[r, :n]], "marginal": [round(float(v), 6) for v in marginal[r, :n]]})
    ui = {
        "contract": CONTRACT, "status": "experimental", "name": "Plackett-Luce field model", "features": FEATURES,
        "median": model.median.tolist(), "mean": model.mean.tolist(), "scale": model.scale.tolist(),
        "weights": [float(v) for v in w], "selectedLambda": summary["selectedLambda"],
        "evaluationStatus": summary["evaluationStatus"], "raceConstantFeatures": summary["raceConstantFeatures"],
        "nll": summary["nll"], "test": {key: summary["test"][key] for key in ("meanHitsPerRace", "totalHits", "perfectPodiumSets", "zeroHitRaces", "marginalPRAUC", "brier", "brierNote", "meanModalSetProbability", "fieldModelModalSetMatchesActual", "pairedBootstrapHits", "meanActualSetProbability", "fieldModelModalOrderMatchesActual")},
        "bySeason": summary["bySeason"],
        "races": [{"id": r["id"], "hits": r["hits"], "top3": r["top3"], "modalSet": r["modalSet"], "modalSetProbability": round(r["modalSetProbability"], 5), "actualSetProbability": round(r["actualSetProbability"], 6)} for r in races],
        "parity": parity,
    }
    (UI_DATA / "field-model.json").write_text(json.dumps(ui, separators=(",", ":")) + "\n", encoding="utf-8")


def main() -> None:
    result = run()
    write(result)
    s = result["summary"]
    t = s["test"]
    print(f"selected L2 strength {s['selectedLambda']} (validation NLL {min(r['validationNLL'] for r in s['validationSearch']):.4f})")
    print("mean top-3 names per race on 2022-2024:", {k: round(v, 3) for k, v in t["meanHitsPerRace"].items()})
    print("total hits:", t["totalHits"], "| perfect podium sets:", t["perfectPodiumSets"])
    print("test NLL:", {k: round(v["test"], 4) for k, v in s["nll"].items()})
    for name, interval in t["pairedBootstrapHits"].items():
        print(f"  {name}: {interval['mean']:+.3f} [{interval['lower']:+.3f}, {interval['upper']:+.3f}]")
    print("marginal PR-AUC:", {k: round(v, 4) for k, v in t["marginalPRAUC"].items()}, "| Brier:", {k: round(v, 4) for k, v in t["brier"].items()})
    print("modal podium set matched the real podium in", t["fieldModelModalSetMatchesActual"], "of", s["testRaces"], "races; mean stated probability of that set", round(t["meanModalSetProbability"], 3))
    print("weights:", {k: round(v, 3) for k, v in s["weights"].items()})


if __name__ == "__main__":
    main()

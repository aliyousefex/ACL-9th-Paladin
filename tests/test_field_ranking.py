"""Checks for the Plackett-Luce field model. Needs only numpy, pandas, scipy and pytest, never scikit-learn."""

from __future__ import annotations

import importlib.util
import itertools
import json
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]

spec = importlib.util.spec_from_file_location("run_field_ranking", ROOT / "scripts" / "run_field_ranking.py")
fr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fr)  # type: ignore[union-attr]


def simulate(true_w: np.ndarray, races: int = 600, drivers: int = 12, seed: int = 0):
    """Races whose real top three really were drawn from a Plackett-Luce model with weights `true_w`."""
    rng = np.random.default_rng(seed)
    z = rng.normal(size=(races, drivers, len(true_w)))
    gumbel = -np.log(-np.log(rng.uniform(size=(races, drivers))))
    order = np.argsort(-(z @ true_w + gumbel), axis=1)
    # Re-sort every race so rows 0, 1, 2 are the finishing order, which is what Field provides.
    z = np.take_along_axis(z, order[:, :, None], axis=1)
    return z, np.ones((races, drivers), dtype=bool), np.tile([0, 1, 2], (races, 1))


def test_gradient_matches_finite_differences():
    z, mask, top = simulate(np.array([1.0, -0.5, 0.25]), races=40, drivers=8, seed=1)
    mask[::3, -2:] = False  # ragged fields: some races have fewer drivers
    w = np.array([0.3, 0.1, -0.2])
    value, grad = fr.nll_and_gradient(w, z, mask, top, lam=0.05)
    for i in range(len(w)):
        step = np.zeros_like(w)
        step[i] = 1e-6
        up = fr.nll_and_gradient(w + step, z, mask, top, 0.05)[0]
        down = fr.nll_and_gradient(w - step, z, mask, top, 0.05)[0]
        assert grad[i] == pytest.approx((up - down) / 2e-6, rel=1e-5, abs=1e-8)
    assert value > 0


def test_equal_utilities_give_a_uniform_podium_distribution():
    n = 7
    pabc = fr.podium_distribution(np.zeros(n))
    expected = 1.0 / (n * (n - 1) * (n - 2))
    for a, b, c in itertools.permutations(range(n), 3):
        assert pabc[a, b, c] == pytest.approx(expected)
    assert pabc.sum() == pytest.approx(1.0)
    assert fr.top3_marginals(pabc) == pytest.approx(np.full(n, 3 / n))


def test_distribution_is_exact_and_respects_utility_order():
    u = np.array([2.0, 1.2, 0.3, 0.0, -1.0, -2.5, 0.7])
    pabc = fr.podium_distribution(u)
    assert pabc.sum() == pytest.approx(1.0)
    assert (pabc >= 0).all()
    for i in range(len(u)):
        assert pabc[i, i, :].sum() == 0 and pabc[i, :, i].sum() == 0 and pabc[:, i, i].sum() == 0
    marginals = fr.top3_marginals(pabc)
    assert marginals.sum() == pytest.approx(3.0), "exactly three podium places are shared among the field"
    assert list(np.argsort(-marginals)) == list(np.argsort(-u)), "a higher utility never lowers a driver's podium chance"
    sets = fr.set_probabilities(pabc)
    assert sum(sets.values()) == pytest.approx(1.0)
    # The first-place probability is the plain softmax.
    e = np.exp(u)
    assert pabc.sum(axis=(1, 2)) == pytest.approx(e / e.sum())


def test_a_three_car_race_always_has_all_three_on_the_podium():
    pabc = fr.podium_distribution(np.array([0.4, -0.2, 1.1]))
    assert fr.top3_marginals(pabc) == pytest.approx(np.ones(3))
    with pytest.raises(ValueError):
        fr.podium_distribution(np.array([0.0, 1.0]))


def test_fit_recovers_the_weights_that_generated_the_races():
    true_w = np.array([1.2, -0.8, 0.0])
    z, mask, top = simulate(true_w, races=3000, drivers=14, seed=7)
    w = fr.fit(z, mask, top, lam=0.0)
    assert w == pytest.approx(true_w, abs=0.12)
    _, grad = fr.nll_and_gradient(w, z, mask, top, 0.0)
    assert np.abs(grad).max() < 1e-5, "the fit stopped at a true optimum"


def test_inputs_that_are_constant_within_a_race_cannot_matter():
    z, mask, top = simulate(np.array([0.9, -0.4]), races=200, drivers=9, seed=3)
    constant = np.random.default_rng(5).normal(size=(200, 1, 1)) * np.ones((200, 9, 1))
    z3 = np.concatenate([z, constant], axis=2)
    w = np.array([0.5, 0.1, 2.0])
    _, grad = fr.nll_and_gradient(w, z3, mask, top, 0.0)
    assert grad[2] == pytest.approx(0.0, abs=1e-12), "a race-level constant cancels from a within-race softmax"
    shifted = fr.nll_and_gradient(np.array([0.5, 0.1, -7.0]), z3, mask, top, 0.0)[0]
    assert fr.nll_and_gradient(w, z3, mask, top, 0.0)[0] == pytest.approx(shifted)


def test_paired_bootstrap_is_seeded_and_brackets_the_mean():
    diff = np.array([0, 1, -1, 0, 0, 1, -1, 0, 1, 0], dtype=float)
    a = fr.paired_bootstrap(diff, draws=2000)
    b = fr.paired_bootstrap(diff, draws=2000)
    assert a == b
    assert a["lower"] <= a["mean"] <= a["upper"]
    assert fr.paired_bootstrap(np.ones(8), draws=500)["lower"] == 1.0


SUMMARY = ROOT / "artifacts" / "field-ranking" / "summary.json"


@pytest.mark.skipif(not SUMMARY.exists(), reason="run scripts/run_field_ranking.py first")
def test_saved_results_are_consistent_with_the_coursework_baseline():
    s = json.loads(SUMMARY.read_text(encoding="utf-8"))
    races = json.loads((ROOT / "ui" / "src" / "data" / "races.json").read_text(encoding="utf-8"))
    assert s["officialCourseworkBaselineChanged"] is False
    assert s["testRaces"] == len(races) == 68
    # The logistic and grid hit counts rebuilt here must equal what the site already ships.
    assert s["test"]["totalHits"]["logistic"] == sum(r["hits"] for r in races)
    assert s["test"]["totalHits"]["grid"] == sum(r["baselineHits"] for r in races)
    assert all(v < 1e-9 for v in s["logisticRebuildCheck"].values())
    assert s["selectedLambda"] in fr.LAMBDAS
    chosen = min(s["validationSearch"], key=lambda row: row["validationNLL"])
    assert chosen["lambda"] == s["selectedLambda"], "the penalty was chosen on validation, not on test"
    assert s["test"]["meanMarginalSum"] == pytest.approx(3.0, abs=1e-6)
    for feature in s["raceConstantFeatures"]:
        assert abs(s["weights"][feature]) < 1e-6, f"{feature} cannot matter within a race"
    assert s["nll"]["fieldModel"]["test"] < s["nll"]["uniform"]["test"]

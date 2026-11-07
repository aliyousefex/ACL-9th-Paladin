# 11. "Explanations must not be presented as causal effects": how the project handles it, and how to defend it

**Written for:** the teammate who owns EDA and the interpretation of results, preparing for the evaluation.

**Tags.** **[notebook]** = in the notebook; **[report]** = in `reports/milestone_1_analytical_report.tex` (built by `scripts/build_report.py`); **[my check]** = I computed or read it from `artifacts/` while preparing this guide.

---

## 1. The requirement and the sentence to say

The brief (Objective 6, XAI): *"Important: explanations must not be presented as causal effects. A feature being important to the model is not proof that it causes podium finishes – it only means the model relies on it to make predictions. (This distinction was a common point of confusion last year, so state it explicitly in your report.)"*

**The sentence to memorise:** "A feature's importance, weight, SHAP value or AUC tells you what the fitted model, or the past data, associates with podiums. It does not tell you what would happen to a driver's podium chance if we changed that feature."

**Project-specific example:** "Grid position is the strongest signal in every method. That does not show that moving a driver one slot forward would raise their podium chance by the model's amount, because the grid is itself a result of car and driver speed in qualifying."

---

## 2. Where the project states it (so you can quote it)

### Notebook
| Cell | What it says | Covers |
| --- | --- | --- |
| Code comment in `engineering_answers` (cell 30) | "Compare home and away drivers within broad grid bands. This does not make the result causal, but it avoids comparing front-row and back-row starts directly." | Q2 |
| Cell 49 | "an interval spanning 1 does not establish a home advantage or disadvantage. The result remains associational rather than causal." | Q2 |
| Cell 61 | "The AUCs describe association in past races and are not causal effects." | Feature EDA |
| Cell 96 | The change from the full model "measures the group's incremental predictive contribution after training" | Ablation |
| Cell 99 | "These values describe fitted-model reliance and are **not causal effects**." (also: LIME's R-squared is only about 0.20, so its weights are "weak, unstable local evidence") | Permutation importance, SHAP, LIME |
| Cell 102 | "These weights describe what the fitted model relies on and are **not causal effects**." | Logistic regression weights and local explanation |
| Cell 106 (Limitations) | "Permutation importance, SHAP, and LIME explain associations inside fitted models, not causes of podium finishes." | All XAI |

### Report (the brief says "state it explicitly in your report")
| Where | Wording |
| --- | --- |
| Q1-Q3 intro (line 291) | "We separate what the counts show from what we are willing to infer. None of the three answers is a causal claim." |
| Q1 (line 348) | "We cannot say that a circuit causes the conversion rate. The front row is already occupied by the fastest cars." |
| Q2 (lines 417, 420) | "The stratification is a control, not a causal model." / "This is an association, not a causal effect." |
| Feature evidence (line 765) | "The AUCs describe association in past races, not causes." |
| XAI section intro (line 1262) | "These are associations inside the fitted forest. They are not estimates of what would happen if we moved a driver up the grid." |
| Logistic coefficients (line 1303) | "The sign gives the fitted direction after all other columns are held fixed; it is not a causal effect." |
| Permutation importance (line 1383) | A negative value is read as "the forest not getting stable help from that column", "not ... evidence that the feature causes worse finishes". |
| XAI takeaway (line 1512) | "None of these values is a causal effect of starting further forward." |
| Dedicated section "What we do not want the results to be taken to say" (line 1538) | Ends: "The models are associating historical patterns. They do not tell a team what would happen if it started one place further forward." |

### Also
- **README:** "The explanations show model reliance, **not causal effects**" (line 309) and in the limitations list (line 563).
- **UI pages:** Findings ("None of the answers is a causal claim"), Classification ("They are not causal effects"), Cases ("neither list is a causal claim"), ModelPage (the sign of `year` "is not meaningful on its own").

So the requirement is met in the notebook **and** the report, in the explicit places the brief asks for.

---

## 3. What each analysis actually measures, and what it does not

| Analysis | What it measures | What it does NOT tell you |
| --- | --- | --- |
| **Feature EDA: one-feature AUC, binned podium rates** (cells 59-61) | How well one feature alone orders podium vs non-podium rows in 1950-2019 | That the feature causes podiums; it ignores the other 15 features |
| **Q1 front-row conversion** | The share of front-row starts that finish top three, by circuit and era | That a circuit, or the front row itself, causes the result (the front row is occupied by the fastest cars) |
| **Q2 home effect: bands, exact slots, Mantel-Haenszel OR 0.955 (0.825-1.110)** | A home/away difference in podium odds among drivers from the same grid slot | A causal home advantage: stratifying by grid slot controls for one confounder only; car quality, team and driver skill are unobserved |
| **Q3 mechanical retirement rates** | Component-failure statuses per start, by constructor and era | Why reliability changed; the report itself notes the lower 2022-24 totals are "also consistent with changes in how retirements were described" |
| **Feature-group ablation** (cells 94-96) | The drop in validation PR-AUC of **logistic regression** when a feature group is removed | That the group causes podiums; correlated groups share credit |
| **Context experiment (`round`, `year`)** (cells 62-64) | Validation PR-AUC with or without a column | That the calendar causes podiums |
| **Logistic-regression coefficients** (cells 100-102) | The change in log-odds of a podium per standard deviation of a feature, **holding the other 15 features fixed in this fitted model** | A real-world effect; correlated features split credit and can flip sign |
| **Permutation importance** (random forest) | The PR-AUC drop when one validation column is shuffled | A causal effect; a negative value just means the forest got no stable help from that column |
| **SHAP** (random forest) | How far each feature moves one prediction from the forest's background value | What would happen if the feature were changed in reality |
| **LIME** (hand-written, forest) | A weighted linear fit around one row; fidelity only 0.20 | Anything global; the report calls it "weak, unstable local evidence" |

**Which model does each tool explain?** Permutation importance, SHAP and LIME explain the **random forest**. The **selected** model, logistic regression, is explained directly through its own weights (cells 100-102). Do not present the forest's explanations as an account of the logistic model.

---

## 4. Your own results prove that "importance" is model-specific reliance, not causation

Same features, three methods, very different answers [my check on `artifacts/figures/logistic_weights.csv`, `permutation_importance.csv`, `shap_global.csv`, and `feature_eda.csv`]:

| Feature | LR weight (rank by size) | Permutation, forest (rank) | Mean abs SHAP, forest (rank) | One-feature AUC (EDA) |
| --- | --- | --- | --- | --- |
| `grid_position` | -1.443 (1) | 0.098 (1) | 0.140 (1) | 0.119 |
| `pit_lane_start` | -0.631 (**2**) | 0.000 (tied with two others, about rank 11-13) | 0.00005 (**16**) | 0.494 |
| `year` | -0.356 (**3**) | 0.000 (tied with two others, about rank 11-13) | 0.034 (6) | 0.505 |
| `constructor_podium_rate_5` | +0.291 (4) | 0.0216 (2) | 0.0653 (3) | 0.826 |
| `driver_podium_rate_5` | +0.218 (8) | 0.0095 (3) | 0.0695 (2) | 0.810 |
| `constructor_rank_before` | -0.238 (7) | -0.0011 (**15**) | 0.0410 (**4**) | 0.259 |
| `qualifying_position` | -0.164 (10) | -0.0021 (**16, last**) | 0.0200 (8) | 0.095 |
| `constructor_points_before` | **-0.147** (11) | +0.0088 (4) | 0.0069 (10) | **0.724** |
| `driver_age` | **-0.185** (9) | 0.0071 (5) | 0.0038 (14) | **0.552** |

What to say about it:
- **Rank flips.** `pit_lane_start` is the second-largest logistic weight but the smallest SHAP value; `constructor_rank_before` is 4th under SHAP and 15th under permutation. If importance were causal, these could not disagree this much.
- **Sign flips versus the EDA.** `constructor_points_before` has an AUC of 0.724 on its own (more points, more podiums) but a **negative** logistic weight (-0.147). `driver_age` has AUC 0.552 (older, more podiums) but weight -0.185. The cause is overlap: points overlap with constructor rank and constructor form (Spearman 0.86 between driver and constructor points, and -0.64 between constructor form and constructor rank, where rank 1 is best [my check]); age overlaps with experience (`driver_races_before`, +0.24). A negative weight does **not** mean "more constructor points make a podium less likely".
- **`year` is not a cause.** The logistic weight is -0.356, but cell 102 and the UI both say its sign is not meaningful on its own: the test seasons lie outside the training years, and `year` absorbs how the other features change meaning across eras.
- **Negative permutation importance** (`qualifying_position` -0.002, `constructor_rank_before` -0.001) means shuffling the column slightly *improved* the forest's score on that sample. The report explicitly refuses to read that as "the feature causes worse finishes".
- **Qualifying adds only +0.006 in the ablation** even though `qualifying_position` has the strongest single-feature AUC (0.095): it repeats the grid. That is redundancy, not irrelevance and not a causal statement.

---

## 5. The causal traps in the EDA and the three questions

| Result | The tempting causal reading | The correct reading |
| --- | --- | --- |
| Podium rate falls from 47% (grid bin 1) to 0.5% (last bin) | "Starting further back makes you lose" | Grid order reflects car and driver speed; it is an association, strongly predictive, mechanism not isolated |
| Front-row conversion rose from 56.1% to 76.0% after 2014 | "The hybrid era caused it" | Descriptive; dominant teams, reliability and rules all changed together |
| Suzuka 88.9% | "Suzuka rewards the pole sitter" | 18 front-row starts (about 9 races); descriptive, and "a circuit does not cause the conversion rate" |
| Home OR 0.955 (0.825-1.110) | "Home drivers have no advantage" | "No demonstrated home advantage": the CI contains 1 and is wide; unobserved confounders remain |
| Mechanical retirement 10.1% -> 6.1% | "Cars became more reliable" | Consistent with that, and also with changes in how retirements were coded |
| `qualifying_missing` AUC 0.49 | "Missing qualifying doesn't matter" | The flag marks imputed rows, not a podium pattern |
| Grid group costs 0.025 PR-AUC in ablation | "The grid causes podiums" | Removing it costs the **linear model** predictive accuracy on 39 validation races; it measures reliance |

---

## 6. Wording watch-list: phrases in our own text that could be read as causal, and a factual slip

These are **not errors in the requirement**: every one sits next to a disclaimer. They are the phrases an evaluator might quote against you, so know the safe reading.

| Where | Phrase | Safe reading / how to say it |
| --- | --- | --- |
| Report line 1563 | "Home nationality, inside a grid band, **does not produce** a consistent extra podium rate." | "is not associated with"; descriptive. Say "we find no consistent difference" |
| Cell 64 | `year` "lets the nonlinear models **adjust for the era**: larger fields, worse reliability, and missing qualifying in the older seasons" | A plausible **hypothesis** for why dropping `year` costs the forest and network; the notebook does not test those mechanisms |
| Cells 100-102 and report | "**pushes** toward/away from a podium" | SHAP/logistic vocabulary: a push **in the fitted model's prediction**, relative to a background or the training average |
| Cell 102 | "starting further back strongly **lowers** the predicted podium probability" | Fine: it says *predicted* probability, i.e. the model's output |
| Report line 1566 | The Hamilton example: a start in fifth place "**lifted him over the cutoff**" | A statement about the model's score for that row, not about why he finished third |
| Cell 49 / `home_effect` variable | "Home-country **effect**" | "Effect" here is a statistical difference between groups, not a causal effect; the same paragraph says associational |
| Section heading "Removing the grid hurts more than removing anything else" | "hurts" | Hurts **validation PR-AUC**, which the section text states |
| Cell 102 | `grid_position` is "about **five times larger** than any other weight" | Inaccurate: -1.44 is 2.3 times the next weight (`pit_lane_start`, -0.63) and 4.0 times the third (`year`, -0.36) [my check]. Say "the largest by a wide margin" |

### A factual slip I found while checking (not a causal one, but an evaluator may catch it)
The report says, in three places, that **permutation importance and SHAP both put constructor form second**: "constructor form second under both" (line 1512), "constructor form comes second" (line 1566), and "constructor podium rate second (0.065) ... Driver podium rate follows at 0.070" (line 1426). The report's own SHAP table contradicts this: **mean absolute SHAP is 0.0695 for `driver_podium_rate_5` and 0.0653 for `constructor_podium_rate_5`**, so under SHAP the *driver* form is second and constructor form third (a very small gap). Under permutation importance the constructor form is clearly second (0.0216 vs 0.0095). The same sentence is in `scripts/build_report.py` (lines 1999, 2085, 2223) and on the UI page `ui/src/sections/Classification.tsx` (line 159). The notebook itself does not make this claim. **Safe statement:** "Grid position is first under every method. Constructor form and driver form fill the next two places under both permutation and SHAP, in a different order." I did not edit the report; fixing it means editing `build_report.py` and regenerating, which is a team decision.

---

## 7. Likely questions and answers

**Q1. What does it mean that a feature is "important"?**
That the fitted model relies on it: removing it, shuffling it, or changing it changes the model's predictions or score. It says nothing about what would happen in the real world if the feature changed.

**Q2. Does grid position cause podium finishes?**
Our analysis cannot say. Grid position is the strongest predictor in every method, but it is itself shaped by car and driver speed (qualifying) and by penalties. The model uses it because it is informative, not because we showed it causes podiums.

**Q3. If a driver moved up one grid slot, how much would their podium probability change?**
We cannot answer that from these results. The coefficient (-1.44 per standard deviation) is a fitted-model association holding the other 15 columns fixed; the report says explicitly that these values are "not estimates of what would happen if we moved a driver up the grid".

**Q4. Your logistic model gives `constructor_points_before` a negative weight. Do constructor points hurt?**
No. On its own, constructor points have an AUC of 0.72 (more points, more podiums). The negative weight appears because the feature overlaps with constructor rank and constructor form, and the model splits the credit between correlated inputs. That is why we say weights are hard to read one at a time.

**Q5. Why do permutation importance, SHAP and the logistic weights disagree?**
They answer different questions about different models. Logistic weights are conditional linear coefficients; permutation importance measures a score drop when a column is shuffled in a forest; SHAP measures how far a feature moves predictions. Correlated features (grid with qualifying; points with rank and form; year with standings) share credit differently. Example: `pit_lane_start` is 2nd for logistic regression and 16th under SHAP.

**Q6. What does a negative permutation importance mean?**
Shuffling that column slightly improved PR-AUC on the 1,000-row validation sample (`qualifying_position` -0.002). It means the forest got no stable help from the column there, not that it causes worse finishes. The values are small and noisy.

**Q7. Is SHAP causal?**
No. SHAP attributes a model's prediction to its inputs relative to a background; it is a property of the model. The report says SHAP values are "associations inside the fitted forest".

**Q8. Why is LIME in the notebook if its R-squared is 0.20?**
The brief asks for at least one local explanation (LIME, local SHAP, or both). We implemented LIME ourselves and report its fidelity honestly: the coefficients are weak, unstable local evidence, so local SHAP and the exact logistic decomposition back it up.

**Q9. Is the ablation a causal test?**
No. It measures how much the **logistic regression's** validation PR-AUC falls when a feature group is removed, on 39 races; it is a measure of predictive contribution, and correlated groups share credit.

**Q10. Your home-effect odds ratio is 0.955. Is there no home advantage?**
We cannot demonstrate one. The 95% interval (0.825-1.110) contains 1 and is wide. Stratifying by grid slot removes one confounder; car quality, team and driver skill remain, so even a significant OR would be an association.

**Q11. Why not say the hybrid era caused higher front-row conversion?**
Because Q1 is descriptive. Conversion rose from 56% to 76%, but cars, reliability, teams and rules changed together, and the front row is occupied by the fastest cars.

**Q12. How is "association" different from "causation" in one example from your project?**
Starting grid and podium finish are strongly associated (pole position podiums about 64% of the time [my check]), but both are driven by how fast the car and driver are. Changing a driver's grid slot without changing their speed is exactly what our data cannot show.

**Q13. Where in your deliverables did you state this?**
In the notebook (cells 49, 61, 99, 102, 106) and in the report: an explicit sentence in the XAI section, in Q2, Q1 and the feature evidence, plus a dedicated section "What we do not want the results to be taken to say".

**Q14. What would it take to estimate a causal effect of grid position?**
A design that changes the grid independently of speed. One idea (not done here): grid penalties move drivers back after qualifying, so comparing drivers with the same qualifying position but different final grid slots could separate the effect of the slot from the effect of pace; it would need care because penalties correlate with car problems. We only claim prediction and association.

**Q15. Does the model "understand" why a podium happens?**
No. It uses patterns in 70 seasons of data. Its probabilities are for ranking and thresholded classification and are not formally calibrated (limitations, cell 106).

**Q16. Both logistic regression and the forest put grid first. Does agreement make it causal?**
No. Agreement across methods makes the reliance on grid robust, which is why we call it the reliable finding. It does not turn reliance into a cause.

**Q17. Someone says "year is important, so later seasons are worse for podiums".**
Wrong reading. The logistic `year` weight (-0.356) mainly absorbs how the other features change meaning over time, and the test seasons (2022-2024) lie outside the training years (1950-2019). The UI says its sign "is not meaningful on its own".

---

## 8. Revision checklist

- [ ] The one sentence: importance = model reliance, not cause (and the grid example).
- [ ] Which cells and report sections state it (cells 49, 61, 99, 102, 106; report XAI intro, Q2, Q1, features, "What we do not want the results to be taken to say").
- [ ] Which tool explains which model (permutation, SHAP, LIME = forest; coefficients = logistic regression).
- [ ] Two examples of rank or sign flips (`pit_lane_start`; `constructor_points_before`).
- [ ] Why the ablation, EDA AUCs and Q2's odds ratio are all associations.
- [ ] The wording watch-list, and the SHAP "constructor form second" slip.
- [ ] How you would pursue a causal question (penalties idea) without claiming it.

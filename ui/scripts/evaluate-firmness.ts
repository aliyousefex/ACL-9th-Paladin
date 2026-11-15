/**
 * Does the "how firm is this call?" label mean anything? For every held-out race, label each of the classifier's three
 * names, then count how often each label's names actually reached the podium.
 *
 * The thresholds and the nudge size live in src/lib/uncertainty.ts and were fixed before outcomes were looked at, so
 * this is an evaluation of the label, not a search for a flattering one. The result is written to
 * src/data/firmness.json; tests/firmness.test.ts recomputes it and fails if the file goes stale.
 *
 *   npm run evaluate:firmness
 */
import { readFileSync, writeFileSync } from "node:fs";
import { analyseField } from "../src/lib/fieldModel.ts";
import { logOdds } from "../src/lib/model.ts";
import { HIGH_STABILITY, LOW_STABILITY, NUDGE_DRAWS, NUDGE_SD, NUDGE_SEED, firmness, topThreeStability, type Firmness } from "../src/lib/uncertainty.ts";

interface Entry { d: number; x: (number | null)[]; pos: number | null }

export function evaluate(): {
  contract: string;
  thresholds: { high: number; low: number; nudgeSd: number; draws: number; seed: number };
  picks: number;
  podiums: number;
  byLabel: Record<string, { picks: number; podiums: number }>;
} {
  const races = JSON.parse(readFileSync(new URL("../src/data/races.json", import.meta.url), "utf8")) as { id: number }[];
  const byLabel: Record<string, { picks: number; podiums: number }> = {};
  let picks = 0;
  let podiums = 0;
  for (const race of races) {
    const entries = (JSON.parse(readFileSync(new URL(`../public/data/races/${race.id}.json`, import.meta.url), "utf8")) as { entries: Entry[] }).entries;
    const logits = entries.map((entry) => logOdds(entry.x));
    const stability = topThreeStability(logits, NUDGE_DRAWS, NUDGE_SEED + race.id);
    const order = logits.map((_, i) => i).sort((a, b) => logits[b] - logits[a] || entries[a].d - entries[b].d);
    const call = new Set(order.slice(0, 3));
    const fieldPicks = new Set(analyseField(entries.map((entry) => entry.x)).picks);
    for (const i of call) {
      const label: Firmness = firmness({ inCall: true, stability: stability[i], fieldAgrees: fieldPicks.has(i) });
      const row = (byLabel[label] ??= { picks: 0, podiums: 0 });
      const onPodium = entries[i].pos !== null && entries[i].pos <= 3;
      row.picks += 1;
      row.podiums += onPodium ? 1 : 0;
      picks += 1;
      podiums += onPodium ? 1 : 0;
    }
  }
  return { contract: "paladin.firmness-check.v1", thresholds: { high: HIGH_STABILITY, low: LOW_STABILITY, nudgeSd: NUDGE_SD, draws: NUDGE_DRAWS, seed: NUDGE_SEED }, picks, podiums, byLabel };
}

if (process.argv[1]?.endsWith("evaluate-firmness.ts")) {
  const result = evaluate();
  writeFileSync(new URL("../src/data/firmness.json", import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`picks ${result.picks}, on the podium ${result.podiums} (${((100 * result.podiums) / result.picks).toFixed(1)}%)`);
  for (const [label, row] of Object.entries(result.byLabel)) console.log(`  ${label.padEnd(16)} ${String(row.picks).padStart(4)} picks  ${String(row.podiums).padStart(4)} podiums  ${((100 * row.podiums) / row.picks).toFixed(1)}%`);
}

import site from "../data/site.json";
import { integer, num, pct } from "../lib/format";

const KNOWN = [
  "Grid position, including a pit-lane flag",
  "Qualifying order, time, and whether it is missing",
  "Podium rate over the previous five races",
  "Points and rank from the previous race",
  "Age, round, and year",
];

export function Decision() {
  const test = site.splits.find((row) => row.name === "Test");
  return (
    <section id="decision" className="scroll-mt-20 md:scroll-mt-8">
      <h1 className="max-w-[16ch] text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.03em] text-ink md:text-[3.1rem]">
        Will this driver finish in the top three?
      </h1>
      <p className="mt-5 max-w-[62ch] text-[1.08rem] leading-relaxed">
        We answer that only with what is known after qualifying and before the start.
        The race result is the label. It is not an input for the same row.
      </p>

      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_72px_1fr] md:gap-0">
        <div className="md:pr-6">
          <p className="font-mono text-[12px] text-steel">Known now</p>
          <ul className="mt-3 space-y-2">
            {KNOWN.map((item) => (
              <li key={item} className="font-mono text-[13px] leading-snug">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-stretch gap-3 md:flex-col md:items-center md:gap-0">
          <span className="font-mono text-[11px] text-signal md:[writing-mode:vertical-rl] md:rotate-180">
            lights out
          </span>
          <span className="h-px flex-1 bg-steel md:h-auto md:w-px md:flex-1" />
        </div>
        <div className="md:pl-6">
          <p className="font-mono text-[12px] text-steel">Struck from this row</p>
          <ul className="mt-3 space-y-2">
            {site.excluded.map((item) => (
              <li key={item} className="font-mono text-[13px] leading-snug text-quiet line-through decoration-signal">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10 max-w-[68ch] space-y-4 text-[1.02rem] leading-[1.55]">
        <p>
          The cleaned table has {integer(site.diagnostics.clean_rows)} driver-race rows, and{" "}
          {pct(site.podiumRate)} of them are podiums. A ranking that ignores the features would
          score a PR-AUC near {num(site.podiumRate)} on the full table{test
            ? `, and near ${num(test.podiumRate)} on the 2022-2024 seasons`
            : ""}. That is
          simply the share of positive rows. ROC-AUC asks something else: if we pick one driver
          who podiumed and one who did not, how often does the model rank the podium driver
          higher? A coin-flip ranking sits near 0.500. We treat PR-AUC as the main score.
        </p>
        <p className="text-quiet">
          F1, precision, and recall are reported at one cutoff, chosen only on 2020-2021.
          The test seasons are scored once.
        </p>
      </div>
    </section>
  );
}

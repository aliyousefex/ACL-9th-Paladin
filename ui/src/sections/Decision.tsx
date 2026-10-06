import site from "../data/site.json";
import { Term } from "../components/Section";
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
  const rows = site.diagnostics.clean_rows;

  return (
    <section id="decision" className="scroll-mt-24 md:scroll-mt-10">
      <div className="flex items-start justify-end">
        <p className="bg-signal px-2 py-1 text-[0.95rem] text-ink">Pre-race</p>
      </div>
      <h1 className="mt-4 max-w-[16ch] font-display text-[3.2rem] leading-[0.92] font-semibold tracking-[-0.03em] text-ink md:text-[4.6rem]">
        Will this driver finish in the top three?
      </h1>
      <p className="mt-4 max-w-[62ch] text-[1.15rem] leading-relaxed text-steel">
        We answer that only with what is known after qualifying and before the start.
        The race result is the label. It is not an input for the same row.
      </p>

      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_28px_1fr] md:gap-0">
        <div className="md:pr-8">
          <p className="text-[1.05rem] font-medium text-ink">Known now</p>
          <ul className="mt-4 space-y-3">
            {KNOWN.map((item) => (
              <li key={item} className="border-b border-line pb-3 text-[1.05rem] leading-snug">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-stretch gap-3 md:flex-col md:items-center md:gap-3">
          <span className="text-[0.85rem] text-steel md:[writing-mode:vertical-rl] md:rotate-180">
            Lights out
          </span>
          <span className="h-px flex-1 bg-signal md:h-auto md:w-px md:flex-1" />
        </div>
        <div className="md:pl-8">
          <p className="text-[1.05rem] font-medium text-ink">Struck from this row</p>
          <ul className="mt-4 space-y-3">
            {site.excluded.map((item) => (
              <li
                key={item}
                className="border-b border-line pb-3 text-[1.05rem] leading-snug text-steel line-through decoration-signal"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-4">
        <p>
          <span className="font-display text-[2.4rem] leading-none font-semibold tracking-[-0.03em]">
            {integer(rows)}
          </span>
          <span className="ml-3 text-steel">clean rows</span>
        </p>
        <p className="text-steel">{pct(site.podiumRate)} podiums</p>
      </div>

      <div className="mt-10 max-w-[68ch] space-y-4 text-[1.05rem] leading-[1.55]">
        <p>
          The cleaned table has {integer(site.diagnostics.clean_rows)} driver-race rows, and{" "}
          {pct(site.podiumRate)} of them are podiums. A ranking that ignores the features would
          score a <Term label="PR-AUC">Precision-recall area. It asks how well the model finds the rare podium rows. A model that ignores the features scores about the podium rate itself.</Term> near {num(site.podiumRate)} on the full table{test
            ? `, and near ${num(test.podiumRate)} on the 2022-2024 seasons`
            : ""}. That is
          simply the share of positive rows. <Term label="ROC-AUC">How often the model ranks a podium driver above a non-podium driver. A coin flip sits near 0.500. It can look strong even when the rare class is hard.</Term> asks something else: if we pick one driver
          who podiumed and one who did not, how often does the model rank the podium driver
          higher? A coin-flip ranking sits near 0.500. We treat PR-AUC as the main score.
        </p>
        <p className="text-steel">
          F1, precision, and recall are reported at one cutoff, chosen only on 2020-2021.
          The test seasons are scored once.
        </p>
      </div>
    </section>
  );
}

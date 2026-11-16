import { ProvenanceLegend, Tag, type Provenance } from "../../components/Provenance";
import { useTitle } from "../../lib/hooks";
import { href } from "../../lib/router";

/** The three steps of one prediction, each marked with the kind of information it is. */
const STEPS: { n: string; kind: Provenance; note: string; title: string; body: string }[] = [
  {
    n: "1",
    kind: "record",
    note: "What goes in",
    title: "Known after qualifying",
    body: "Grid slot, qualifying order, each driver's last five podium rates, championship points and rank before the race, age and year. Sixteen inputs, all fixed before the lights go out.",
  },
  {
    n: "2",
    kind: "model",
    note: "What the model does",
    title: "One model, one score each",
    body: "A logistic regression, selected on 2020–21, turns those inputs into a podium score for every driver. It never sees a lap, a pit stop or a result from the race it is scoring.",
  },
  {
    n: "3",
    kind: "record",
    note: "What really happened",
    title: "Then the race happens",
    body: "Only after the prediction do we reveal the classification, so the page can show how many of the model's three drivers really reached the podium.",
  },
];

/** What every marker on the site means, on a page of its own so the season overview can stay about the races. */
export function GuidePage() {
  useTitle("How to read this site", "What every marker on the site means: model output, historical record, experimental model, illustration, simulation and your own input.");
  return (
    <div className="page-in">
      <header className="border-b border-line pt-[calc(var(--nav-h)+2rem)] pb-10">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <h1 className="display text-[3rem] sm:text-[4.8rem]">Know what every value represents</h1>
          <p className="mt-4 max-w-[66ch] text-[1.1rem] leading-relaxed text-steel">
            Compact source markers separate a prediction from a recorded result, a synthetic simulation, explanatory motion, or a value you changed.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-4 pt-12 sm:px-6 lg:px-10">
        <section aria-labelledby="guide-path">
          <h2 id="guide-path" className="section-title">How one prediction is made</h2>
          <ol className="flow mt-8" aria-label="How one prediction is made">
            {STEPS.map((step) => (
              <li key={step.n} className="flow__step" data-kind={step.kind}>
                <span className="flow__node display" aria-hidden>{step.n}</span>
                <h3 className="display text-[1.6rem] leading-none">{step.title}</h3>
                <p className="mt-2 text-[0.98rem] leading-snug text-steel">{step.body}</p>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-mute">
                  <Tag kind={step.kind} />
                  <span>{step.note}</span>
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="guide-markers" className="mt-16 border-t border-line pt-12">
          <h2 id="guide-markers" className="section-title">The seven source markers</h2>
          <p className="mt-3 max-w-[60ch] text-[1.02rem] leading-relaxed text-steel">
            Every panel carries one of these, in words as well as colour.
          </p>
          <div className="mt-6">
            <ProvenanceLegend variant="cards" />
          </div>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <a className="btn btn-ghost" href={href("/model")}>Model card and limits</a>
          <a className="btn btn-ghost" href={href("/method")}>Method walkthrough</a>
        </div>
      </div>
    </div>
  );
}

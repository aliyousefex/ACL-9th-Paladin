import { RACES, raceHref } from "../../lib/data";
import { useStoredFlag } from "../../lib/hooks";
import { href } from "../../lib/router";

const STEPS = [
  { title: "Choose a Grand Prix", body: "Any of the 68 races from 2022 to 2024. The model never saw them while it was being trained." },
  { title: "Make your call", body: "Pick three drivers using only what was known after qualifying, then read Paladin's call and how firm it is." },
  { title: "Reveal and explain", body: "Open the result, then read what the model got right and wrong, and whether the starting grid would have done better." },
] as const;

/** Three plain steps for a first visit. Dismissing it is remembered in this browser; it never returns once closed. */
export function FirstVisit() {
  const [dismissed, setDismissed] = useStoredFlag("paladin:intro-dismissed", false);
  if (dismissed) return null;
  const latest = RACES[RACES.length - 1];
  return (
    <section aria-labelledby="first-visit-title" className="border border-line2 bg-tower">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
        <div>
          <p className="label !text-signal-text">New here?</p>
          <h2 id="first-visit-title" className="font-display text-[1.7rem] leading-none font-semibold">Paladin in three steps</h2>
        </div>
        <button type="button" className="btn btn-ghost !min-h-11 !px-3" onClick={() => setDismissed(true)}>
          Got it, hide this
        </button>
      </div>
      <ol className="grid grid-cols-1 divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4 px-4 py-5 sm:px-6">
            <span className="figure text-[2.2rem] text-signal-text" aria-hidden>{i + 1}</span>
            <div>
              <h3 className="font-display text-[1.25rem] leading-tight font-semibold uppercase">{step.title}</h3>
              <p className="mt-1.5 text-[0.98rem] leading-snug text-steel">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-4 sm:px-6">
        <a className="btn" href={href(raceHref(latest))} onClick={() => setDismissed(true)}>
          Start with {latest.name.replace(" Grand Prix", "")} {latest.year}
        </a>
        <p className="text-[0.9rem] text-mute">
          Press <kbd className="border border-line2 px-1.5 py-0.5 font-display text-[0.8rem]">/</kbd> at any time to search for a race, driver or circuit.
        </p>
      </div>
    </section>
  );
}

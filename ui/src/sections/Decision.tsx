import { useRef, useState, type KeyboardEvent } from "react";
import { CARS, CarFrame } from "../components/CarFrame";
import { StartLights } from "../components/StartLights";
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
    <section id="decision" className="scroll-mt-28 md:scroll-mt-24">
      <div className="flex items-center justify-end gap-3">
        <StartLights lit={5} pace className="h-7 w-2.5" />
        <p className="bg-signal px-2 py-1 text-[0.95rem] text-ink">Pre-race</p>
      </div>
      <h1 className="mt-4 max-w-[16ch] font-display text-[3.2rem] leading-[0.92] font-semibold tracking-[-0.03em] text-ink md:text-[4.6rem]">
        Will this driver finish in the top three?
      </h1>
      <p className="mt-4 max-w-[62ch] text-[1.15rem] leading-relaxed text-steel">
        We answer that only with what is known after qualifying and before the start.
        The race result is the label. It is not an input for the same row.
      </p>

      <RaceGallery />

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

      <div className="mt-10 grid gap-8 border-t border-line pt-6 sm:grid-cols-2">
        <p>
          <span className="figure block text-[4.4rem]">{integer(rows)}</span>
          <span className="mt-3 block text-[1.05rem] text-steel">clean rows</span>
        </p>
        <p>
          <span className="figure block text-[4.4rem]">{pct(site.podiumRate)}</span>
          <span className="mt-3 block text-[1.05rem] text-steel">podiums</span>
        </p>
      </div>

      <div className="mt-10 max-w-[68ch] space-y-4 text-[1.05rem] leading-[1.55]">
        <p>
          The cleaned table has {integer(site.diagnostics.clean_rows)} driver-race rows, and{" "}
          {pct(site.podiumRate)} of them are podiums. A ranking that ignores the features would
          score a <Term label="PR-AUC">Precision-recall area. It asks how well the model finds the rare podium rows. A model that ignores the features scores about the podium rate itself.</Term> near {num(site.podiumRate)} on the full table{test ? `, and near ${num(test.podiumRate)} on the 2022-2024 seasons` : ""}. That is
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

const HERO_CARS = [CARS.mercedes, CARS.ferrari, CARS.redbull, CARS.aston, CARS.mclaren, CARS.williams];

function RaceGallery() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<HTMLDivElement>(null);
  const photo = HERO_CARS[selected];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const last = HERO_CARS.length - 1;
    const next = event.key === "Home" ? 0 : event.key === "End" ? last :
      event.key === "ArrowRight" || event.key === "ArrowDown" ? (selected + 1) % HERO_CARS.length :
      (selected - 1 + HERO_CARS.length) % HERO_CARS.length;
    setSelected(next);
    tabs.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  };

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_13rem] md:items-stretch">
      <div id="featured-car-panel" role="tabpanel" aria-labelledby={`featured-car-${selected}`} className="overflow-hidden bg-tower">
        <CarFrame photo={photo} eager />
      </div>
      <div ref={tabs} onKeyDown={onKeyDown} className="grid grid-cols-3 gap-px bg-line md:grid-cols-1" role="tablist" aria-label="Featured Formula One cars">
        {HERO_CARS.map((car, index) => {
          const active = index === selected;
          return (
            <button
              key={car.team}
              type="button"
              role="tab"
              id={`featured-car-${index}`}
              aria-selected={active}
              aria-controls="featured-car-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => setSelected(index)}
              className={`group flex min-h-14 items-center justify-between gap-2 bg-paper px-3 py-2 text-left font-display text-[0.92rem] tracking-[0.04em] uppercase transition-colors ${active ? "text-ink" : "text-steel hover:text-ink"}`}
            >
              <span>{car.team}</span>
              <span className={`h-2 w-2 shrink-0 ${active ? "bg-signal" : "bg-line group-hover:bg-steel"}`} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}

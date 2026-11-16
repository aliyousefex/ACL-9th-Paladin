import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Note } from "../../components/Bits";
import { Icon } from "../../components/Icon";
import { Panel } from "../../components/Panel";
import { DRIVERS, RACES, driver, raceHref, type RaceMeta } from "../../lib/data";
import { entriesByRace, pairedBootstrap, summarize, verdictAgainstGrid, worstFirst, type FalseAlarmKind, type MissKind, type Summary } from "../../lib/atlas";
import { FIELD_META, fieldRaceResult } from "../../lib/fieldModel";
import { useTitle } from "../../lib/hooks";
import { href } from "../../lib/router";
import { RaceBrief } from "./RaceBrief";

type Filter = "all" | "shared failure" | "lost to grid" | "beat grid" | "perfect";

const FILTERS: { id: Filter; label: string; test: (race: RaceMeta) => boolean }[] = [
  { id: "all", label: "All 68", test: () => true },
  { id: "shared failure", label: "Both struggled", test: (race) => race.hits <= 1 && race.baselineHits <= 1 },
  { id: "lost to grid", label: "Grid did better", test: (race) => race.hits < race.baselineHits },
  { id: "beat grid", label: "Paladin did better", test: (race) => race.hits > race.baselineHits },
  { id: "perfect", label: "Paladin 3 of 3", test: (race) => race.hits === 3 },
];

const FALSE_ALARM_COPY: Record<FalseAlarmKind, string> = {
  "in-race event": "Did not take the flag",
  "close call": "Finished 4th or 5th",
  faded: "Finished 6th to 10th",
  "outside the points": "Finished 11th or lower",
};

const MISS_COPY: Record<MissKind, string> = {
  "close call": "Ranked 4th or 5th by the model",
  "visible on the grid": "Started in the top six, ranked lower",
  "against the inputs": "Started 7th or lower, ranked lower",
};

const signedFixed = (value: number, digits = 2) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;

export function ErrorAtlasPage() {
  useTitle("Error Atlas", "Where Paladin and the starting grid hit and miss across all 68 held-out Grands Prix, race by race.");
  const { summary, interval } = useMemo(() => {
    const entries = entriesByRace(RACES, DRIVERS);
    return { summary: summarize(RACES, entries), interval: pairedBootstrap(RACES.map((race) => race.hits - race.baselineHits)) };
  }, []);
  const verdict = verdictAgainstGrid(interval);
  const perRace = (total: number) => (total / summary.races).toFixed(2);

  return (
    <div className="page-in">
      <header className="border-b border-line pt-[calc(var(--nav-h)+2rem)] pb-10">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end lg:px-10">
          <div>
            <h1 className="display text-[2.8rem] sm:text-[4.4rem]">
              Paladin {verdict === "is level with the grid" ? "is level with the starting grid" : verdict} on podium names.
            </h1>
            <p className="mt-5 max-w-[64ch] text-[1.1rem] leading-relaxed text-steel">
              Across the {summary.races} held-out races of 2022 to 2024, Paladin's top three held {summary.modelHits} podium finishers and the first three grid slots held {summary.gridHits}. The average difference is{" "}
              {signedFixed(interval.mean)} names per race, with a 95% interval of {signedFixed(interval.lower)} to {signedFixed(interval.upper)}
              {verdict === "is level with the grid" ? ", so these seasons cannot separate them" : ""}. What does differ is <em className="not-italic text-ink">which</em> names each one gets right, and that is what this page lays out.
            </p>
          </div>
          <dl className="grid grid-cols-2 border border-line2 bg-tower">
            <Figure label="Paladin, podium names per race" value={perRace(summary.modelHits)} />
            <Figure label="Grid top three, names per race" value={perRace(summary.gridHits)} border />
            <Figure label="Races both got 0 or 1 of 3" value={String(summary.sharedFailures)} top />
            <Figure label="Paladin 3 of 3" value={String(summary.perfect)} top border />
          </dl>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] space-y-6 px-4 pt-8 sm:px-6 lg:px-10">
        <GainsAndLosses summary={summary} />
        <HowPicksFail summary={summary} />
        <ThirdSystem summary={summary} />
        <Seasons summary={summary} />
        <Ledger />
      </div>
    </div>
  );
}

function Figure({ label, value, top = false, border = false }: { label: string; value: string; top?: boolean; border?: boolean }) {
  return (
    <div className={`px-5 py-6 ${top ? "border-t border-line" : ""} ${border ? "border-l border-line" : ""}`}>
      <dd className="figure text-[3rem] sm:text-[3.6rem]">{value}</dd>
      <dt className="mt-2 text-[0.9rem] leading-snug text-mute">{label}</dt>
    </div>
  );
}

/* ------------------------------------------------------------------ where each system gets its names */

function GainsAndLosses({ summary }: { summary: Summary }) {
  const gained = summary.bands.filter((row) => row.band !== "P1-3").reduce((sum, row) => sum + row.modelCaught - row.gridCaught, 0);
  const front = summary.bands.find((row) => row.band === "P1-3")!;
  const lost = front.gridCaught - front.modelCaught;
  return (
    <Panel context="Podium finishers, grouped by where they started" title="Where Paladin gains on the grid and where it gives names back" tag={["model", "record"]}>
      <p className="max-w-[72ch] text-steel">
        The grid baseline can only ever name drivers who started in the top three. Paladin can name anyone. Over {summary.races} races it names {gained} podium finishers the grid could not, and leaves out {lost} front-three starters the grid kept, which is why the two totals end up so close.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">Podium finishers by starting band, and how many each system named</caption>
          <thead>
            <tr className="border-b border-line2 text-[0.82rem] text-mute">
              <th scope="col" className="py-2 pr-4 font-semibold">Started</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Podium finishers</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Paladin named</th>
              <th scope="col" className="py-2 font-semibold">Grid top three named</th>
            </tr>
          </thead>
          <tbody>
            {summary.bands.map((row) => (
              <tr key={row.band} className="border-b border-line align-middle">
                <th scope="row" className="py-4 pr-4 font-display text-[1.25rem] font-semibold">{row.band}</th>
                <td className="py-4 pr-4 text-right figure text-[1.4rem]">{row.podium}</td>
                <td className="py-4 pr-4"><Bar value={row.modelCaught} of={row.podium} tone="model" /></td>
                <td className="py-4"><Bar value={row.gridCaught} of={row.podium} tone="grid" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5">
        <Note>
          A podium finisher counts once, in the band of their starting slot. The grid baseline names a driver from a lower band only when a penalty reshuffled the first three slots.
        </Note>
      </div>
    </Panel>
  );
}

function Bar({ value, of, tone }: { value: number; of: number; tone: "model" | "grid" }) {
  const width = of ? (value / of) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 min-w-24 flex-1 bg-line" aria-hidden>
        <div className="h-full" style={{ width: `${width}%`, background: tone === "model" ? "var(--color-signal)" : "var(--color-steel)" }} />
      </div>
      <span className="figure w-20 shrink-0 text-right text-[1.05rem]">
        {value} <span className="text-mute">/ {of}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ how picks go wrong */

function HowPicksFail({ summary }: { summary: Summary }) {
  return (
    <Panel context="Every wrong pick and every missed podium finisher, sorted by what the record shows" title="How the model's errors break down" tag="record">
      <div className="grid gap-10 lg:grid-cols-2">
        <Breakdown
          heading={`${summary.falseAlarms.total} picks that missed the podium`}
          note="Paladin's top three who finished off the podium."
          rows={(Object.keys(FALSE_ALARM_COPY) as FalseAlarmKind[]).map((kind) => ({ label: FALSE_ALARM_COPY[kind], value: summary.falseAlarms[kind] }))}
          total={summary.falseAlarms.total}
        />
        <Breakdown
          heading={`${summary.misses.total} podium finishers left out`}
          note="Podium finishers outside Paladin's top three."
          rows={(Object.keys(MISS_COPY) as MissKind[]).map((kind) => ({ label: MISS_COPY[kind], value: summary.misses[kind] }))}
          total={summary.misses.total}
        />
      </div>
      <div className="mt-6">
        <Note>
          These groups describe the record: where a driver finished, started and was ranked. A retirement is an event during the race that none of the model's inputs measures. The groups do not claim a cause for any result.
        </Note>
      </div>
    </Panel>
  );
}

function Breakdown({ heading, note, rows, total }: { heading: string; note: string; rows: { label: string; value: number }[]; total: number }) {
  return (
    <div>
      <h3 className="font-display text-[1.5rem] leading-tight font-semibold">{heading}</h3>
      <p className="mt-1 text-[0.92rem] text-mute">{note}</p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-4 text-[0.98rem]">
              <span className="text-steel">{row.label}</span>
              <span className="figure text-[1.15rem]">
                {row.value} <span className="text-mute">· {total ? Math.round((row.value / total) * 100) : 0}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 bg-line" aria-hidden>
              <div className="h-full bg-steel" style={{ width: `${total ? (row.value / total) * 100 : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ the field model, as a third system */

const signedHits = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}`;

function ThirdSystem({ summary }: { summary: Summary }) {
  const t = FIELD_META.test;
  const nll = FIELD_META.nll;
  const rows = [
    { name: "Starting grid, top three", hits: t.totalHits.grid, perfect: t.perfectPodiumSets.grid, zero: t.zeroHitRaces.grid, loss: nll.gridOnly.test, note: "Grid slot alone, as a ranking model" },
    { name: "Classifier (the coursework model)", hits: t.totalHits.logistic, perfect: t.perfectPodiumSets.logistic, zero: t.zeroHitRaces.logistic, loss: nll.logisticLogitAsUtility.test, note: "Its scores, used as a ranking model" },
    { name: "Field model (experimental)", hits: t.totalHits.fieldModel, perfect: t.perfectPodiumSets.fieldModel, zero: t.zeroHitRaces.fieldModel, loss: nll.fieldModel.test, note: "Fitted to rank whole podiums" },
  ];
  const vsClassifier = t.pairedBootstrapHits.fieldModelMinusLogistic;
  const vsGrid = t.pairedBootstrapHits.fieldModelMinusGrid;
  return (
    <Panel context="A model that ranks the whole field at once, set beside the other two" title="A third system: the field model" tag={["experimental", "record"]}>
      <p className="max-w-[72ch] text-steel">
        Naming podium finishers is a ranking problem inside each race, and the classifier scores drivers one at a time. The field model keeps the same 16 inputs and changes only the objective. Here is what that bought on the {summary.races} held-out races.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <caption className="sr-only">Three systems compared on the held-out races</caption>
          <thead>
            <tr className="border-b border-line2 text-[0.82rem] text-mute">
              <th scope="col" className="py-2 pr-4 font-semibold">System</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Names per race</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">3 of 3</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">0 of 3</th>
              <th scope="col" className="py-2 text-right font-semibold">Log-loss of the real podium</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-line align-top">
                <th scope="row" className="py-3 pr-4">
                  <span className="block font-display text-[1.15rem] font-semibold">{row.name}</span>
                  <span className="block text-[0.82rem] font-normal text-mute">{row.note}</span>
                </th>
                <td className="py-3 pr-4 text-right figure text-[1.15rem]">{(row.hits / summary.races).toFixed(2)}</td>
                <td className="py-3 pr-4 text-right figure text-[1.15rem]">{row.perfect}</td>
                <td className="py-3 pr-4 text-right figure text-[1.15rem]">{row.zero}</td>
                <td className="py-3 text-right figure text-[1.15rem]">{row.loss.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 space-y-2">
        <Note>
          Names per race: the field model differs from the classifier by {signedHits(vsClassifier.mean)} (95% interval {signedHits(vsClassifier.lower)} to {signedHits(vsClassifier.upper)}) and from the grid by {signedHits(vsGrid.mean)} ({signedHits(vsGrid.lower)} to {signedHits(vsGrid.upper)}). Each interval contains zero, so none of the three is shown to name more podium finishers than another.
        </Note>
        <Note>
          Log-loss is how surprised each system was by the real podium; lower is better, and {nll.uniform.test.toFixed(2)} is what guessing would score. The grid alone is far behind ({nll.gridOnly.test.toFixed(2)}); the classifier and the field model are close ({nll.logisticLogitAsUtility.test.toFixed(2)} and {nll.fieldModel.test.toFixed(2)}). The grid and the classifier are scored by turning them into the same kind of ranking model, so the three numbers can be compared.
        </Note>
        <Note kind="warn">{FIELD_META.evaluationStatus}</Note>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ by season */

function Seasons({ summary }: { summary: Summary }) {
  return (
    <Panel context="Podium names per race, by season" title="Season by season" tag="record">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left">
          <caption className="sr-only">Paladin and the grid baseline, by season</caption>
          <thead>
            <tr className="border-b border-line2 text-[0.82rem] text-mute">
              <th scope="col" className="py-2 pr-4 font-semibold">Season</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Races</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Paladin per race</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Grid per race</th>
              <th scope="col" className="py-2 pr-4 text-right font-semibold">Paladin 3 of 3</th>
              <th scope="col" className="py-2 text-right font-semibold">Paladin 0 of 3</th>
            </tr>
          </thead>
          <tbody>
            {summary.seasons.map((season) => (
              <tr key={season.year} className="border-b border-line">
                <th scope="row" className="py-3 pr-4 font-display text-[1.25rem] font-semibold">{season.year}</th>
                <td className="py-3 pr-4 text-right figure text-[1.1rem]">{season.races}</td>
                <td className="py-3 pr-4 text-right figure text-[1.1rem]">{(season.modelHits / season.races).toFixed(2)}</td>
                <td className="py-3 pr-4 text-right figure text-[1.1rem]">{(season.gridHits / season.races).toFixed(2)}</td>
                <td className="py-3 pr-4 text-right figure text-[1.1rem]">{season.perfect}</td>
                <td className="py-3 text-right figure text-[1.1rem]">{season.zero}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5">
        <Note>With 22 to 24 races a season, one race moves a season's average by about 0.04, so a gap of a few hundredths between a season's two columns is noise.</Note>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ the ledger */

/** The ledger shows this many races at a time, worst first; the page stays short and the rest is one press away. */
const PAGE = 15;

function Ledger() {
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const ordered = useMemo(() => worstFirst(RACES), []);
  const test = FILTERS.find((option) => option.id === filter)!.test;
  const needle = query.trim().toLowerCase();
  const shown = ordered.filter((race) => test(race) && (!needle || `${race.name} ${race.year}`.toLowerCase().includes(needle)));
  // A new filter or search starts again from the worst races.
  useEffect(() => setLimit(PAGE), [filter, needle]);
  const visible = shown.slice(0, limit);

  return (
    <section aria-labelledby="ledger-title" className="scroll-mt-32 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
        <div>
          <h2 id="ledger-title" className="display text-[2.2rem] sm:text-[3rem]">All {RACES.length} races, worst first</h2>
          <p className="mt-2 max-w-[62ch] text-mute">Results are shown here on purpose: this is a post-race audit. Open any race for the five-question breakdown.</p>
        </div>
        <label className="relative">
          <span className="sr-only">Search races</span>
          <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-mute" />
          <input
            type="search"
            value={query}
            placeholder="Search a race or year"
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11 w-60 border border-control bg-panel pr-3 pl-9 text-[1rem] text-ink placeholder:text-mute focus:border-ink focus:outline-none"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter races">
        {FILTERS.map((option) => (
          <button key={option.id} type="button" className="chip" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>
            {option.label}
          </button>
        ))}
        <p className="ml-auto text-[0.9rem] text-mute" aria-live="polite">Showing {visible.length} of {shown.length}{shown.length < RACES.length ? ` matching (${RACES.length} races in all)` : ""}</p>
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 text-steel">No race matches. Clear the search or pick another filter.</p>
      ) : (
        <ol className="mt-2 border-t border-line">
          {visible.map((race) => (
            <LedgerRow key={race.id} race={race} open={open === race.id} onToggle={() => setOpen(open === race.id ? null : race.id)} />
          ))}
        </ol>
      )}
      {shown.length > limit && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-ghost !min-h-11" onClick={() => setLimit((value) => value + PAGE)}>
            Show {Math.min(PAGE, shown.length - limit)} more
          </button>
          <button type="button" className="btn btn-ghost !min-h-11" onClick={() => setLimit(shown.length)}>
            Show all {shown.length}
          </button>
        </div>
      )}
    </section>
  );
}

function LedgerRow({ race, open, onToggle }: { race: RaceMeta; open: boolean; onToggle: () => void }): ReactNode {
  const delta = race.hits - race.baselineHits;
  const panelId = `brief-${race.id}`;
  return (
    <li className="border-b border-line">
      <div className="grid gap-3 py-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4 lg:grid-cols-[minmax(11rem,1.1fr)_minmax(15rem,1.5fr)_auto_auto] lg:items-center lg:gap-6">
        <div className="min-w-0">
          <h3 className="font-display text-[1.45rem] leading-none font-semibold uppercase">{race.name}</h3>
          <p className="label mt-1.5">{race.year} · Round {race.round}</p>
        </div>
        <div className="min-w-0 space-y-1.5 text-[0.95rem]">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="w-16 shrink-0 text-mute">Paladin</span>
            {race.predicted.map((id) => {
              const hit = race.actual.includes(id);
              return (
                <span key={id} className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-display font-semibold ${hit ? "border-hit/50 text-hit" : "border-line2 text-steel"}`}>
                  <Icon name={hit ? "check" : "cross"} size={12} strokeWidth={2.8} />
                  {driver(id).code}
                  <span className="sr-only">{hit ? ", on the podium" : ", off the podium"}</span>
                </span>
              );
            })}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-steel">
            <span className="w-16 shrink-0 text-mute">Podium</span>
            {race.actual.map((id) => driver(id).last).join(" · ")}
          </p>
        </div>
        <dl className="flex gap-6">
          <div>
            <dt className="text-[0.78rem] text-mute">Paladin</dt>
            <dd className="figure text-[1.6rem]">{race.hits}/3</dd>
          </div>
          <div>
            <dt className="text-[0.78rem] text-mute">Grid</dt>
            <dd className="figure text-[1.6rem]">{race.baselineHits}/3</dd>
          </div>
          <div>
            <dt className="text-[0.78rem] text-mute">Field model</dt>
            <dd className="figure text-[1.6rem] text-steel">{fieldRaceResult(race.id)?.hits ?? "–"}/3</dd>
          </div>
          <div>
            <dt className="text-[0.78rem] text-mute">Paladin vs grid</dt>
            <dd className={`figure text-[1.6rem] ${delta > 0 ? "text-hit" : delta < 0 ? "text-signal-text" : "text-steel"}`}>{delta > 0 ? "+" : delta < 0 ? "−" : ""}{Math.abs(delta)}</dd>
          </div>
        </dl>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost !min-h-11" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
            {open ? "Close" : "Break it down"}
          </button>
          <a className="inline-flex min-h-11 items-center px-2 text-steel underline decoration-line2 underline-offset-2 hover:text-ink" href={href(raceHref(race))} aria-label={`Open the ${race.year} ${race.name} page`}>
            Open race
          </a>
        </div>
      </div>
      {open && (
        <div id={panelId}>
          <RaceBrief race={race} />
        </div>
      )}
    </li>
  );
}

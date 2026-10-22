import { useMemo } from "react";
import { Flag } from "../../components/Flag";
import { Icon } from "../../components/Icon";
import { Panel } from "../../components/Panel";
import { Portrait } from "../../components/Portrait";
import { Note, ScoreBar, Tabs } from "../../components/Bits";
import { Missing } from "../../components/Missing";
import {
  CONSTRUCTORS,
  DRIVERS,
  PORTRAITS,
  SEASONS,
  constructor as teamOf,
  driverByReference,
  raceHref,
  racesIn,
  teamColour,
  type Driver,
  type SeasonLine,
} from "../../lib/data";
import { longDate, ordinal } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { href, replaceQuery } from "../../lib/router";
import { PLACE_COLOURS } from "../race/rows";
import { ScoreLines, seriesFor } from "./ScoreLines";

type Sort = "score" | "podiums" | "starts" | "name";

const MAX_COMPARE = 4;

export function DriversPage({ reference, query }: { reference?: string; query: URLSearchParams }) {
  if (reference) {
    const driver = driverByReference(reference);
    return driver ? <DriverDetail driver={driver} query={query} /> : <Missing kind="Driver" reference={reference} backTo="/drivers" />;
  }
  return <DriverList query={query} />;
}

/* ------------------------------------------------------------------ list */

function DriverList({ query }: { query: URLSearchParams }) {
  useTitle("Drivers");
  const season = (SEASONS as readonly number[]).includes(Number(query.get("season"))) ? Number(query.get("season")) : 2024;
  const team = query.get("team") ?? "";
  const sort = (["score", "podiums", "starts", "name"].includes(query.get("sort") ?? "") ? query.get("sort") : "score") as Sort;
  const search = query.get("q") ?? "";
  const compare = (query.get("compare") ?? "").split(",").filter(Boolean).slice(0, MAX_COMPARE);

  const update = (next: Record<string, string | number | undefined>) =>
    replaceQuery({ season, team: team || undefined, sort: sort === "score" ? undefined : sort, q: search || undefined, compare: compare.join(",") || undefined, ...next });

  const entries = useMemo(
    () =>
      DRIVERS.filter((d) => d.seasons[String(season)])
        .map((d) => ({ driver: d, line: d.seasons[String(season)] }))
        .filter(({ line, driver }) => (!team || line.constructors.includes(CONSTRUCTORS.find((c) => c.ref === team)?.id ?? -1)) && (!search || driver.name.toLowerCase().includes(search.toLowerCase()) || driver.code.toLowerCase() === search.toLowerCase()))
        .sort((a, b) => {
          if (sort === "name") return a.driver.last.localeCompare(b.driver.last);
          if (sort === "podiums") return b.line.podiums - a.line.podiums || b.line.meanScore - a.line.meanScore;
          if (sort === "starts") return b.line.races - a.line.races || b.line.meanScore - a.line.meanScore;
          return b.line.meanScore - a.line.meanScore;
        }),
    [season, team, search, sort],
  );
  const teams = CONSTRUCTORS.filter((c) => c.years.includes(season));

  const toggle = (ref: string) => {
    const next = compare.includes(ref) ? compare.filter((r) => r !== ref) : [...compare, ref].slice(-MAX_COMPARE);
    update({ compare: next.join(",") || undefined });
  };

  return (
    <div className="page-in">
      <header className="border-b border-line pt-[calc(var(--nav-h)+2rem)] pb-8">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <p className="eyebrow">Drivers</p>
          <h1 className="display mt-3 text-[3rem] sm:text-[4.8rem]">The grid, scored</h1>
          <p className="mt-4 max-w-[66ch] text-[1.1rem] leading-relaxed text-steel">
            Every driver who raced in the held-out seasons, with what the model thought of them and what they actually did. Select up to
            four to compare their season side by side.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] space-y-6 px-4 pt-8 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs<string>
            value={String(season)}
            onChange={(v) => update({ season: Number(v), team: undefined })}
            idPrefix="drv-season"
            label="Season"
            options={SEASONS.map((s) => ({ id: String(s), label: String(s) }))}
          />
          <label className="relative">
            <span className="sr-only">Search drivers</span>
            <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-mute" />
            <input
              type="search"
              value={search}
              placeholder="Search a driver"
              onChange={(e) => update({ q: e.target.value || undefined })}
              className="min-h-10 w-52 border border-line2 bg-panel pr-3 pl-9 text-[1rem] text-ink placeholder:text-mute focus:border-ink focus:outline-none"
            />
          </label>
          <label className="ml-auto flex items-center gap-2 text-[0.9rem] text-mute">
            Sort
            <select className="select" value={sort} onChange={(e) => update({ sort: e.target.value === "score" ? undefined : e.target.value })} aria-label="Sort drivers">
              <option value="score">Mean podium score</option>
              <option value="podiums">Podiums</option>
              <option value="starts">Starts</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by team">
          <button type="button" className="chip shrink-0" aria-pressed={!team} onClick={() => update({ team: undefined })}>
            All teams
          </button>
          {teams.map((t) => (
            <button key={t.id} type="button" className="chip shrink-0" aria-pressed={team === t.ref} onClick={() => update({ team: team === t.ref ? undefined : t.ref })}>
              <span className="h-3 w-1.5" style={{ background: t.colour[String(season)] }} aria-hidden />
              {t.short}
            </button>
          ))}
        </div>

        {compare.length >= 2 && <ComparePanel refs={compare} season={season} onClear={() => update({ compare: undefined })} onToggle={toggle} />}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label={`${season} drivers`}>
          {entries.map(({ driver, line }) => (
            <li key={driver.id}>
              <DriverCard driver={driver} line={line} season={season} selected={compare.includes(driver.ref)} onSelect={() => toggle(driver.ref)} disabled={!compare.includes(driver.ref) && compare.length >= MAX_COMPARE} />
            </li>
          ))}
          {entries.length === 0 && <li className="col-span-full text-steel">No driver matches those filters.</li>}
        </ul>

        <Note>
          Scores are the model's podium score before each race, averaged over the season. A driver's mean score mostly reflects the cars they
          qualify in, so it rewards the front of the field. "Caught" counts a podium as caught when the score was at or above the cutoff.
        </Note>
      </div>
    </div>
  );
}

function DriverCard({
  driver,
  line,
  season,
  selected,
  onSelect,
  disabled,
}: {
  driver: Driver;
  line: SeasonLine;
  season: number;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const team = teamOf(line.constructorId);
  const colour = teamColour(line.constructorId, season);
  const caught = line.flaggedCorrect;
  return (
    <article
      className={`group relative overflow-hidden border bg-panel transition-colors hover:bg-panel2 ${selected ? "border-ink" : "border-line hover:border-line2"}`}
      style={{ borderTop: `4px solid ${colour}` }}
    >
      <div className="relative aspect-[5/4] overflow-hidden">
        <Portrait driver={driver} colour={colour} number={line.number} className="h-full w-full" />
        <span
          aria-hidden
          className="figure pointer-events-none absolute bottom-0 left-3 translate-y-[18%] text-[6.5rem] leading-none text-transparent"
          style={{ WebkitTextStroke: "2px rgba(255,255,255,.85)" }}
        >
          {line.number}
        </span>
        <span className="absolute top-3 left-3 flex items-center gap-2 bg-tower/85 px-2 py-1 text-[0.8rem] text-steel">
          <Flag code={driver.flag} />
          {driver.code}
        </span>
      </div>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`Compare ${driver.name}`}
        className={`absolute top-3 right-3 z-10 flex h-9 items-center gap-1.5 px-2.5 font-display text-[0.9rem] font-bold tracking-wide uppercase disabled:cursor-not-allowed disabled:opacity-40 ${
          selected ? "bg-ink text-paper" : "bg-tower/85 text-steel hover:text-ink"
        }`}
      >
        <Icon name={selected ? "check" : "compare"} size={15} strokeWidth={2.2} />
        Compare
      </button>

      <div className="p-4">
        <p className="text-[0.85rem] text-mute">{driver.first}</p>
        <h2 className="display text-[1.9rem] leading-none">
          <a className="no-underline after:absolute after:inset-0 after:z-0 hover:underline" href={href(`/drivers/${driver.ref}`, { season })}>
            {driver.last}
          </a>
        </h2>
        <p className="mt-1.5 flex items-center gap-2 text-[0.88rem] text-steel">
          <span className="h-3 w-1.5" style={{ background: colour }} aria-hidden />
          {team.short}
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
          <Mini label="Podiums" value={line.podiums} />
          <Mini label="Starts" value={line.races} />
          <Mini label="Avg grid" value={line.avgGrid?.toFixed(1) ?? "–"} />
        </dl>

        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="label !text-[0.72rem]">Mean podium score</p>
            <p className="figure text-[1.5rem]">{line.meanScore.toFixed(2)}</p>
          </div>
          <ScoreBar value={line.meanScore} colour={colour} height={6} cutoff={false} className="mt-1.5" />
          <p className="mt-2 text-[0.82rem] leading-snug text-mute">
            Model caught {caught} of {line.podiums} podiums · {line.flagged} flags
          </p>
        </div>
      </div>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="label !text-[0.68rem]">{label}</dt>
      <dd className="figure mt-0.5 text-[1.5rem]">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ comparison */

function ComparePanel({ refs, season, onClear, onToggle }: { refs: string[]; season: number; onClear: () => void; onToggle: (ref: string) => void }) {
  const drivers = refs.map((r) => driverByReference(r)).filter((d): d is Driver => Boolean(d && d.seasons[String(season)]));
  const colours = distinctColours(drivers.map((d) => teamColour(d.seasons[String(season)].constructorId, season)));
  const series = drivers.map((d, i) => seriesFor(d, season, colours[i].colour, colours[i].dashed));
  const best = (f: (l: SeasonLine) => number | null, higher = true) => {
    const values = drivers.map((d) => f(d.seasons[String(season)]));
    const valid = values.filter((v): v is number => v !== null);
    const target = higher ? Math.max(...valid) : Math.min(...valid);
    return values.map((v) => v !== null && v === target);
  };
  const rows: { label: string; value: (l: SeasonLine) => string | number; best?: boolean[] }[] = [
    { label: "Starts", value: (l) => l.races },
    { label: "Podiums", value: (l) => l.podiums, best: best((l) => l.podiums) },
    { label: "Wins", value: (l) => l.wins, best: best((l) => l.wins) },
    { label: "Points", value: (l) => l.points ?? 0, best: best((l) => l.points) },
    { label: "Average grid", value: (l) => l.avgGrid?.toFixed(1) ?? "–", best: best((l) => l.avgGrid, false) },
    { label: "Average finish", value: (l) => l.avgFinish?.toFixed(1) ?? "–", best: best((l) => l.avgFinish, false) },
    { label: "Mean podium score", value: (l) => l.meanScore.toFixed(3), best: best((l) => l.meanScore) },
    { label: "Podiums the model caught", value: (l) => `${l.flaggedCorrect} of ${l.podiums}` },
    { label: "Times in the model's top three", value: (l) => `${l.modelTop3} (${l.modelTop3Correct} right)` },
  ];

  const top = drivers.length ? [...drivers].sort((a, b) => b.seasons[String(season)].meanScore - a.seasons[String(season)].meanScore)[0] : null;
  const h2h = drivers.length === 2 ? headToHead(drivers[0], drivers[1], season) : null;

  return (
    <Panel
      eyebrow={`Compare · ${season}`}
      title={drivers.map((d) => d.last).join(" vs ")}
      tag="model"
      actions={
        <button type="button" className="btn btn-ghost !min-h-9 !px-3 !text-[0.95rem]" onClick={onClear}>
          Clear
        </button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {drivers.map((d, i) => (
          <button key={d.id} type="button" className="chip" onClick={() => onToggle(d.ref)} aria-label={`Remove ${d.name}`}>
            <span className="h-3 w-1.5" style={{ background: colours[i].colour }} aria-hidden />
            {d.name}
            <Icon name="cross" size={13} />
          </button>
        ))}
      </div>

      <div className="mt-6">
        <ScoreLines season={season} series={series} />
      </div>

      {top && (
        <p className="mt-6 max-w-[74ch] text-[1.05rem] leading-snug">
          <span className="font-semibold">{top.name}</span> has the highest mean podium score ({top.seasons[String(season)].meanScore.toFixed(2)}).
          {h2h && (
            <>
              {" "}
              In the {h2h.shared} races both started, the model scored {drivers[0].last} higher {h2h.scoreA} times and {drivers[1].last}{" "}
              {h2h.shared - h2h.scoreA - h2h.tie} times; {drivers[0].last} finished ahead {h2h.finishA} times and {drivers[1].last}{" "}
              {h2h.shared - h2h.finishA - h2h.finishTie}.
            </>
          )}
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <caption className="sr-only">Season statistics side by side</caption>
          <thead>
            <tr className="border-b border-ink">
              <th className="py-2 pr-4 font-semibold text-steel">{season}</th>
              {drivers.map((d, i) => (
                <th key={d.id} className="py-2 pr-4">
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-1.5" style={{ background: colours[i].colour }} aria-hidden />
                    <span className="font-display text-[1.1rem] font-bold uppercase">{d.last}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line">
                <th scope="row" className="py-2.5 pr-4 text-[0.92rem] font-normal text-steel">
                  {row.label}
                </th>
                {drivers.map((d, i) => (
                  <td key={d.id} className={`py-2.5 pr-4 font-display text-[1.25rem] font-semibold tabular-nums ${row.best?.[i] ? "text-ink" : "text-steel"}`}>
                    {row.best?.[i] && <span className="mr-1.5 inline-block h-1.5 w-1.5 bg-signal align-middle" aria-hidden />}
                    {row.value(d.seasons[String(season)])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** Teammates share a livery colour: lighten the later one and draw its line dashed so the two stay apart. */
function distinctColours(colours: string[]): { colour: string; dashed: boolean }[] {
  const seen = new Map<string, number>();
  return colours.map((colour) => {
    const n = seen.get(colour) ?? 0;
    seen.set(colour, n + 1);
    if (n === 0) return { colour, dashed: false };
    const mix = (c: number) => Math.round(c + (255 - c) * 0.5 * n);
    const v = parseInt(colour.slice(1), 16);
    const hex = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => mix(Math.min(c, 255)).toString(16).padStart(2, "0")).join("");
    return { colour: `#${hex}`, dashed: true };
  });
}

function headToHead(a: Driver, b: Driver, season: number) {
  const la = new Map(a.seasons[String(season)].log.map((r) => [r[0], r]));
  let shared = 0;
  let scoreA = 0;
  let tie = 0;
  let finishA = 0;
  let finishTie = 0;
  for (const rb of b.seasons[String(season)].log) {
    const ra = la.get(rb[0]);
    if (!ra) continue;
    shared++;
    if (ra[2] > rb[2]) scoreA++;
    else if (ra[2] === rb[2]) tie++;
    if (ra[4] < rb[4]) finishA++;
    else if (ra[4] === rb[4]) finishTie++;
  }
  return { shared, scoreA, tie, finishA, finishTie };
}

/* ------------------------------------------------------------------ detail */

function DriverDetail({ driver, query }: { driver: Driver; query: URLSearchParams }) {
  const years = SEASONS.filter((s) => driver.seasons[String(s)]);
  const requested = Number(query.get("season"));
  const season = years.includes(requested as never) ? requested : years[years.length - 1];
  const line = driver.seasons[String(season)];
  const colour = teamColour(line.constructorId, season);
  const team = teamOf(line.constructorId);
  useTitle(driver.name);

  const races = racesIn(season);
  const byRace = new Map(races.map((r) => [r.id, r]));
  const log = line.log;
  const series = [seriesFor(driver, season, colour)];

  // teammate: the other driver with the most shared races for the same constructor
  const mates = DRIVERS.filter((d) => d.id !== driver.id && d.seasons[String(season)]).map((d) => {
    const shared = d.seasons[String(season)].log.filter((r) => log.some((m) => m[0] === r[0] && m[5] === r[5])).length;
    return { d, shared };
  }).sort((a, b) => b.shared - a.shared);
  const mate = mates[0]?.shared >= 3 ? mates[0].d : null;
  const h2h = mate ? headToHead(driver, mate, season) : null;

  const surprises = [...log]
    .map((r) => ({ r, gap: r[4] <= 3 ? 1 - r[2] : r[2] }))
    .sort((a, b) => b.gap - a.gap)
    .filter((x) => (x.r[4] <= 3 && x.r[2] < 0.625) || (x.r[4] > 3 && x.r[2] >= 0.625))
    .slice(0, 4);
  const credit = PORTRAITS[driver.ref];

  return (
    <div className="page-in">
      <header className="relative overflow-hidden border-b border-line pt-[calc(var(--nav-h)+1.5rem)] pb-8">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <a href={href("/drivers", { season })} className="eyebrow no-underline hover:text-ink">
            <span className="sr-only">Back to </span>Drivers
          </a>
          <div className="mt-5 grid items-end gap-6 sm:grid-cols-[14rem_1fr]">
            <Portrait driver={driver} colour={colour} number={line.number} className="aspect-[4/5] w-44 border-t-4 sm:w-full" label={driver.name} eager />
            <div>
              <p className="flex items-center gap-3 text-[1rem] text-steel">
                <Flag code={driver.flag} /> {driver.nationality} · born {longDate(driver.dob)}
              </p>
              <h1 className="display mt-2 text-[3rem] sm:text-[5.4rem]">
                <span className="block text-[1.3rem] font-semibold tracking-[0.04em] text-steel sm:text-[1.8rem]">{driver.first}</span>
                {driver.last}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-3 text-[1.05rem]">
                <span className="figure text-[2.2rem]" style={{ color: colour }}>#{line.number}</span>
                <span className="flex items-center gap-2 text-steel">
                  <span className="h-4 w-1.5" style={{ background: colour }} aria-hidden />
                  {team.name}
                </span>
              </p>
              <div className="mt-5">
                <Tabs<string>
                  value={String(season)}
                  onChange={(v) => replaceQuery({ season: Number(v) })}
                  idPrefix="detail-season"
                  label="Season"
                  options={years.map((s) => ({ id: String(s), label: String(s) }))}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] space-y-6 px-4 pt-8 sm:px-6 lg:px-10">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel eyebrow={`${season} season`} title="What happened" tag="record">
            <dl className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-4">
              <Big label="Starts" value={line.races} />
              <Big label="Podiums" value={line.podiums} />
              <Big label="Wins" value={line.wins} />
              <Big label="Points" value={line.points ?? 0} />
              <Big label="Average grid" value={line.avgGrid?.toFixed(1) ?? "–"} />
              <Big label="Average finish" value={line.avgFinish?.toFixed(1) ?? "–"} />
            </dl>
          </Panel>
          <Panel eyebrow={`${season} season`} title="What the model thought" tag="model">
            <dl className="grid grid-cols-3 gap-x-4 gap-y-5">
              <Big label="Mean score" value={line.meanScore.toFixed(2)} />
              <Big label="Podiums caught" value={`${line.flaggedCorrect}/${line.podiums}`} />
              <Big label="Flags raised" value={line.flagged} note={`${line.flagged - line.flaggedCorrect} wrong`} />
            </dl>
            <p className="mt-4 text-[0.88rem] leading-snug text-mute">
              A flag is a podium score at or above the 0.625 cutoff. Appeared in the model's top three {line.modelTop3} times, correctly{" "}
              {line.modelTop3Correct}.
            </p>
          </Panel>
        </div>

        <Panel eyebrow="Race by race" title="Podium score and finish" tag={["model", "record"]}>
          <ScoreLines season={season} series={series} />
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel eyebrow="Where the model was wrong" title="Biggest surprises" tag={["model", "record"]}>
            {surprises.length === 0 ? (
              <p className="text-steel">The model's flags and this driver's podiums agreed every time in {season}.</p>
            ) : (
              <ul className="divide-y divide-line">
                {surprises.map(({ r }) => {
                  const race = byRace.get(r[0])!;
                  const podium = r[4] <= 3;
                  return (
                    <li key={r[0]} className="py-3">
                      <a className="font-display text-[1.2rem] font-bold uppercase no-underline hover:underline" href={href(raceHref(race))}>
                        {race.name.replace(" Grand Prix", "")} {race.year}
                      </a>
                      <p className="mt-0.5 text-[0.92rem] text-steel">
                        {podium
                          ? `Finished ${ordinal(r[4])} from ${r[3] ? "P" + r[3] : "the pit lane"} with a score of only ${r[2].toFixed(2)}.`
                          : `Scored ${r[2].toFixed(2)} from ${r[3] ? "P" + r[3] : "the pit lane"}, but ${/^\d+$/.test(r[6]) ? "finished " + ordinal(r[4]) : "did not finish"}.`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel eyebrow="Same car" title={mate ? `Against ${mate.last}` : "Teammate"} tag={["model", "record"]}>
            {mate && h2h ? (
              <div>
                <p className="text-[1.02rem] leading-snug">
                  In {h2h.shared} shared races, {driver.last} finished ahead {h2h.finishA} times and {mate.last}{" "}
                  {h2h.shared - h2h.finishA - h2h.finishTie}. The model scored {driver.last} higher {h2h.scoreA} times.
                </p>
                <div className="mt-4 flex h-3 overflow-hidden bg-line" aria-hidden>
                  <span style={{ width: `${(h2h.finishA / h2h.shared) * 100}%`, background: colour }} />
                  <span className="flex-1 bg-line2" />
                </div>
                <div className="mt-1.5 flex justify-between text-[0.8rem] text-mute">
                  <span>{driver.last} ahead</span>
                  <span>{mate.last} ahead</span>
                </div>
                <a className="chip mt-4 no-underline" href={href("/drivers", { season, compare: `${driver.ref},${mate.ref}` })}>
                  <Icon name="compare" size={15} /> Compare season lines
                </a>
              </div>
            ) : (
              <p className="text-steel">No teammate shared enough races with {driver.last} in {season} for a fair comparison.</p>
            )}
          </Panel>
        </div>

        <Panel eyebrow="Every start" title={`${season} results`} tag={["model", "record"]}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <caption className="sr-only">Race by race grid, podium score and finish</caption>
              <thead>
                <tr className="border-b border-ink text-[0.85rem] text-steel">
                  <th className="py-2 pr-3 font-semibold">Rd</th>
                  <th className="py-2 pr-3 font-semibold">Grand Prix</th>
                  <th className="py-2 pr-3 font-semibold">Grid</th>
                  <th className="py-2 pr-3 font-semibold">Score</th>
                  <th className="py-2 pr-3 font-semibold">Finish</th>
                </tr>
              </thead>
              <tbody>
                {log.map((r) => {
                  const race = byRace.get(r[0])!;
                  return (
                    <tr key={r[0]} className="border-b border-line">
                      <td className="py-2 pr-3 font-display text-[1.05rem] text-steel">{r[1]}</td>
                      <td className="py-2 pr-3">
                        <a className="font-display text-[1.1rem] font-semibold uppercase no-underline hover:underline" href={href(raceHref(race))}>
                          {race.name.replace(" Grand Prix", "")}
                        </a>
                      </td>
                      <td className="py-2 pr-3 font-display text-[1.05rem]">{r[3] ? `P${r[3]}` : "PIT"}</td>
                      <td className="py-2 pr-3 font-display text-[1.1rem] font-semibold tabular-nums">{r[2].toFixed(2)}</td>
                      <td className="py-2 pr-3">
                        <span
                          className="inline-block min-w-[2.6rem] px-1.5 py-1 text-center font-display text-[0.95rem] leading-none font-bold"
                          style={r[4] <= 3 ? { background: PLACE_COLOURS[r[4] - 1], color: "#0a0b0e" } : { background: "#1c2128", color: "#c5cad1" }}
                        >
                          {/^\d+$/.test(r[6]) ? `P${r[6]}` : r[6] === "R" ? "Ret" : r[6]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {credit && (
          <p className="text-[0.8rem] text-mute">
            Portrait: {credit.author.slice(0, 80)},{" "}
            <a className="underline decoration-line2 underline-offset-2 hover:text-ink" href={credit.source}>
              {credit.licence}
            </a>{" "}
            via Wikimedia Commons. The photo may be from a different season.
          </p>
        )}
      </div>
    </div>
  );
}

function Big({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div>
      <dt className="label !text-[0.72rem]">{label}</dt>
      <dd className="figure mt-1 text-[2.2rem]">{value}</dd>
      {note && <dd className="text-[0.78rem] text-mute">{note}</dd>}
    </div>
  );
}

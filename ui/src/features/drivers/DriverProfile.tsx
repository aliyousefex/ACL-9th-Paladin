import { useMemo } from "react";
import { ArcChart } from "../../components/ArcChart";
import { Flag } from "../../components/Flag";
import { Panel } from "../../components/Panel";
import { SourceLinks } from "../../components/SourceLinks";
import { Tag } from "../../components/Provenance";
import { DRIVERS, SEASONS, circuit, constructor as teamOf, raceHref, raceMeta, racesIn, standings, teamColour, type Driver } from "../../lib/data";
import { longDate, ordinal } from "../../lib/format";
import { href } from "../../lib/router";
import { PRINCIPALS, leaders } from "../../lib/teams";
import { isPlainPrincipal, seasonSpan, titleInSentence } from "../../lib/teamLogic";
import { PLACE_COLOURS } from "../race/rows";
import { arc, arcSummary, highlights, listOf, plural, pointsOf, profileText, seasonFacts, seasonText, weekendsOf, type Highlight } from "./profile";

/** A race as a short name for a sentence: "Bahrain", not "Bahrain Grand Prix". */
const raceName = (id: number): string => (raceMeta(id)?.name ?? `Race ${id}`).replace(" Grand Prix", "");

/** What the record lets us say about a driver in a season, worked out once and shared by the panels below. */
export function useDriverStory(driver: Driver, season: number) {
  return useMemo(() => {
    const years = SEASONS.filter((s) => driver.seasons[String(s)]);
    const line = driver.seasons[String(season)];
    const seasons = years.map((year) => {
      const l = driver.seasons[String(year)];
      return { season: year, facts: seasonFacts(year, l, standings[String(year)]?.drivers[String(driver.id)]), teams: l.constructors.map((id) => teamOf(id).name), number: l.number };
    });
    const facts = seasons.find((s) => s.season === season)!.facts;
    const previous = seasons.find((s) => s.season === season - 1)?.facts ?? null;
    const latest = years[years.length - 1];
    const latestStart = racesIn(latest).slice().sort((a, b) => a.round - b.round)[0]?.date.slice(0, 10) ?? `${latest}-03-01`;
    const standing = standings[String(season)];
    const moments = highlights(facts, line.log, raceName);
    const points = arc(standing?.drivers[String(driver.id)], standing?.rounds ?? []);
    return {
      years,
      seasons,
      facts,
      profile: profileText({ last: driver.last, nationality: driver.nationality, dob: driver.dob, latestStart, seasons }),
      story: seasonText({ last: driver.last, season, facts, teams: line.constructors.map((id) => teamOf(id).name), previous, raceName }),
      moments,
      weekends: weekendsOf(moments, line.log),
      raceNames: new Map(line.log.map((r) => [r[0], raceName(r[0])])),
      arcPoints: points,
      arcSummary: arcSummary(points),
    };
  }, [driver, season]);
}

export type DriverStory = ReturnType<typeof useDriverStory>;

/* ------------------------------------------------------------------ the person and the three seasons */

export function ProfilePanel({ driver, story, season }: { driver: Driver; story: DriverStory; season: number }) {
  return (
    <Panel title={`About ${driver.last}`} tag="record">
      <p className="max-w-[74ch] text-[1.08rem] leading-relaxed text-ink">{story.profile}</p>
      <div className="relative mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">{driver.name}: each season in the data</caption>
          <thead>
            <tr className="border-b border-ink text-[0.85rem] text-steel">
              <th className="py-2 pr-3 font-semibold">Season</th>
              <th className="py-2 pr-3 font-semibold">Team</th>
              <th className="py-2 pr-3 text-right font-semibold">Starts</th>
              <th className="py-2 pr-3 text-right font-semibold">Wins</th>
              <th className="py-2 pr-3 text-right font-semibold">Podiums</th>
              <th className="py-2 pr-3 text-right font-semibold">Points</th>
              <th className="py-2 pr-3 text-right font-semibold">Championship</th>
              <th className="py-2 pr-3 text-right font-semibold">Average grid</th>
              <th className="py-2 text-right font-semibold">Average finish</th>
            </tr>
          </thead>
          <tbody>
            {story.seasons.map(({ season: year, facts, teams }) => (
              <tr key={year} className={`border-b border-line ${year === season ? "bg-panel2" : ""}`}>
                <th scope="row" className="py-2.5 pr-3 font-display text-[1.1rem] font-semibold">
                  {year === season ? (
                    <span aria-current="true">{year}</span>
                  ) : (
                    <a href={href(`/drivers/${driver.ref}`, { season: year })} className="inline-block py-1 no-underline hover:underline">
                      {year}
                    </a>
                  )}
                </th>
                <td className="py-2.5 pr-3 text-steel">{teams.join(" and ")}</td>
                <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{facts.starts}</td>
                <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{facts.wins}</td>
                <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{facts.podiums}</td>
                <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{pointsOf(facts)}</td>
                <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{facts.championship ? ordinal(facts.championship.position) : "–"}</td>
                <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{facts.avgGrid?.toFixed(1) ?? "–"}</td>
                <td className="py-2.5 text-right font-display text-[1.1rem] tabular-nums">{facts.avgFinish?.toFixed(1) ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ the season in words */

export function SeasonStoryPanel({ driver, story, season }: { driver: Driver; story: DriverStory; season: number }) {
  return (
    <Panel title={`${driver.last} in ${season}`} tag="record">
      <p className="max-w-[74ch] text-[1.08rem] leading-relaxed text-ink">{story.story}</p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ round by round */

export function ArcPanel({ driver, story, season, colour }: { driver: Driver; story: DriverStory; season: number; colour: string }) {
  const summary = story.arcSummary;
  if (!summary) return null;
  const spot = (p: { position: number | null; raceId: number; round: number }) => `${ordinal(p.position!)} after round ${p.round}, the ${raceMeta(p.raceId)?.name ?? raceName(p.raceId)}`;
  const sentence = summary.best.position === summary.worst.position
    ? `${driver.last} was ${ordinal(summary.best.position!)} in the championship after every round they had a place.`
    : `${driver.last}'s best place was ${spot(summary.best)}, and the lowest was ${spot(summary.worst)}. The season ended ${ordinal(summary.last.position!)}.`;
  return (
    <Panel title="Championship, round by round" context={`${season}: the position after each race`} tag="record">
      <ArcChart points={story.arcPoints} colour={colour} label={`${driver.name}: championship position after each round of ${season}. ${sentence}`} raceName={raceName} />
      <p className="mt-3 max-w-[74ch] text-[1rem] leading-snug text-steel">{sentence}{summary.leaderRounds > 0 ? ` ${driver.last} led the championship after ${plural(summary.leaderRounds, "round")}.` : ""}</p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ weekends to look at */

/** What a weekend is listed for, in words: a chip says it in text, so colour is never the only carrier. */
const chipText = (kind: Highlight["kind"], places: number | null): string =>
  ({ win: "Win", best: "Best finish", pole: "Pole", gain: `Gained ${plural(places ?? 0, "place")}`, drop: `Lost ${plural(places ?? 0, "place")}`, retired: "Retired" })[kind];

export function HighlightsPanel({ story, season }: { story: DriverStory; season: number }) {
  if (story.weekends.length === 0) return null;
  const count = story.weekends.length;
  return (
    <Panel title="Weekends to look at" context={`${season}: ${plural(count, "weekend")} with a win, a pole, the biggest moves or a retirement`} tag="record">
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={`${season} weekends to look at, in calendar order`}>
        {story.weekends.map((w) => {
          const race = raceMeta(w.raceId);
          const country = race ? circuit(race.circuitId) : undefined;
          const colour = teamColour(w.constructorId, season);
          const medal = w.finish !== null && w.finish <= 3 ? PLACE_COLOURS[w.finish - 1] : null;
          return (
            <li key={w.raceId} className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 border border-line bg-panel2 p-4 transition-colors hover:border-line2 sm:grid-cols-1" style={{ borderTop: `3px solid ${colour}` }}>
              <div className="min-w-0">
                <div className="flex items-start gap-2.5">
                  <Flag code={country?.flag} large className="mt-px" />
                  <a className="min-w-0 font-display text-[1.3rem] leading-[1.05] font-bold uppercase no-underline after:absolute after:inset-0 hover:underline" href={race ? href(raceHref(race)) : undefined}>
                    {story.raceNames.get(w.raceId)}
                  </a>
                </div>
                <p className="mt-1.5 text-[0.85rem] text-mute">
                  Round {w.round}
                  {country ? ` · ${country.country}` : ""}
                </p>
              </div>

              <div className="flex items-end gap-3 sm:mt-4">
                <div>
                  <p className="figure text-[1.8rem] leading-none text-steel sm:text-[2rem]">{w.grid === null ? "Pit" : `P${w.grid}`}</p>
                  <p className="mt-1 text-[0.8rem] text-mute">{w.grid === null ? "Pit lane" : "Grid"}</p>
                </div>
                <span aria-hidden className="pb-6 text-[1.2rem] leading-none text-mute">
                  →
                </span>
                <div>
                  <p
                    className="figure inline-block min-w-[2.6rem] px-1.5 py-0.5 text-center text-[1.8rem] leading-none sm:text-[2rem]"
                    style={medal ? { background: medal, color: "var(--color-on-medal)" } : { color: "var(--color-ink)" }}
                  >
                    {w.finish === null ? "Out" : `P${w.finish}`}
                  </p>
                  <p className="mt-1 text-[0.8rem] text-mute">{w.finish === null ? (w.retired ? "Retired" : "Not classified") : "Finish"}</p>
                </div>
              </div>

              <ul className="col-span-2 mt-3 flex flex-wrap gap-1.5 sm:col-span-1 sm:mt-4" aria-label="Why it is listed">
                {w.kinds.map((kind) => (
                  <li key={kind} className="inline-flex items-center gap-1 border border-line2 px-2 py-0.5 text-[0.82rem] font-semibold text-steel">
                    {kind === "gain" && <span aria-hidden className="text-hit">▲</span>}
                    {kind === "drop" && <span aria-hidden>▼</span>}
                    {chipText(kind, w.places)}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ------------------------------------------------------------------ the team, and who ran it */


export function TeamPanel({ driver, season, constructorId }: { driver: Driver; season: number; constructorId: number }) {
  const team = teamOf(constructorId);
  const colour = teamColour(constructorId, season);
  const year = standings[String(season)];
  const teamStanding = year?.constructors[String(constructorId)];
  const finalPosition = teamStanding ? [...teamStanding.pos].reverse().find((p) => p !== null) ?? null : null;
  const finalPoints = teamStanding ? [...teamStanding.pts].reverse().find((p) => p !== null) ?? null : null;

  const mates = DRIVERS.filter((d) => d.id !== driver.id && d.seasons[String(season)])
    .map((d) => ({ d, rows: d.seasons[String(season)].log.filter((r) => r[5] === constructorId) }))
    .filter((m) => m.rows.length > 0)
    .sort((a, b) => b.rows.length - a.rows.length);
  const people = leaders(team.ref, season);

  return (
    <Panel title={`${team.name} in ${season}`} tag={["record", "reference"]}>
      <p className="max-w-[74ch] text-[1.05rem] leading-relaxed">
        {driver.last} drove for <a href={href(`/teams/${team.ref}`, { season })} className="font-semibold underline decoration-line2 underline-offset-2 hover:text-ink">{team.name}</a>
        {finalPosition !== null && finalPoints !== null ? <>, which finished {ordinal(finalPosition)} in the constructors' championship with {finalPoints} points.</> : "."}
        {mates.length > 0 ? <> {listOf(mates.map((m) => m.d.last))} {mates.length === 1 ? "was" : "were"} {driver.last}'s {mates.length === 1 ? "teammate" : "teammates"} that season.</> : null}
      </p>

      {mates.length > 0 ? (
        <ul className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-px bg-line">
          {mates.map(({ d, rows }) => (
            <li key={d.id} className="flex items-center gap-3 bg-panel px-4 py-3">
              <span className="h-5 w-1.5 shrink-0" style={{ background: colour }} aria-hidden />
              <div className="min-w-0">
                <a href={href(`/drivers/${d.ref}`, { season })} className="block truncate font-display text-[1.15rem] font-bold uppercase no-underline hover:underline">
                  {d.name}
                </a>
                <span className="text-[0.88rem] text-mute">
                  {plural(rows.length, "race")} in the same car · {plural(d.seasons[String(season)].podiums, "podium")} in {season}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-7 border-t border-line pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="display text-[1.4rem]">Who ran {team.name}</h3>
          <Tag kind="reference" />
        </div>
        <ul className="mt-3 divide-y divide-line">
          {people.map(({ person, tenure }) => (
            <li key={`${person.ref}-${tenure.firstSeason}`} className="py-3">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Flag code={person.flag} />
                <span className="font-display text-[1.2rem] font-bold uppercase">{person.name}</span>
                <span className="text-steel">{isPlainPrincipal(tenure.title) ? "team principal" : titleInSentence(tenure.title)}</span>
                <span className="text-[0.88rem] text-mute">
                  {person.nationality} · {seasonSpan(tenure)} in the data
                </span>
              </p>
              {tenure.note ? <p className="mt-1 max-w-[74ch] text-[0.95rem] text-steel">{tenure.note}</p> : null}
              <SourceLinks sources={tenure.sources} />
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-[74ch] text-[0.85rem] leading-snug text-mute">
          This is not part of the race dataset. It is a short reference list written by hand from the sources linked, last checked {longDate(PRINCIPALS.checked)}.
        </p>
        <a className="chip mt-4 no-underline" href={href(`/teams/${team.ref}`, { season })}>
          More about {team.name}
        </a>
      </div>
    </Panel>
  );
}


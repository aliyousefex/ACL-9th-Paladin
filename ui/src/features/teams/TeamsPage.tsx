import { useMemo } from "react";
import { ArcChart } from "../../components/ArcChart";
import { Tabs } from "../../components/Bits";
import { Flag } from "../../components/Flag";
import { Icon } from "../../components/Icon";
import { Missing } from "../../components/Missing";
import { Portrait } from "../../components/Portrait";
import { Panel } from "../../components/Panel";
import { SourceLinks } from "../../components/SourceLinks";
import { Tag } from "../../components/Provenance";
import { TeamBadge } from "../../components/TeamBadge";
import { DRIVERS, SEASONS, driver as driverOf, raceMeta, standings, teamColour, type Constructor } from "../../lib/data";
import { longDate, ordinal } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { href, replaceQuery } from "../../lib/router";
import { LOGOS, PRINCIPALS, TEAMS, leaders, teamByReference, teamLogo, tenuresOfPerson, type Leadership, type Tenure } from "../../lib/teams";
import type { TeamLogo } from "../../lib/teamMark";
import { isPlainPrincipal, seasonSpan, titleInSentence } from "../../lib/teamLogic";
import { arc, arcSummary, listOf, plural } from "../drivers/profile";
import { teamSeason, teamSeasonText, type TeamSeason } from "./teamFacts";

const seasonOf = (query: URLSearchParams, years: readonly number[], fallback: number): number => {
  const asked = Number(query.get("season"));
  return years.includes(asked) ? asked : fallback;
};

const raceName = (id: number): string => (raceMeta(id)?.name ?? `Race ${id}`).replace(" Grand Prix", "");
/** "team principal", or the exact title when it is something else, so a team representative is never called a principal. */
const titleWords = (tenure: Tenure): string => (isPlainPrincipal(tenure.title) ? "team principal" : titleInSentence(tenure.title));

export function TeamsPage({ reference, query }: { reference?: string; query: URLSearchParams }) {
  if (reference) {
    const team = teamByReference(reference);
    return team ? <TeamDetail team={team} query={query} /> : <Missing kind="Team" reference={reference} backTo="/teams" />;
  }
  return <TeamList query={query} />;
}

/* ------------------------------------------------------------------ the list */

function TeamList({ query }: { query: URLSearchParams }) {
  useTitle("Teams", "Every team of the 2022–2024 seasons: where it finished, who drove for it and who ran it.");
  const season = seasonOf(query, SEASONS, 2024);
  const rows = useMemo(
    () =>
      TEAMS.map((team) => ({ team, facts: teamSeason(DRIVERS, team.id, season, standings[String(season)]) }))
        .filter((row): row is { team: Constructor; facts: TeamSeason } => row.facts !== null)
        .sort((a, b) => (a.facts.championship?.position ?? 99) - (b.facts.championship?.position ?? 99) || a.team.name.localeCompare(b.team.name)),
    [season],
  );

  return (
    <div className="page-in">
      <header className="border-b border-line pt-[calc(var(--nav-h)+1.5rem)] pb-8">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <h1 className="display text-[3rem] sm:text-[5rem]">Teams</h1>
          <p className="mt-3 max-w-[60ch] text-[1.1rem] leading-snug text-steel">
            Where each team finished, who drove for it, and who ran it, season by season. The results are from the race record; who ran each team is a short reference list, with its sources.
          </p>
          <div className="mt-5">
            <Tabs<string> value={String(season)} onChange={(v) => replaceQuery({ season: Number(v) })} idPrefix="teams-season" label="Season" options={SEASONS.map((s) => ({ id: String(s), label: String(s) }))} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] space-y-6 px-4 pt-8 sm:px-6 lg:px-10">
        <Panel title={`${season} constructors' championship`} context="Ranked by where each team finished" tag={["record", "reference"]}>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label={`${season} teams`}>
            {rows.map(({ team, facts }) => (
              <li key={team.id}>
                <TeamCard team={team} facts={facts} season={season} />
              </li>
            ))}
          </ol>
          <p className="mt-5 max-w-[78ch] text-[0.85rem] leading-snug text-mute">
            Where a team changed its leader part-way through the year, both are listed. A team representative is not a team principal: Sauber had no team principal in 2023 or 2024, and its leader's title is given as it was published.
          </p>
          <LogoCredits />
        </Panel>
      </div>
    </div>
  );
}

function TeamCard({ team, facts, season }: { team: Constructor; facts: TeamSeason; season: number }) {
  const colour = teamColour(team.id, season);
  const people = leaders(team.ref, season);
  const place = facts.championship?.position;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden border border-line bg-panel transition-colors hover:border-line2 hover:bg-panel2" style={{ borderTop: `4px solid ${colour}` }}>
      <div className="relative aspect-[5/3] overflow-hidden text-[1rem]">
        <TeamBadge team={team} colour={colour} className="h-full w-full text-[1.6rem]" />
        {place != null && (
          <span
            aria-hidden
            className="figure pointer-events-none absolute bottom-0 left-3 translate-y-[18%] text-[6.5rem] leading-none text-transparent"
            style={{ WebkitTextStroke: "2px rgba(255,255,255,.85)" }}
          >
            {place}
          </span>
        )}
        {facts.championship && <span className="absolute top-3 right-3 bg-tower/85 px-2 py-1 text-[0.8rem] text-steel">{facts.championship.points} points</span>}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[0.85rem] text-mute">{place != null ? `${ordinal(place)} in the championship` : "Not in the championship"}</p>
        <h3 className="display text-[1.9rem] leading-none">
          <a className="no-underline after:absolute after:inset-0 after:z-0 hover:underline" href={href(`/teams/${team.ref}`, { season })}>
            {team.name}
          </a>
        </h3>
        <p className="mt-1.5 text-[0.88rem] text-steel">
          {plural(facts.wins, "win")} · {plural(facts.podiums, "podium")}
        </p>

        <ul className="mt-3 space-y-1 border-t border-line pt-3" aria-label="Who ran the team">
          {people.map(({ person, tenure }) => (
            <li key={`${person.ref}-${tenure.firstSeason}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Flag code={person.flag} />
              <span className="font-display text-[1.05rem] font-semibold uppercase">{person.name}</span>
              <span className="text-[0.85rem] text-mute">{titleWords(tenure)}</span>
            </li>
          ))}
        </ul>

        <ul className="mt-auto grid grid-cols-2 gap-x-3 pt-3" aria-label="Drivers">
          {facts.drivers.map((d) => {
            const person = driverOf(d.driverId);
            return (
              <li key={d.driverId} className="min-w-0">
                <a href={href(`/drivers/${person.ref}`, { season })} className="relative z-10 flex min-h-11 items-center gap-2.5 no-underline hover:underline">
                  <Portrait driver={person} colour={colour} className="h-9 w-9 shrink-0" sizes="36px" rounded />
                  <span className="min-w-0 truncate text-[0.95rem] text-steel">{person.last}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

/** Where each team mark came from and on what terms, kept closed until asked for: the marks are trademarks, shown to identify the teams. */
function LogoCredits() {
  const named = LOGOS.logos.map((logo) => ({ logo, team: teamByReference(logo.constructor) })).filter((row): row is { logo: TeamLogo; team: Constructor } => row.team !== undefined);
  const without = TEAMS.filter((team) => !teamLogo(team.ref));
  return (
    <details className="mt-3 max-w-[78ch] border-t border-line pt-1 text-[0.85rem] text-mute">
      <summary className="flex min-h-11 cursor-pointer items-center">Logo credits</summary>
      <p className="leading-snug">
        Team marks are trademarks of their owners and are shown only to identify each team. Each is drawn in one colour.
        {without.length > 0 ? ` ${listOf(without.map((team) => team.name))} ${without.length === 1 ? "has" : "have"} no freely licensed file, so ${without.length === 1 ? "its tile shows" : "their tiles show"} a three-letter code.` : ""}
      </p>
      <ul className="mt-1">
        {named.map(({ logo, team }) => (
          <li key={logo.constructor} className="flex flex-wrap items-center gap-x-2">
            <span className="min-w-[8.5rem] font-semibold text-steel">{team.name}</span>
            <a href={logo.source} className="inline-flex min-h-11 items-center underline decoration-line2 underline-offset-2 hover:text-ink" rel="noopener noreferrer">
              {logo.author}
            </a>
            <span>{logo.licence}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ------------------------------------------------------------------ one team */

function TeamDetail({ team, query }: { team: Constructor; query: URLSearchParams }) {
  const years: number[] = SEASONS.filter((s) => team.years.includes(s));
  const season = seasonOf(query, years, years[years.length - 1]);
  const colour = teamColour(team.id, season);
  useTitle(team.name, `${team.name}: its ${years.join(", ")} seasons in the data, its drivers and who ran it.`);

  const all = useMemo(() => years.map((year) => teamSeason(DRIVERS, team.id, year, standings[String(year)])), [team.id, years]);
  const facts = all[years.indexOf(season)]!;
  const previous = years.indexOf(season) > 0 ? all[years.indexOf(season) - 1] : null;
  const year = standings[String(season)];
  const points = arc(year?.constructors[String(team.id)], year?.rounds ?? []);
  const summary = arcSummary(points);
  const here = leaders(team.ref, season);
  const everyone = useMemo(() => {
    const seen = new Map<string, Tenure>();
    for (const y of years) for (const { tenure } of leaders(team.ref, y)) seen.set(`${tenure.person}-${tenure.firstSeason}`, tenure);
    return [...seen.values()].sort((a, b) => a.firstSeason - b.firstSeason);
  }, [team.ref, years]);
  const people = new Map(PRINCIPALS.people.map((p) => [p.ref, p]));
  const seasonLine = (tenure: Tenure) =>
    years
      .filter((y) => y >= tenure.firstSeason && y <= tenure.lastSeason)
      .map((y) => {
        const f = all[years.indexOf(y)];
        return f?.championship ? `${y}: ${ordinal(f.championship.position)}, ${f.championship.points} points` : `${y}`;
      })
      .join(" · ");

  return (
    <div className="page-in">
      <header className="relative overflow-hidden border-b border-line pt-[calc(var(--nav-h)+1.5rem)] pb-8">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <a href={href("/teams", { season })} className="crumbs">
            <Icon name="arrowLeft" size={16} /> <span className="sr-only">Back to </span>Teams
          </a>
          <div className="mt-5 flex items-center gap-4 sm:gap-6">
            <TeamBadge team={team} colour={colour} className="h-16 w-24 shrink-0 text-[0.95rem] sm:h-24 sm:w-36 sm:text-[1.4rem]" />
            <h1 className="display min-w-0 text-[3rem] sm:text-[5.4rem]">{team.name}</h1>
          </div>
          <p className="mt-3 max-w-[64ch] text-[1.05rem] leading-snug text-steel">
            In this site's data for {years.length === 1 ? String(years[0]) : `${years[0]} to ${years[years.length - 1]}`}.{" "}
            {here.length > 0 ? (
              <>
                In {season}, {here.map((l, i) => (
                  <span key={l.person.ref + l.tenure.firstSeason}>
                    {i > 0 ? (i === here.length - 1 ? " and " : ", ") : ""}
                    <span className="font-semibold text-ink">{l.person.name}</span>
                  </span>
                ))}{" "}
                led the team.
              </>
            ) : null}
          </p>
          {years.length > 1 ? (
            <div className="mt-5">
              <Tabs<string> value={String(season)} onChange={(v) => replaceQuery({ season: Number(v) })} idPrefix="team-season" label="Season" options={years.map((s) => ({ id: String(s), label: String(s) }))} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] space-y-6 px-4 pt-8 sm:px-6 lg:px-10">
        <Panel title={`${team.name} in ${season}`} tag="record">
          <p className="max-w-[74ch] text-[1.08rem] leading-relaxed text-ink">{teamSeasonText(team.name, facts, (id) => driverOf(id).last, previous)}</p>
          <div className="relative mt-6 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <caption className="sr-only">{team.name} drivers in {season}</caption>
              <thead>
                <tr className="border-b border-ink text-[0.85rem] text-steel">
                  <th className="py-2 pr-3 font-semibold">Driver</th>
                  <th className="py-2 pr-3 text-right font-semibold">Starts</th>
                  <th className="py-2 pr-3 text-right font-semibold">Wins</th>
                  <th className="py-2 pr-3 text-right font-semibold">Podiums</th>
                  <th className="py-2 text-right font-semibold">Points</th>
                </tr>
              </thead>
              <tbody>
                {facts.drivers.map((d) => {
                  const driver = driverOf(d.driverId);
                  const standing = standings[String(season)]?.drivers[String(d.driverId)];
                  const final = standing ? [...standing.pts].reverse().find((p) => p !== null) : null;
                  return (
                    <tr key={d.driverId} className="border-b border-line">
                      <th scope="row" className="py-2.5 pr-3 text-left">
                        <a href={href(`/drivers/${driver.ref}`, { season })} className="inline-block py-1 font-display text-[1.2rem] font-bold uppercase no-underline hover:underline">
                          {driver.name}
                        </a>
                      </th>
                      <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{d.starts}</td>
                      <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{d.wins}</td>
                      <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{d.podiums}</td>
                      <td className="py-2.5 text-right font-display text-[1.1rem] tabular-nums">{d.points !== null ? (final ?? d.points) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[0.85rem] text-mute">
            Starts, wins and podiums count only the races driven for {team.name}. A driver's points are shown only when every race of theirs that season was for this team.
          </p>
        </Panel>

        {summary ? (
          <Panel title="Championship, round by round" context={`${season}: the team's position after each race`} tag="record">
            <ArcChart
              points={points}
              colour={colour}
              label={`${team.name}: constructors' championship position after each round of ${season}. Best ${ordinal(summary.best.position!)} after round ${summary.best.round}, lowest ${ordinal(summary.worst.position!)} after round ${summary.worst.round}, finished ${ordinal(summary.last.position!)}.`}
              raceName={raceName}
            />
            <p className="mt-3 max-w-[74ch] text-[1rem] leading-snug text-steel">
              {summary.best.position === summary.worst.position
                ? `${team.name} was ${ordinal(summary.best.position!)} after every round.`
                : `The team's best place was ${ordinal(summary.best.position!)} after round ${summary.best.round}, the ${raceMeta(summary.best.raceId)?.name}, and the lowest was ${ordinal(summary.worst.position!)} after round ${summary.worst.round}. The season ended ${ordinal(summary.last.position!)}.`}
            </p>
          </Panel>
        ) : null}

        <Panel title={`Who ran ${team.name}`} tag="reference">
          <ul className="divide-y divide-line">
            {everyone.map((tenure) => {
              const person = people.get(tenure.person)!;
              const elsewhere = tenuresOfPerson(person.ref).filter((t) => t.constructor !== team.ref);
              const current = here.some((l: Leadership) => l.tenure === tenure);
              return (
                <li key={`${person.ref}-${tenure.firstSeason}`} className="py-4">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Flag code={person.flag} />
                    <span className="font-display text-[1.35rem] font-bold uppercase">{person.name}</span>
                    <span className="text-steel">{titleWords(tenure)}</span>
                    <span className="text-[0.88rem] text-mute">
                      {person.nationality} · {seasonSpan(tenure)} in the data
                    </span>
                    {current ? <span className="text-[0.85rem] font-semibold text-ink">in charge in {season}</span> : null}
                  </p>
                  {tenure.note ? <p className="mt-1 max-w-[74ch] text-[1rem] text-steel">{tenure.note}</p> : null}
                  <p className="mt-1.5 text-[0.95rem] text-steel">The team's results in {tenure.firstSeason === tenure.lastSeason ? "that season" : "those seasons"}: {seasonLine(tenure)}.</p>
                  {elsewhere.length > 0 ? (
                    <p className="mt-1 text-[0.9rem] text-mute">
                      Also led{" "}
                      {elsewhere.map((t, i) => {
                        const other = teamByReference(t.constructor);
                        return (
                          <span key={`${t.constructor}-${t.firstSeason}`}>
                            {i > 0 ? ", " : ""}
                            <a href={href(`/teams/${t.constructor}`, { season: t.firstSeason })} className="underline decoration-line2 underline-offset-2 hover:text-ink">
                              {other?.name ?? t.constructor}
                            </a>{" "}
                            ({seasonSpan(t)}, {titleWords(t)})
                          </span>
                        );
                      })}
                      .
                    </p>
                  ) : null}
                  <SourceLinks sources={tenure.sources} />
                </li>
              );
            })}
          </ul>
          <p className="mt-4 max-w-[78ch] text-[0.85rem] leading-snug text-mute">
            This is not part of the race dataset. It is a short reference list written by hand from the sources linked, last checked {longDate(PRINCIPALS.checked)}. Titles are given as they were published: they are not always "team principal".
          </p>
          <div className="mt-3">
            <Tag kind="reference" />
          </div>
        </Panel>

        <Panel title={`${team.name} season by season`} tag={["record", "reference"]}>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="sr-only">{team.name} in each season of the data</caption>
              <thead>
                <tr className="border-b border-ink text-[0.85rem] text-steel">
                  <th className="py-2 pr-3 font-semibold">Season</th>
                  <th className="py-2 pr-3 text-right font-semibold">Position</th>
                  <th className="py-2 pr-3 text-right font-semibold">Points</th>
                  <th className="py-2 pr-3 text-right font-semibold">Wins</th>
                  <th className="py-2 pr-3 text-right font-semibold">Podiums</th>
                  <th className="py-2 font-semibold">Led by</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y, i) => {
                  const f = all[i]!;
                  return (
                    <tr key={y} className={`border-b border-line ${y === season ? "bg-panel2" : ""}`}>
                      <th scope="row" className="py-2.5 pr-3 font-display text-[1.1rem] font-semibold">
                        {y === season ? <span aria-current="true">{y}</span> : <a href={href(`/teams/${team.ref}`, { season: y })} className="inline-block py-1 no-underline hover:underline">{y}</a>}
                      </th>
                      <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{f.championship ? ordinal(f.championship.position) : "–"}</td>
                      <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{f.championship?.points ?? "–"}</td>
                      <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{f.wins}</td>
                      <td className="py-2.5 pr-3 text-right font-display text-[1.1rem] tabular-nums">{f.podiums}</td>
                      <td className="py-2.5 text-[0.95rem] text-steel">{leaders(team.ref, y).map((l) => l.person.name).join(" and ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

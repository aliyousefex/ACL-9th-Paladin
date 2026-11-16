import { useEffect, useMemo, useState } from "react";
import { Note, Tabs } from "../../components/Bits";
import { Icon } from "../../components/Icon";
import { Panel } from "../../components/Panel";
import { ShareCard, useCopy } from "../../components/ShareCard";
import { entriesByRace } from "../../lib/atlas";
import { leagueCardSpec, leagueShareText } from "../../lib/card";
import { hasBeenRevealed, readChallenge } from "../../lib/challenge";
import { DRIVERS, RACES, driver, raceHref } from "../../lib/data";
import { useTitle } from "../../lib/hooks";
import { MIN_RACES, duel, playsFrom, summariseLeague, type Standing } from "../../lib/league";
import { href, replaceQuery } from "../../lib/router";
import { decodeCode, encodeCode, sanitiseNickname } from "../../lib/shareCode";

type Scope = "all" | "2022" | "2023" | "2024";
const NICKNAME_KEY = "paladin:nickname";
const raceYear = new Map(RACES.map((race) => [race.id, race.year]));

const readNickname = (): string => {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? "";
  } catch {
    return "";
  }
};

const perRace = (total: number, played: number) => (played ? (total / played).toFixed(2) : "–");
const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}`;
const WORD: Record<Standing, string> = { ahead: "Ahead", level: "Level", behind: "Behind" };
const TONE: Record<Standing, string> = { ahead: "text-hit", level: "text-steel", behind: "text-signal-text" };

export function LeaguePage({ query }: { query: URLSearchParams }) {
  useTitle("Season league", "Call each race's podium blind and see whether you can out-score Paladin and the starting grid. Everything stays in your browser.");
  const scope: Scope = (["2022", "2023", "2024"] as string[]).includes(query.get("season") ?? "") ? (query.get("season") as Scope) : "all";

  // Picks live in this browser; re-read them whenever one changes, here or in another tab.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener("paladin:challenge", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("paladin:challenge", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const [nameText, setNameText] = useState(readNickname);
  const nickname = sanitiseNickname(nameText);
  useEffect(() => {
    try {
      localStorage.setItem(NICKNAME_KEY, nickname);
    } catch {
      /* the name then lasts for this visit only */
    }
  }, [nickname]);

  const { plays, notCounted } = useMemo(() => playsFrom(readChallenge, RACES), [version]);
  const shown = useMemo(() => (scope === "all" ? plays : plays.filter((play) => raceYear.get(play.raceId) === Number(scope))), [plays, scope]);
  const league = useMemo(() => summariseLeague(RACES, shown), [shown]);
  const code = useMemo(() => encodeCode(nickname, plays), [nickname, plays]);
  const callable = useMemo(
    () => RACES.filter((race) => (scope === "all" || race.year === Number(scope)) && !hasBeenRevealed(race.id) && readChallenge(race.id)?.blind !== true),
    [scope, version],
  );
  const next = callable[0];

  const [codeStatus, copy] = useCopy();
  const setScope = (next: Scope) => replaceQuery({ season: next === "all" ? undefined : next, vs: query.get("vs") ?? undefined });

  const scopeLabel = scope === "all" ? "all seasons" : scope;
  const spec = useMemo(() => leagueCardSpec(league, nickname, scopeLabel), [league, nickname, scopeLabel]);
  const here = `${window.location.origin}${window.location.pathname}`;

  return (
    <div className="page-in">
      <header className="border-b border-line pt-[calc(var(--nav-h)+2rem)] pb-8">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <h1 className="display text-[3rem] sm:text-[4.8rem]">Can you out-call the model?</h1>
          <p className="mt-4 max-w-[66ch] text-[1.1rem] leading-relaxed text-steel">
            Call the podium before the reveal, race after race. Your names are counted the way Paladin's are, on the same races, and a verdict appears only when there are enough races to support one. Everything stays in your browser; a short code lets you compare with a friend.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] space-y-6 px-4 pt-8 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs<Scope>
            value={scope}
            onChange={setScope}
            idPrefix="league-scope"
            label="Season"
            options={[{ id: "all", label: "All" }, { id: "2022", label: "2022" }, { id: "2023", label: "2023" }, { id: "2024", label: "2024" }]}
          />
          <p className="text-[0.92rem] text-mute">
            {callable.length} {callable.length === 1 ? "race" : "races"} you can still call blind
            {next && (
              <>
                {" · "}
                <a className="text-ink underline decoration-line2 underline-offset-2" href={href(raceHref(next))}>Call {next.name.replace(" Grand Prix", "")} {next.year}</a>
              </>
            )}
          </p>
        </div>

        {/* ------------------------------------------------------------ scoreboard */}
        <Panel context={`${league.played} ${league.played === 1 ? "race" : "races"} called blind · ${scopeLabel}`} title="Your season against Paladin and the grid" tag="user">
          {league.played === 0 ? (
            <div className="max-w-[62ch]">
              <p className="text-[1.05rem] leading-relaxed text-steel">
                Nothing counts yet. Open a race, choose your three before you press reveal, and lock them. Picks made after the result has been shown never count, so what is here is a fair record.
              </p>
              {next && (
                <a className="btn mt-5" href={href(raceHref(next))}>
                  Call {next.name.replace(" Grand Prix", "")} {next.year} <Icon name="arrowRight" size={16} />
                </a>
              )}
              {notCounted > 0 && <p className="mt-4 text-[0.9rem] text-mute">{notCounted} earlier {notCounted === 1 ? "pick was" : "picks were"} made after the result was visible, so {notCounted === 1 ? "it does" : "they do"} not count.</p>}
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-3">
                {[
                  { label: nickname || "You", value: perRace(league.you, league.played), total: league.you, strong: true },
                  { label: "Paladin", value: perRace(league.paladin, league.played), total: league.paladin, strong: false },
                  { label: "Starting grid", value: perRace(league.grid, league.played), total: league.grid, strong: false },
                ].map((cell) => (
                  <div key={cell.label} className="bg-tower px-5 py-5">
                    <dt className="label">{cell.label}</dt>
                    <dd className={`figure mt-2 text-[3.4rem] ${cell.strong ? "" : "text-steel"}`}>{cell.value}</dd>
                    <dd className="mt-1 text-[0.88rem] text-mute">podium names per race · {cell.total} in all</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 space-y-3 text-[1.02rem] leading-relaxed text-steel">
                {league.interval ? (
                  <p>
                    <span className="font-semibold text-ink">On these {league.played} races you are {league.verdict}.</span> The difference is {signed(league.interval.mean)} names per race, with a 95% interval of {signed(league.interval.lower)} to {signed(league.interval.upper)}.
                    {league.verdict === "level with Paladin" && " That interval includes zero, so this record cannot separate you from the model."}
                  </p>
                ) : (
                  <p>
                    <span className="font-semibold text-ink">Too few races to say who is ahead.</span> The league gives a verdict from {MIN_RACES} races, because a few races can swing either way. Until then, these are just numbers.
                  </p>
                )}
                <p>
                  Against Paladin you were ahead in {league.vsPaladin.ahead}, level in {league.vsPaladin.level} and behind in {league.vsPaladin.behind}. Against the starting grid: ahead in {league.vsGrid.ahead}, level in {league.vsGrid.level}, behind in {league.vsGrid.behind}.
                </p>
                <p>
                  On average {league.copying.paladin.toFixed(1)} of your three names were also Paladin's top three, and {league.copying.grid.toFixed(1)} were the grid's.
                  {league.copying.paladin >= 2.5 && " That is close to copying Paladin's call, and a score that close to Paladin's says little about you."}
                </p>
              </div>
            </>
          )}
        </Panel>

        {/* ------------------------------------------------------------ races */}
        {league.played > 0 && (
          <Panel context="Every counted race, oldest first" title="Your calls" tag={["user", "record"]}>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left">
                <caption className="sr-only">Each race you called blind, what you picked, and how you, Paladin and the grid scored</caption>
                <thead>
                  <tr className="border-b border-line2 text-[0.82rem] text-mute">
                    <th scope="col" className="py-2 pr-4 font-semibold">Race</th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Your three</th>
                    <th scope="col" className="py-2 pr-4 text-right font-semibold">You</th>
                    <th scope="col" className="py-2 pr-4 text-right font-semibold">Paladin</th>
                    <th scope="col" className="py-2 pr-4 text-right font-semibold">Grid</th>
                    <th scope="col" className="py-2 font-semibold">Against Paladin</th>
                  </tr>
                </thead>
                <tbody>
                  {[...league.lines].reverse().map((line) => (
                    <tr key={line.race.id} className="border-b border-line align-top">
                      <th scope="row" className="py-3 pr-4 font-normal">
                        <a className="block font-display text-[1.1rem] leading-tight font-semibold uppercase text-ink no-underline hover:underline" href={href(raceHref(line.race))}>{line.race.name.replace(" Grand Prix", "")} {line.race.year}</a>
                      </th>
                      <td className="py-3 pr-4">
                        <span className="flex flex-wrap gap-1.5">
                          {line.picks.map((id) => {
                            const on = line.race.actual.includes(id);
                            return (
                              <span key={id} className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-display text-[0.95rem] font-semibold ${on ? "border-hit/50 text-hit" : "border-line2 text-mute"}`}>
                                <Icon name={on ? "check" : "cross"} size={12} strokeWidth={2.8} />
                                {driver(id).code}
                                <span className="sr-only">{on ? ", on the podium" : ", off the podium"}</span>
                              </span>
                            );
                          })}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right figure text-[1.2rem]">{line.you}/3</td>
                      <td className="py-3 pr-4 text-right figure text-[1.2rem] text-steel">{line.paladin}/3</td>
                      <td className="py-3 pr-4 text-right figure text-[1.2rem] text-steel">{line.grid}/3</td>
                      <td className={`py-3 font-display text-[1rem] font-semibold tracking-wide uppercase ${TONE[line.vsPaladin]}`}>{WORD[line.vsPaladin]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {/* ------------------------------------------------------------ share */}
        <Panel context="Send your season to a friend, or post it" title="Share" tag="user">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="min-w-0">
              <label className="block">
                <span className="label">Your name on the card and in the code (optional)</span>
                <input
                  value={nameText}
                  onChange={(event) => setNameText(event.target.value.slice(0, 24))}
                  placeholder="Up to 16 letters and numbers"
                  autoComplete="off"
                  className="mt-1 min-h-11 w-full max-w-[22rem] border border-control bg-panel px-3 text-[1rem] text-ink placeholder:text-mute focus:border-ink focus:outline-none"
                />
              </label>
              <p className="label mt-6">Your code</p>
              <textarea readOnly rows={4} value={code} aria-label="Your league code" onFocus={(event) => event.currentTarget.select()} className="mt-1 w-full resize-none border border-control bg-panel p-3 font-mono text-[0.8rem] break-all text-steel focus:border-ink focus:outline-none" />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" className="btn !min-h-11" disabled={plays.length === 0} onClick={() => copy(code, "Code copied.")}>Copy code</button>
                <button type="button" className="btn btn-ghost !min-h-11" disabled={plays.length === 0} onClick={() => copy(`${here}#/league?vs=${code}`, "Challenge link copied.")}>Copy challenge link</button>
                <span className="text-[0.9rem] text-mute" role="status" aria-live="polite">{codeStatus}</span>
              </div>
              <p className="mt-3 max-w-[52ch] text-[0.9rem] leading-snug text-mute">
                The code holds your name and your counted picks for every season, whichever tab is open. A friend who opens the link sees the two of you side by side.
              </p>
            </div>
            <div className="min-w-0">
              {league.played > 0 ? <ShareCard spec={spec} text={leagueShareText(league, nickname, `${here}#/league`)} /> : <p className="text-steel">Call a race blind and your season card appears here.</p>}
            </div>
          </div>
        </Panel>

        <Compare query={query} mine={plays} />

        {/* ------------------------------------------------------------ rules */}
        <Panel context="What the league does and does not prove" title="How it stays fair" tag="record">
          <ul className="grid gap-x-10 gap-y-4 text-[0.98rem] leading-snug text-steel md:grid-cols-2">
            <li><strong className="text-ink">Blind picks only.</strong> A pick counts when it was locked while the result was hidden, in a browser that had never shown that race's result. A pick made after seeing it is practice.</li>
            <li><strong className="text-ink">Final once revealed.</strong> After you reveal a counted pick, it cannot be changed or redone.</li>
            <li><strong className="text-ink">Same races, same rule.</strong> Paladin and the grid are scored on exactly the races you called, with one point for each of the three names who finished on the podium, in any order.</li>
            <li><strong className="text-ink">No verdict on a handful of races.</strong> "Ahead" or "behind" appears from {MIN_RACES} races, and only when a resampled interval excludes zero. Otherwise the page says it cannot tell.</li>
            <li><strong className="text-ink">It is an honor system.</strong> Paladin's call is on the race page, so a player can copy it (the copying line above shows how often that happened), and results are visible elsewhere on the site. Codes carry a checksum that catches typos and edits, not a signature, so anyone can make a valid one by hand.</li>
            <li><strong className="text-ink">Not model evaluation.</strong> This is a game. The model's honest evaluation is on the Error Atlas and the Research page.</li>
          </ul>
          {notCounted > 0 && league.played > 0 && <div className="mt-5"><Note>{notCounted} stored {notCounted === 1 ? "pick is" : "picks are"} not counted: made after the result was visible, or before this rule existed.</Note></div>}
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ against a friend's code */

function Compare({ query, mine }: { query: URLSearchParams; mine: { raceId: number; picks: number[] }[] }) {
  const incoming = query.get("vs") ?? "";
  const [text, setText] = useState(incoming);
  // A challenge link fills the box. Depend on the string, not the query object, which is new on every route change.
  useEffect(() => {
    if (incoming) setText(incoming);
  }, [incoming]);
  const field = useMemo(() => entriesByRace(RACES, DRIVERS), []);
  const fieldOf = (raceId: number) => field.get(raceId)?.map((entry) => entry.driverId);
  const decoded = useMemo(() => (text.trim() ? decodeCode(text, fieldOf) : null), [text]); // eslint-disable-line react-hooks/exhaustive-deps
  const result = useMemo(() => (decoded?.ok ? duel(RACES, mine, decoded.value.plays) : null), [decoded, mine]);
  const them = decoded?.ok ? decoded.value.nickname || "Your friend" : "";

  return (
    <Panel context="Paste a friend's code, or open their link" title="Compare with a friend" tag="user">
      <label className="block">
        <span className="label">Their code</span>
        <textarea
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="PAL1-…"
          aria-describedby="compare-help"
          className="mt-1 w-full resize-none border border-control bg-panel p-3 font-mono text-[0.8rem] break-all text-ink placeholder:text-mute focus:border-ink focus:outline-none"
        />
      </label>
      <div aria-live="polite" id="compare-help" className="mt-4">
        {decoded && !decoded.ok && <p className="border-l-2 border-amber py-1 pl-3 text-steel">{decoded.reason}</p>}
        {decoded?.ok && result && (
          <div className="space-y-3 text-[1.02rem] leading-relaxed text-steel">
            {result.races.length === 0 ? (
              <p>
                {them} has called {decoded.value.plays.length} {decoded.value.plays.length === 1 ? "race" : "races"}, but none that you have called blind. Call the same races to compare.
              </p>
            ) : (
              <>
                <p className="font-display text-[1.5rem] leading-tight font-semibold text-ink">
                  You and {them} on the {result.races.length} {result.races.length === 1 ? "race" : "races"} you both called
                </p>
                <dl className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
                  {[["You", result.you], [them, result.them], ["Paladin", result.paladin], ["Starting grid", result.grid]].map(([label, total]) => (
                    <div key={String(label)} className="bg-tower px-4 py-3">
                      <dt className="label truncate">{label}</dt>
                      <dd className="figure mt-1 text-[2rem]">{perRace(Number(total), result.races.length)}</dd>
                      <dd className="text-[0.82rem] text-mute">names per race</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  You were ahead of {them} in {result.record.ahead}, level in {result.record.level} and behind in {result.record.behind}.
                  {decoded.value.plays.length > result.races.length && ` ${decoded.value.plays.length - result.races.length} of their races are ones you have not called, and are left out.`}
                </p>
              </>
            )}
            <p className="text-[0.88rem] text-mute">This code has a checksum, not a signature: it shows the picks are intact, not that they were made blind.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

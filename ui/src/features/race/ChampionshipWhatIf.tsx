import { useEffect, useMemo, useState } from "react";
import { Panel } from "../../components/Panel";
import { driver, standings, type RaceMeta } from "../../lib/data";
import { swapChampionshipPoints } from "./championship";
import type { Row } from "./rows";

const PLACE_POINTS = [25, 18, 15] as const;

export function ChampionshipWhatIf({ race, rows }: { race: RaceMeta; rows: Row[] }) {
  const [place, setPlace] = useState(1);
  const occupant = rows.find((row) => row.finish === place);
  const candidates = rows.filter((row) => row.driver.id !== occupant?.driver.id);
  const [challengerId, setChallengerId] = useState(candidates[0]?.driver.id ?? 0);

  useEffect(() => {
    if (!candidates.some((row) => row.driver.id === challengerId)) setChallengerId(candidates[0]?.driver.id ?? 0);
  }, [challengerId, candidates]);

  const season = standings[String(race.year)];
  const original = useMemo(() => {
    if (!season) return [];
    return Object.entries(season.drivers)
      .map(([id, line]) => {
        const finalPoints = [...line.pts].reverse().find((value) => value !== null);
        const finalRank = [...line.pos].reverse().find((value) => value !== null);
        return finalPoints === undefined || finalRank === undefined ? null : { id: Number(id), points: finalPoints, originalRank: finalRank };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.originalRank - b.originalRank);
  }, [season]);

  const challenger = rows.find((row) => row.driver.id === challengerId);
  const challengerRacePoints = challenger?.entry.pts ?? 0;
  const occupantRacePoints = occupant?.entry.pts ?? PLACE_POINTS[place - 1] ?? 0;
  const alternate = occupant
    ? swapChampionshipPoints(original, challengerId, occupant.driver.id, challengerRacePoints, occupantRacePoints)
    : [];
  const changedIds = new Set([challengerId, occupant?.driver.id]);

  return (
    <Panel eyebrow="Rewrite one chequered flag" title="Alternate championship" tag="simulation">
      <p className="max-w-[75ch] text-steel">
        Put a different driver in one podium place and see how transferring the two drivers' recorded race points changes the final {race.year} standings.
      </p>

      <div className="mt-6 grid gap-4 border-y border-line py-5 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="label">Podium place to rewrite</span>
          <select className="field" value={place} onChange={(event) => setPlace(Number(event.target.value))}>
            <option value={1}>1st — {PLACE_POINTS[0]} base points</option>
            <option value={2}>2nd — {PLACE_POINTS[1]} base points</option>
            <option value={3}>3rd — {PLACE_POINTS[2]} base points</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className="label">Driver taking the place</span>
          <select className="field" value={challengerId} onChange={(event) => setChallengerId(Number(event.target.value))}>
            {candidates.map((row) => <option key={row.driver.id} value={row.driver.id}>{row.driver.name} — actually {row.finish ?? row.entry.txt}</option>)}
          </select>
        </label>
      </div>

      {occupant && challenger && (
        <div className="mt-5 grid gap-px bg-line sm:grid-cols-2">
          {[challengerId, occupant.driver.id].map((id) => {
            const result = alternate.find((standing) => standing.id === id);
            if (!result) return null;
            const person = driver(id);
            return (
              <div key={id} className="bg-panel p-5">
                <p className="font-display text-[1.3rem] font-bold uppercase">{person.name}</p>
                <p className="mt-3 figure text-[2rem]">P{result.originalRank} <span className="text-signal" aria-hidden>→</span> P{result.rank}</p>
                <p className="mt-1 text-steel">{result.points.toFixed(0)} season points <span className={result.pointsDelta >= 0 ? "text-good" : "text-signal-text"}>({result.pointsDelta >= 0 ? "+" : ""}{result.pointsDelta})</span></p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <caption className="sr-only">Alternate top ten final driver standings</caption>
          <thead><tr className="border-b border-line text-mute"><th className="py-2 pr-3 label">Rank</th><th className="py-2 pr-3 label">Driver</th><th className="py-2 text-right label">Points</th></tr></thead>
          <tbody>{alternate.slice(0, 10).map((standing) => (
            <tr key={standing.id} className={`border-b border-line/70 ${changedIds.has(standing.id) ? "bg-signal/10" : ""}`}>
              <td className="py-3 pr-3 figure">{standing.rank}{standing.rankDelta !== 0 && <span className="ml-2 text-[0.78rem] text-steel">{standing.rankDelta > 0 ? `+${standing.rankDelta}` : standing.rankDelta}</span>}</td>
              <td className="py-3 pr-3 font-semibold">{driver(standing.id).name}</td>
              <td className="py-3 text-right figure">{standing.points.toFixed(0)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <p className="mt-5 border-l-2 border-signal pl-4 text-[0.88rem] leading-relaxed text-mute">
        Synthetic counterfactual: this swaps the actual points earned by two drivers in this race, including any bonuses already recorded. It does not change later race behaviour, sprint results, or apply FIA countback tiebreakers.
      </p>
    </Panel>
  );
}

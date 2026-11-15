import { useMemo } from "react";
import { ShareCard } from "../../components/ShareCard";
import { driver, type RaceMeta } from "../../lib/data";
import { raceCardSpec, raceShareText, type RaceCardInput } from "../../lib/card";

/** Build the card input from ids. Everything on it is known once the result has been revealed. */
export function raceCardInput(race: RaceMeta, picks: readonly number[]): RaceCardInput {
  const mark = (ids: readonly number[]) => ids.map((id) => ({ code: driver(id).code, onPodium: race.actual.includes(id) }));
  return { raceName: race.name, year: race.year, slug: race.slug, picks: mark(picks), paladin: mark(race.predicted), grid: mark(race.baseline), actual: race.actual.map((id) => driver(id).code) };
}

/** After the reveal, for a pick that was locked blind: the three scores as an image and as text. */
export function ShareRace({ race, picks }: { race: RaceMeta; picks: readonly number[] }) {
  const input = useMemo(() => raceCardInput(race, picks), [race, picks]);
  const spec = useMemo(() => raceCardSpec(input), [input]);
  const url = `${window.location.origin}${window.location.pathname}#/race/${race.year}/${race.slug}`;
  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="label">Share this call</p>
      <div className="mt-3 max-w-[40rem]">
        <ShareCard spec={spec} text={raceShareText(input, url)} />
      </div>
    </div>
  );
}

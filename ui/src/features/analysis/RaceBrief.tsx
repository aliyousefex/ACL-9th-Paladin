import { useMemo, type ReactNode } from "react";
import { ErrorNote, LightsLoader } from "../../components/Bits";
import { Icon } from "../../components/Icon";
import { Tag, type Provenance } from "../../components/Provenance";
import { loadRace, useResource, type RaceMeta } from "../../lib/data";
import { describeFalseAlarm, describeMiss } from "../../lib/atlas";
import { featureLabel, signed } from "../../lib/format";
import { THRESHOLD } from "../../lib/model";
import { autopsy, ordinal, type AutopsyCase } from "../race/autopsyModel";
import { buildRows } from "../race/rows";

/**
 * One race, taken apart in five questions. Questions 1 and 2 use only what the model had before the start
 * (its score and the inputs behind it); 3 and 4 use the classification. Question 4 describes what the
 * pre-race record shows; it never claims a cause, and the page says so.
 */
export function RaceBrief({ race }: { race: RaceMeta }) {
  const state = useResource(`atlas-${race.id}`, () => loadRace(race.id));
  const result = useMemo(() => (state.data ? autopsy(buildRows(state.data, race.year), race.baseline, THRESHOLD) : null), [state.data, race]);

  if (state.error) return <ErrorNote title="Could not load this race" detail={state.error.message} />;
  if (!result) return <LightsLoader label="Opening the race file" />;

  const picks = [...result.modelTop, ...result.misses];
  const wrong = picks.filter((item) => item.kind !== "hit");

  return (
    <div className="border-t border-line bg-panel px-4 py-2 sm:px-6">
      <ol className="divide-y divide-line">
        <Question n={1} title="What did the model know?" tag="model">
          <ul className="space-y-3">
            {picks.map((item) => (
              <li key={item.row.driver.id}>
                <p className="text-[1.02rem] text-ink">
                  <strong className="font-display uppercase">{item.row.driver.last}</strong>{" "}
                  <span className="text-steel">
                    scored {item.score.toFixed(2)}, ranked {ordinal(item.modelRank)} of {race.drivers}
                  </span>
                </p>
                <Known item={item} />
              </li>
            ))}
          </ul>
        </Question>

        <Question n={2} title="What did it predict?" tag="model">
          <p className="text-steel">
            Top three: {result.modelTop.map((item) => `${item.row.driver.code} ${item.score.toFixed(2)}`).join(" · ")}. {result.statements.cutoff}
          </p>
        </Question>

        <Question n={3} title="What actually happened?" tag="record">
          <p className="text-ink">{result.statements.verdict}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {result.podium.map((p) => (
              <li key={p.row.driver.id} className="flex items-center gap-2 border border-line bg-tower px-3 py-2">
                <span className="figure text-[1.4rem]">P{p.finish}</span>
                <span className="min-w-0 flex-1 truncate font-display uppercase">{p.row.driver.last}</span>
                <span className={`flex items-center gap-1 text-[0.82rem] font-semibold ${p.inTop ? "text-hit" : "text-signal-text"}`}>
                  <Icon name={p.inTop ? "check" : "cross"} size={14} strokeWidth={2.6} />
                  {p.inTop ? "picked" : `ranked ${ordinal(p.modelRank)}`}
                </span>
              </li>
            ))}
          </ul>
        </Question>

        <Question n={4} title="Was it knowable at the cutoff?" tag="record">
          {wrong.length === 0 ? (
            <p className="text-steel">There is nothing to explain: all three of Paladin's picks reached the podium.</p>
          ) : (
            <ul className="space-y-3">
              {wrong.map((item) => {
                const described = item.kind === "miss" ? describeMiss({ rank: item.modelRank, grid: item.grid }) : describeFalseAlarm({ txt: item.row.entry.txt, finish: item.finish ?? 99 });
                return (
                  <li key={item.row.driver.id} className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                    <p className="font-display uppercase text-ink">
                      {item.row.driver.last} <span className="block text-[0.78rem] font-semibold tracking-wide text-mute normal-case">{item.kind === "miss" ? "left out, finished on the podium" : "picked, missed the podium"}</span>
                    </p>
                    <p className="text-steel">
                      <span className="mr-2 border border-line2 px-1.5 py-0.5 font-display text-[0.78rem] font-semibold tracking-wide text-ink uppercase">{described.kind}</span>
                      {described.detail} {item.kind !== "miss" && item.didNotFinish && <span className="text-mute">{item.aftermath}.</span>}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[0.88rem] text-mute">
            These labels read the pre-race record and the classification. They do not say why a race went the way it did, and they do not claim that a result could have been avoided.
          </p>
        </Question>

        <Question n={5} title="What was outside the data?" tag="record">
          <p className="text-steel">
            The 16 inputs are the grid, qualifying, recent form and the standings. The model never sees weather, tyre choice and strategy, safety cars, or incidents during the race, so none of those can be weighed here.
          </p>
          {picks.some((item) => imputed(item) > 0) && (
            <p className="mt-2 text-steel">
              Some inputs were missing and filled with the training median:{" "}
              {picks
                .filter((item) => imputed(item) > 0)
                .map((item) => `${item.row.driver.last} (${imputed(item)} of 16)`)
                .join(", ")}
              .
            </p>
          )}
        </Question>
      </ol>
    </div>
  );
}

function imputed(item: AutopsyCase): number {
  return item.row.entry.x.filter((value) => value === null || value === undefined).length;
}

function Known({ item }: { item: AutopsyCase }) {
  const start = item.grid ? `P${item.grid}` : "the pit lane";
  return (
    <p className="mt-0.5 text-[0.95rem] text-mute">
      Started {start}.{" "}
      {item.reasons.length > 0 ? (
        <>
          {item.kind === "miss" ? "Held back by" : "Lifted by"}{" "}
          {item.reasons.map((reason, i) => (
            <span key={reason.feature}>
              {i > 0 && ", "}
              {featureLabel(reason.feature).toLowerCase()} <span className="font-display font-semibold text-steel tabular-nums">{signed(reason.delta)}</span>
            </span>
          ))}{" "}
          against the average car on this grid.
        </>
      ) : (
        "No single input stands out from the field."
      )}
    </p>
  );
}

function Question({ n, title, tag, children }: { n: number; title: string; tag: Provenance; children: ReactNode }) {
  return (
    <li className="grid gap-3 py-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
      <div>
        <p className="flex items-baseline gap-3">
          <span className="figure text-[1.6rem] text-signal-text">{n}</span>
          <span className="font-display text-[1.25rem] leading-tight font-semibold">{title}</span>
        </p>
        <div className="mt-2">
          <Tag kind={tag} />
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

import { Icon } from "../../components/Icon";
import { Note } from "../../components/Bits";
import { Panel } from "../../components/Panel";
import type { RaceMeta } from "../../lib/data";
import { featureLabel, signed } from "../../lib/format";
import { THRESHOLD } from "../../lib/model";
import { autopsy, ordinal, type AutopsyCase } from "./autopsyModel";
import { PLACE_COLOURS, type Row } from "./rows";

const KIND = {
  hit: { label: "Hit", detail: "In Paladin's top three and on the podium", good: true },
  "false-alarm": { label: "False alarm", detail: "In Paladin's top three, not on the podium", good: false },
  miss: { label: "Missed", detail: "On the podium, outside Paladin's top three", good: false },
} as const;

/**
 * After the flag: what Paladin ranked correctly and incorrectly. Each card keeps the two kinds of evidence apart:
 * "Before the start" is the model's score and the pre-race inputs behind it; "After the flag" is the classification.
 */
export function Autopsy({ race, rows }: { race: RaceMeta; rows: Row[] }) {
  const result = autopsy(rows, race.baseline, THRESHOLD);

  return (
    <Panel eyebrow="Step 3 · After the flag" title="What Paladin got right and wrong" tag={["model", "record"]}>
      <p className="max-w-[72ch] text-[1.15rem] leading-snug text-ink">{result.statements.verdict}</p>

      <section className="mt-6" aria-labelledby="autopsy-podium">
        <h3 id="autopsy-podium" className="label">
          The podium, and where Paladin had ranked each driver
        </h3>
        <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {result.podium.map((p) => (
            <li key={p.row.driver.id} className="flex items-center gap-3 border border-line bg-tower px-3 py-3" style={{ borderTop: `3px solid ${PLACE_COLOURS[p.finish - 1] ?? "var(--color-steel)"}` }}>
              <span className="figure text-[2rem]" style={{ color: PLACE_COLOURS[p.finish - 1] }} aria-label={`Finished ${ordinal(p.finish)}`}>
                P{p.finish}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[1.2rem] leading-none font-bold uppercase">{p.row.driver.last}</span>
                <span className="mt-1 block text-[0.85rem] text-mute">Paladin ranked {ordinal(p.modelRank)}</span>
              </span>
              <span className={`flex shrink-0 items-center gap-1 text-[0.85rem] font-semibold ${p.inTop ? "text-hit" : "text-signal-text"}`}>
                <Icon name={p.inTop ? "check" : "cross"} size={15} strokeWidth={2.6} />
                {p.inTop ? "in top three" : "outside"}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8" aria-labelledby="autopsy-top">
        <h3 id="autopsy-top" className="label">
          Paladin's top three
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {result.modelTop.map((c) => (
            <li key={c.row.driver.id}>
              <CaseCard item={c} field={rows.length} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="autopsy-miss">
        <h3 id="autopsy-miss" className="label">
          Podium finishers outside Paladin's top three
        </h3>
        {result.misses.length === 0 ? (
          <p className="mt-3 text-steel">None. Every podium finisher was in Paladin's top three.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {result.misses.map((c) => (
              <li key={c.row.driver.id}>
                <CaseCard item={c} field={rows.length} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 border-t border-line pt-5" aria-labelledby="autopsy-cutoff">
        <h3 id="autopsy-cutoff" className="label">
          The whole field at the {THRESHOLD.toFixed(3)} cutoff
        </h3>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
          <Fact label="Predicted to podium" value={result.cutoff.above} note={result.cutoff.above === 1 ? "driver scored at or above the cutoff" : "drivers scored at or above the cutoff"} />
          <Fact label="Of those, on the podium" value={`${result.cutoff.aboveOnPodium}/${result.cutoff.above}`} note="how many of the predicted podium drivers made it" />
          <Fact label="Podium finishers above it" value={`${result.cutoff.podiumAbove}/${result.cutoff.podium}`} note="how many of the real podium the cutoff caught" />
        </dl>
      </section>

      {result.statements.retirements && <p className="mt-6 border-l-2 border-line2 pl-3 text-[0.98rem] text-steel">{result.statements.retirements}</p>}

      <div className="mt-5 space-y-2">
        <Note>
          "Before the start" shows only the model's score and its pre-race inputs. Each input's figure is its contribution to the log-odds minus the average for the
          same input across every car on this grid, so +0.40 means it lifts this driver 0.40 above a typical car. These are associations in a fitted model, not causes,
          and nothing here explains why a race went the way it did. "After the flag" is the classification.
        </Note>
      </div>
    </Panel>
  );
}

function CaseCard({ item, field }: { item: AutopsyCase; field: number }) {
  const kind = KIND[item.kind];
  const { row } = item;
  return (
    <article className="flex h-full flex-col border border-line bg-tower p-4" style={{ borderTop: `3px solid ${row.colour}` }}>
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[1.35rem] leading-none font-bold uppercase">{row.driver.name}</p>
          <p className="mt-1 text-[0.85rem] text-mute">{row.team.short}</p>
        </div>
        <p className={`flex shrink-0 items-center gap-1 font-display text-[0.95rem] font-bold tracking-[0.08em] uppercase ${kind.good ? "text-hit" : "text-signal-text"}`}>
          <Icon name={kind.good ? "check" : "cross"} size={16} strokeWidth={2.6} />
          {kind.label}
        </p>
      </header>
      <p className="mt-1 text-[0.8rem] text-mute">{kind.detail}</p>

      <div className="mt-4">
        <p className="label !text-[0.72rem] !text-signal-text">Before the start</p>
        <p className="mt-1 text-[0.98rem] text-steel">
          Ranked {ordinal(item.modelRank)} of {field}, score <span className="font-semibold text-ink tabular-nums">{item.score.toFixed(2)}</span>
          {item.aboveCutoff ? ", above" : ", below"} the cutoff. Started {item.grid ? `P${item.grid}` : "from the pit lane"}.
        </p>
        <p className="label mt-3 !text-[0.72rem]">{item.kind === "miss" ? "Held back by" : "Lifted by"}</p>
        {item.reasons.length === 0 ? (
          <p className="mt-1 text-[0.9rem] text-mute">No single input stands out from the field.</p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-[0.92rem]">
            {item.reasons.map((reason) => (
              <li key={reason.feature} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-steel">{featureLabel(reason.feature)}</span>
                <span className="shrink-0 font-display font-semibold tabular-nums">{signed(reason.delta)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <p className="label !text-[0.72rem] !text-steel">After the flag</p>
        <p className="mt-1 text-[0.98rem] font-semibold text-ink">{item.aftermath}</p>
        {item.didNotFinish && item.kind !== "miss" && (
          <p className="mt-1 text-[0.85rem] text-mute">None of the model's 16 inputs measures reliability, so this was outside what it could see.</p>
        )}
      </div>
    </article>
  );
}

function Fact({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="figure mt-1.5 text-[2.2rem]">{value}</dd>
      <dd className="mt-1 text-[0.88rem] leading-snug text-mute">{note}</dd>
    </div>
  );
}

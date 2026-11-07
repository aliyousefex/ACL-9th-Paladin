import { Panel } from "../../components/Panel";
import { featureLabel, signed } from "../../lib/format";
import { biggestMoves, explainMove, gridStory, type Direction, type GridMove } from "./explain";
import type { Row } from "./rows";

const COPY: Record<Direction, { title: string; lead: string; empty: string; because: string }> = {
  up: {
    title: "Promoted",
    lead: "Ranked above their grid slot",
    empty: "Paladin ranks nobody above their grid slot in this race.",
    because: "Lifted by",
  },
  down: {
    title: "Demoted",
    lead: "Ranked below their grid slot",
    empty: "Paladin ranks nobody below their grid slot in this race.",
    because: "Held back by",
  },
};

/** Where the model's order departs from the starting grid, with the inputs that account for each move. */
export function GridRebels({ rows, revealed }: { rows: Row[]; revealed: boolean }) {
  return (
    <Panel eyebrow="Where the model adds an opinion" title="Grid rebels" tag="model">
      <p className="max-w-[72ch] text-steel">
        Qualifying is a formidable baseline, so the grid is the comparison. These are the drivers Paladin moves furthest from their starting-grid rank,
        and the inputs that account for the move.
      </p>
      <ul className="mt-4 space-y-1 border-l-2 border-signal pl-4 text-[0.98rem] text-ink" aria-label="Paladin against the starting grid">
        {gridStory(rows).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
        {(["up", "down"] as const).map((direction) => (
          <Column key={direction} direction={direction} rows={rows} revealed={revealed} />
        ))}
      </div>
      <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-[0.88rem] leading-snug text-mute">
        <p>
          <span className="font-semibold text-steel">How to read the numbers.</span> Each input's contribution is its standardised value times the model's weight, in
          log-odds. The figure shown is that contribution minus the average for the same input across every car on this grid, so +0.40 means the
          input lifts this driver 0.40 above a typical car here. The grid's own inputs are left out of the reasons, because the grid is the baseline being
          compared against.
        </p>
        <p>These describe what the fitted model relies on. They are associations, not a forecast of what would change if an input did. Moves are measured against the full grid, with pit-lane starts counted behind the last grid slot.{revealed ? "" : " Outcomes stay hidden until you reveal the result."}</p>
      </div>
    </Panel>
  );
}

function Column({ direction, rows, revealed }: { direction: Direction; rows: Row[]; revealed: boolean }) {
  const copy = COPY[direction];
  const moves = biggestMoves(rows, direction, 3);
  return (
    <section aria-label={`${copy.title}: ${copy.lead.toLowerCase()}`}>
      <h3 className="flex items-baseline gap-3 border-b border-line pb-2 font-display text-[1.25rem] font-bold tracking-[0.08em] uppercase">
        <span aria-hidden className={direction === "up" ? "text-signal-text" : "text-steel"}>{direction === "up" ? "▲" : "▼"}</span>
        {copy.title}
        <span className="text-[0.85rem] font-semibold tracking-[0.1em] text-mute">{copy.lead}</span>
      </h3>
      {moves.length === 0 ? (
        <p className="mt-4 text-steel">{copy.empty}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {moves.map((move) => (
            <MoveCard key={move.row.driver.id} move={move} rows={rows} direction={direction} revealed={revealed} />
          ))}
        </ol>
      )}
    </section>
  );
}

function MoveCard({ move, rows, direction, revealed }: { move: GridMove; rows: Row[]; direction: Direction; revealed: boolean }) {
  const { row } = move;
  const reasons = explainMove(row, rows, direction, 2);
  const size = Math.abs(move.move);
  return (
    <li className="border border-line bg-tower p-4">
      <div className="flex items-start gap-3">
        <span className="h-11 w-1.5 shrink-0" style={{ background: row.colour }} aria-hidden />
        <div className="min-w-0">
          <p className="truncate font-display text-[1.3rem] leading-none font-bold uppercase">{row.driver.name}</p>
          <p className="mt-1 text-[0.85rem] text-mute">{row.team.short}</p>
        </div>
        <span className={`figure ml-auto shrink-0 text-[1.9rem] ${direction === "up" ? "text-signal-text" : "text-steel"}`}>
          <span aria-hidden>{direction === "up" ? "+" : "−"}</span>
          {size}
          <span className="sr-only"> places {direction === "up" ? "above" : "below"} the grid</span>
        </span>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-[0.95rem] font-semibold uppercase">
        <span className="border border-line2 px-2 py-0.5 text-steel">Grid rank {move.gridRank}</span>
        <span aria-hidden className="text-signal">→</span>
        <span className={`border px-2 py-0.5 ${direction === "up" ? "border-signal" : "border-line2"}`}>Model rank {move.modelRank}</span>
        <span className="ml-1 text-[0.85rem] font-normal tracking-normal text-mute normal-case">score {row.score.toFixed(3)}</span>
      </p>
      <p className="label mt-3 !text-[0.72rem]">{COPY[direction].because}</p>
      {reasons.length === 0 ? (
        <p className="mt-1 text-[0.9rem] text-mute">No single input stands out from the field.</p>
      ) : (
        <ul className="mt-1 space-y-0.5 text-[0.92rem]">
          {reasons.map((reason) => (
            <li key={reason.feature} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-steel">{featureLabel(reason.feature)}</span>
              <span className="shrink-0 font-display font-semibold tabular-nums">{signed(reason.delta)}</span>
            </li>
          ))}
        </ul>
      )}
      {revealed && (
        <p className="mt-3 border-t border-line pt-2 text-[0.88rem] text-steel">
          Result: {row.podium ? "finished on the podium" : `finished ${row.finish ?? row.entry.txt}`}
        </p>
      )}
    </li>
  );
}

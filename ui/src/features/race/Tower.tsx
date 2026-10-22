import { useMemo, useState } from "react";
import { Panel } from "../../components/Panel";
import { Tabs } from "../../components/Bits";
import { THRESHOLD } from "../../lib/model";
import { haptic } from "../../lib/haptic";
import { PLACE_COLOURS, classifiedLabel, type Row } from "./rows";

const ROW_H = 50;

type Sort = "score" | "grid";

/** Timing-tower leaderboard: every driver, ranked by podium score or starting grid. */
export function Tower({
  rows,
  selected,
  onToggle,
  revealed,
  hovered,
  onHover,
}: {
  rows: Row[];
  selected: number[];
  onToggle: (driverId: number) => void;
  revealed: boolean;
  hovered?: number | null;
  onHover?: (driverId: number | null) => void;
}) {
  const [sort, setSort] = useState<Sort>("score");

  const order = useMemo(() => {
    const copy = [...rows];
    if (sort === "grid") copy.sort((a, b) => (a.grid ?? 99) - (b.grid ?? 99) || a.rank - b.rank);
    return copy;
  }, [rows, sort]);
  const index = new Map(order.map((row, i) => [row.driver.id, i]));
  const above = rows.filter((row) => row.score >= THRESHOLD).length;

  return (
    <Panel
      eyebrow="Every driver in the field"
      title="Podium score ranking"
      tag="model"
      actions={
        <Tabs<Sort>
          value={sort}
          onChange={setSort}
          idPrefix="tower-sort"
          label="Sort the ranking"
          size="sm"
          options={[
            { id: "score", label: "Score" },
            { id: "grid", label: "Grid" },
          ]}
        />
      }
    >
      <div
        className="mb-2 hidden grid-cols-[2.2rem_0.5rem_minmax(0,1fr)_3.4rem_minmax(8rem,1.2fr)_3.4rem] items-end gap-3 px-3 sm:grid"
        aria-hidden
      >
        <span className="label">{sort === "score" ? "Rank" : "Grid"}</span>
        <span />
        <span className="label">Driver</span>
        <span className="label text-center">{sort === "score" ? "Grid" : "Rank"}</span>
        <span className="label">Podium score</span>
        <span className="label text-right">{revealed ? "Result" : ""}</span>
      </div>

      <ul className="relative" style={{ height: rows.length * ROW_H }} aria-label="Drivers ranked">
        {rows.map((row) => {
          const i = index.get(row.driver.id) ?? 0;
          const on = selected.includes(row.driver.id);
          const lead = sort === "score" ? row.rank : row.grid;
          const podiumRank = sort === "score" && row.rank <= 3 ? row.rank : 0;
          const hot = hovered === row.driver.id;
          return (
            <li
              key={row.driver.id}
              className="absolute inset-x-0 transition-transform duration-500 ease-out motion-reduce:transition-none"
              style={{ transform: `translateY(${i * ROW_H}px)`, height: ROW_H }}
            >
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  haptic("select");
                  onToggle(row.driver.id);
                }}
                onPointerEnter={() => onHover?.(row.driver.id)}
                onPointerLeave={() => onHover?.(null)}
                onFocus={() => onHover?.(row.driver.id)}
                onBlur={() => onHover?.(null)}
                className={`group grid h-[46px] w-full cursor-pointer grid-cols-[2.2rem_0.5rem_minmax(0,1fr)_2.6rem_minmax(5.5rem,1.2fr)_auto] items-center gap-2 border px-2 text-left transition-colors sm:grid-cols-[2.2rem_0.5rem_minmax(0,1fr)_3.4rem_minmax(8rem,1.2fr)_3.4rem] sm:gap-3 sm:px-3 ${
                  on ? "border-ink bg-panel2" : hot ? "border-line2 bg-panel2" : "border-line bg-panel hover:border-line2 hover:bg-panel2"
                }`}
                aria-label={`${row.driver.name}, ${row.team.short}. Rank ${row.rank}, podium score ${row.score.toFixed(2)}, grid ${row.grid ?? "pit lane"}${on ? ". Selected for comparison" : ""}`}
              >
                <span
                  className="figure text-center text-[1.45rem]"
                  style={{ color: podiumRank ? PLACE_COLOURS[podiumRank - 1] : "var(--color-steel)" }}
                >
                  {lead ?? "PIT"}
                </span>
                <span className="h-7 w-1.5" style={{ background: row.colour }} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-display text-[1.15rem] leading-none font-bold tracking-[0.02em] uppercase">
                    <span className="sm:hidden">{row.driver.code}</span>
                    <span className="hidden sm:inline">{row.driver.last}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[0.78rem] leading-none text-mute">
                    <span className="sm:hidden">{row.team.short}</span>
                    <span className="hidden sm:inline">
                      {row.driver.code} · {row.team.short}
                    </span>
                  </span>
                </span>
                <span className="text-center font-display text-[1.05rem] font-semibold tracking-wide text-steel">
                  {sort === "score" ? (row.grid ? `P${row.grid}` : "PIT") : `#${row.rank}`}
                </span>
                <span className="flex items-center gap-2">
                  <span className="relative h-2 flex-1 bg-line" aria-hidden>
                    <span
                      className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
                      style={{ width: `${row.score * 100}%`, background: row.score >= THRESHOLD ? row.colour : "#4a525d" }}
                    />
                    <span className="absolute -top-[3px] -bottom-[3px] w-px bg-ink/70" style={{ left: `${THRESHOLD * 100}%` }} />
                  </span>
                  <span className="figure w-[2.6rem] text-right text-[1.25rem]">{row.score.toFixed(2)}</span>
                </span>
                <span className="text-right">
                  {revealed ? (
                    <span
                      className="inline-block min-w-[2.6rem] px-1.5 py-1 text-center font-display text-[0.95rem] leading-none font-bold"
                      style={
                        row.finish && row.finish <= 3
                          ? { background: PLACE_COLOURS[row.finish - 1], color: "#0a0b0e" }
                          : { background: "#1c2128", color: "#c5cad1" }
                      }
                    >
                      {classifiedLabel(row)}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[0.92rem] text-mute">
        <p className="flex items-center gap-2">
          <span className="inline-block h-3 w-px bg-ink/70" aria-hidden />
          Cutoff {THRESHOLD.toFixed(3)}: {above} {above === 1 ? "driver scores" : "drivers score"} at or above it, and the race has three podium places.
        </p>
        <p>Select up to three drivers to compare them below.</p>
      </div>
    </Panel>
  );
}

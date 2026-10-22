import { useEffect, useMemo, useState } from "react";
import { Panel } from "../../components/Panel";
import { Note, ScoreBar } from "../../components/Bits";
import { Portrait } from "../../components/Portrait";
import { FEATURES, THRESHOLD, featureIndex, podiumScore, withFeature, withGrid } from "../../lib/model";
import { signed } from "../../lib/format";
import { haptic } from "../../lib/haptic";
import type { Row } from "./rows";

/**
 * Change one driver's inputs and run the same model again, in the browser.
 *
 * This is a counterfactual input to the fitted model. It shows how the score depends on each
 * input. It does not forecast what would have happened, and the other drivers keep their real inputs.
 */
export function WhatIfPanel({ rows, focus, onFocus }: { rows: Row[]; focus: number; onFocus: (id: number) => void }) {
  const row = rows.find((r) => r.driver.id === focus) ?? rows[0];
  const base = row.entry.x;

  const [grid, setGrid] = useState<number | "pit">(row.grid ?? "pit");
  const [driverForm, setDriverForm] = useState<number>(base[featureIndex("driver_podium_rate_5")] ?? 0);
  const [teamForm, setTeamForm] = useState<number>(base[featureIndex("constructor_podium_rate_5")] ?? 0);

  useEffect(() => {
    setGrid(row.grid ?? "pit");
    setDriverForm(base[featureIndex("driver_podium_rate_5")] ?? 0);
    setTeamForm(base[featureIndex("constructor_podium_rate_5")] ?? 0);
  }, [row.driver.id, row.grid, base]);

  const modified = useMemo(() => {
    let next = withGrid(base, grid);
    next = withFeature(next, "driver_podium_rate_5", driverForm);
    next = withFeature(next, "constructor_podium_rate_5", teamForm);
    return next;
  }, [base, grid, driverForm, teamForm]);

  const score = podiumScore(modified);
  const delta = score - row.score;
  const others = rows.filter((r) => r.driver.id !== row.driver.id);
  const newRank = 1 + others.filter((r) => r.score > score).length;
  const changed =
    (grid === "pit" ? null : grid) !== row.grid ||
    driverForm !== (base[featureIndex("driver_podium_rate_5")] ?? 0) ||
    teamForm !== (base[featureIndex("constructor_podium_rate_5")] ?? 0);

  const fieldSize = base[featureIndex("field_size")] ?? rows.length;

  return (
    <Panel
      eyebrow="Try it · same model, your inputs"
      title="What if the inputs were different?"
      tag="model"
      actions={
        <label className="flex items-center gap-2">
          <span className="sr-only">Driver to edit</span>
          <select className="select" value={row.driver.id} onChange={(e) => onFocus(Number(e.target.value))} aria-label="Driver to edit">
            {rows.map((r) => (
              <option key={r.driver.id} value={r.driver.id}>
                {r.driver.name}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <Control
            id="whatif-grid"
            label="Starting grid"
            value={grid === "pit" ? "Pit lane" : `P${grid}`}
            original={row.grid ? `P${row.grid}` : "Pit lane"}
          >
            <input
              id="whatif-grid"
              type="range"
              min={1}
              max={fieldSize + 1}
              step={1}
              value={grid === "pit" ? fieldSize + 1 : grid}
              onChange={(e) => {
                const v = Number(e.target.value);
                setGrid(v > fieldSize ? "pit" : v);
                haptic("step");
              }}
            />
            <Ticks left="Pole" right="Pit lane" />
          </Control>
          <Control
            id="whatif-dform"
            label="Driver podiums in last 5 races"
            value={`${Math.round(driverForm * 100)}%`}
            original={`${Math.round((base[featureIndex("driver_podium_rate_5")] ?? 0) * 100)}%`}
          >
            <input
              id="whatif-dform"
              type="range"
              min={0}
              max={1}
              step={0.2}
              value={driverForm}
              onChange={(e) => {
                setDriverForm(Number(e.target.value));
                haptic("step");
              }}
            />
            <Ticks left="0 of 5" right="5 of 5" />
          </Control>
          <Control
            id="whatif-tform"
            label="Team podium rate, last 5 races"
            value={`${Math.round(teamForm * 100)}%`}
            original={`${Math.round((base[featureIndex("constructor_podium_rate_5")] ?? 0) * 100)}%`}
          >
            <input
              id="whatif-tform"
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={teamForm}
              onChange={(e) => {
                setTeamForm(Number(e.target.value));
                haptic("step");
              }}
            />
            <Ticks left="0%" right="100%" />
          </Control>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-ghost !min-h-10"
              disabled={!changed}
              onClick={() => {
                setGrid(row.grid ?? "pit");
                setDriverForm(base[featureIndex("driver_podium_rate_5")] ?? 0);
                setTeamForm(base[featureIndex("constructor_podium_rate_5")] ?? 0);
              }}
            >
              Reset to the real inputs
            </button>
            <p className="text-[0.85rem] text-mute">The other {FEATURES.length - 3} inputs stay as they were.</p>
          </div>
        </div>

        <div className="border border-line bg-tower p-4 sm:p-5" aria-live="polite">
          <div className="flex items-center gap-3">
            <Portrait driver={row.driver} colour={row.colour} number={row.entry.n} className="h-14 w-14 shrink-0" rounded label={row.driver.name} />
            <div>
              <p className="font-display text-[1.5rem] leading-none font-bold uppercase">{row.driver.name}</p>
              <p className="mt-1 text-[0.88rem] text-mute">{row.team.short}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <p className="label">Real inputs</p>
              <p className="figure mt-1 text-[2.4rem] text-steel">{row.score.toFixed(2)}</p>
              <p className="text-[0.85rem] text-mute">rank {row.rank}</p>
            </div>
            <div>
              <p className="label">Your inputs</p>
              <p className="figure mt-1 text-[2.4rem]" style={{ color: score >= THRESHOLD ? "var(--color-ink)" : "var(--color-steel)" }}>
                {score.toFixed(2)}
              </p>
              <p className="text-[0.85rem] text-mute">would rank {newRank}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <ScoreBar value={row.score} colour="#59616d" height={6} />
            <ScoreBar value={score} colour={row.colour} height={10} />
          </div>

          <p className="mt-4 text-[1rem] leading-snug">
            {changed ? (
              <>
                That moves the score by <span className="font-semibold">{signed(delta)}</span> and it would be{" "}
                {score >= THRESHOLD ? "above" : "below"} the {THRESHOLD.toFixed(3)} cutoff.
              </>
            ) : (
              <>These are the inputs the model really received. Move a slider to see the score respond.</>
            )}
          </p>
        </div>
      </div>
      <div className="mt-6">
        <Note>
          A counterfactual input to the fitted model, computed in your browser with the exported weights. It is not a forecast of
          what would have happened: a driver who starts further forward also changes the race around them.
        </Note>
      </div>
    </Panel>
  );
}

function Control({
  id,
  label,
  value,
  original,
  children,
}: {
  id: string;
  label: string;
  value: string;
  original: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[1rem] text-steel">
          {label}
        </label>
        <p className="font-display text-[1.4rem] leading-none font-bold">
          {value}
          {value !== original && <span className="ml-2 text-[0.85rem] font-semibold text-mute">was {original}</span>}
        </p>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Ticks({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-1.5 flex justify-between text-[0.78rem] text-mute" aria-hidden>
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

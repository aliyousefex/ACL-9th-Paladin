import { useState } from "react";
import { Choice } from "../components/Controls";
import site from "../data/site.json";
import { integer, pct } from "../lib/format";
import { haptic } from "../lib/haptic";
import { CIRCUIT_PATHS, CIRCUIT_SHORT } from "./circuits";
import { CircuitTrace } from "./CircuitTrace";

const ERAS = ["1950-2013", "2014-2024"] as const;

export function CircuitBoard() {
  const [era, setEra] = useState<(typeof ERAS)[number]>("2014-2024");
  const leaders = site.frontRow.leaders.filter((row) => row.era === era);
  const [name, setName] = useState(leaders[0]?.circuit ?? "");
  const selected = leaders.find((row) => row.circuit === name) ?? leaders[0];
  const path = selected ? CIRCUIT_PATHS[selected.circuit] : undefined;
  const overall = site.frontRow.overall.find((row) => row.era === era);
  const delta = selected && overall ? selected.rate - overall.rate : 0;

  const chooseEra = (next: (typeof ERAS)[number]) => {
    setEra(next);
    const first = site.frontRow.leaders.find((row) => row.era === next);
    if (first) setName(first.circuit);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] lg:items-start">
      <div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Era">
          {ERAS.map((item) => (
            <Choice key={item} pressed={item === era} onClick={() => chooseEra(item)}>
              {item}
            </Choice>
          ))}
        </div>
        <div className="mt-5 border border-line bg-tower">
          {selected && (
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-4 py-3">
              <div>
                <p className="font-display text-[0.82rem] tracking-[0.1em] text-steel uppercase">Track analysis · {era}</p>
                <p className="mt-1 font-display text-[1.55rem] font-semibold">{selected.circuit}</p>
              </div>
              <div className="flex gap-6 text-right">
                <p><span className="figure block text-[1.8rem]">{pct(selected.rate)}</span><span className="text-[0.82rem] text-steel">conversion</span></p>
                <p><span className="figure block text-[1.8rem]">{integer(selected.starts)}</span><span className="text-[0.82rem] text-steel">front-row starts</span></p>
              </div>
            </div>
          )}
          <div className="px-3 py-4">
          {selected && path ? (
            <CircuitTrace d={path} label={selected.circuit} />
          ) : (
            <p className="grid min-h-48 place-items-center text-center text-steel">
              No schematic for {selected ? short(selected.circuit) : "this circuit"}. The rate beside it is still the measured one.
            </p>
          )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-[0.82rem] text-steel" aria-label="Track schematic legend">
            <span className="flex items-center gap-2"><span className="h-2 w-5 bg-signal" aria-hidden />Red/white kerb</span>
            <span className="flex items-center gap-2"><span className="h-2 w-5 bg-[#5b616b]" aria-hidden />Track edge</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-steel" aria-hidden />Sector marker</span>
            <span className="flex items-center gap-2"><span className="h-3 w-1 bg-ink" aria-hidden />Start/finish</span>
          </div>
        </div>
        <p className="mt-3 max-w-[62ch] text-steel">
          Original schematic, not a surveyed map. A marker follows the line. The rate and the start count come from the front-row table.
          {overall ? ` Across every front-row start in ${era}, the rate is ${pct(overall.rate)} of ${integer(overall.count)}.` : ""}
        </p>
      </div>
      <div>
        <p className="mb-2 font-display text-[0.85rem] tracking-[0.1em] text-steel uppercase">Timing tower · front-row conversion</p>
        <ul className="border-t border-ink" aria-label={`Leading circuits, ${era}`}>
          {leaders.map((row) => {
            const on = row.circuit === selected?.circuit;
            return (
              <li key={row.circuit}>
                <button
                  type="button"
                  onClick={() => {
                    haptic("select");
                    setName(row.circuit);
                  }}
                  aria-pressed={on}
                  className={`grid w-full cursor-pointer grid-cols-[1.4rem_1fr_auto] items-center gap-3 border-b border-line px-2 py-3 text-left transition-colors ${on ? "bg-signal text-ink" : "text-steel hover:bg-line hover:text-ink"}`}
                >
                  <span className="figure text-[1.1rem]">{String(leaders.indexOf(row) + 1).padStart(2, "0")}</span>
                  <span>{short(row.circuit)}</span>
                  <span className="figure text-[1.7rem]">{pct(row.rate)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {selected && (
          <div className="mt-5 border-y border-line py-4">
            <div className="flex items-end justify-between gap-4">
              <p className="text-steel">Against the {era} field</p>
              <p className={`figure text-[2rem] ${delta >= 0 ? "text-ink" : "text-steel"}`}>
                {delta >= 0 ? "+" : ""}{(delta * 100).toFixed(1)} pp
              </p>
            </div>
            <div className="relative mt-3 h-2 bg-line" aria-hidden>
              {overall && <span className="absolute inset-y-[-3px] w-px bg-steel" style={{ left: `${overall.rate * 100}%` }} />}
              <span className="block h-full bg-signal" style={{ width: `${selected.rate * 100}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[0.82rem] text-steel">
              <span>0%</span>
              <span>Era baseline {overall ? pct(overall.rate) : "–"}</span>
              <span>100%</span>
            </div>
            <p className="mt-4 text-steel">
              <span className="figure mr-3 text-[2.4rem] text-ink">{integer(selected.starts)}</span>
              observed front-row starts. Treat small samples as descriptive, not causal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function short(name: string): string {
  return CIRCUIT_SHORT[name] ?? name;
}

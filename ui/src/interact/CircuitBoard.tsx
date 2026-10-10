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
        <div className="mt-5 border border-line bg-tower px-4 py-6">
          {selected && path ? (
            <CircuitTrace d={path} label={selected.circuit} />
          ) : (
            <p className="grid min-h-48 place-items-center text-center text-steel">
              No schematic for {selected ? short(selected.circuit) : "this circuit"}. The rate beside it is still the measured one.
            </p>
          )}
        </div>
        <p className="mt-3 max-w-[62ch] text-steel">
          Original schematic, not a surveyed map. A marker follows the line. The rate and the start count come from the front-row table.
          {overall ? ` Across every front-row start in ${era}, the rate is ${pct(overall.rate)} of ${integer(overall.count)}.` : ""}
        </p>
      </div>
      <div>
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
                  className={`flex w-full cursor-pointer items-baseline justify-between gap-4 border-b border-line py-3 text-left ${on ? "text-ink" : "text-steel hover:text-ink"}`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`h-2 w-2 ${on ? "bg-signal" : "bg-transparent ring-1 ring-steel"}`} aria-hidden />
                    {short(row.circuit)}
                  </span>
                  <span className="figure text-[1.7rem]">{pct(row.rate)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {selected && (
          <p className="mt-4 text-steel">
            <span className="figure mr-3 text-[2.4rem] text-ink">{integer(selected.starts)}</span>
            front-row starts at {selected.circuit}
          </p>
        )}
      </div>
    </div>
  );
}

function short(name: string): string {
  return CIRCUIT_SHORT[name] ?? name;
}

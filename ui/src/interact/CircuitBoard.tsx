import { useEffect, useRef, useState } from "react";
import { Choice } from "../components/Controls";
import { CircuitMap } from "../components/CircuitMap";
import site from "../data/site.json";
import { circuitByRef, loadLayout, useResource, type Layout } from "../lib/data";
import { integer, pct } from "../lib/format";
import { haptic } from "../lib/haptic";
import { usePrefersReducedMotion } from "../lib/motion";
import { pointAt } from "../features/race/replay";

const ERAS = ["1950-2013", "2014-2024"] as const;

/** Dataset circuit name to the layout file built from the F1 timing map (or an outline). */
const LAYOUT_OF: Record<string, string> = {
  "Suzuka Circuit": "suzuka",
  "Yas Marina Circuit": "yas_marina",
  "Circuit de Monaco": "monaco",
  "Circuit de Barcelona-Catalunya": "catalunya",
  "Circuit de Spa-Francorchamps": "spa",
  "Circuit de Nevers Magny-Cours": "magny_cours",
  "Istanbul Park": "istanbul",
  "Sepang International Circuit": "sepang",
};

const SHORT: Record<string, string> = {
  "Circuit de Nevers Magny-Cours": "Magny-Cours",
  "Istanbul Park": "Istanbul",
  "Dijon-Prenois": "Dijon",
  "Circuit Bremgarten": "Bremgarten",
  "Sepang International Circuit": "Sepang",
  "Suzuka Circuit": "Suzuka",
  "Yas Marina Circuit": "Yas Marina",
  "Circuit de Monaco": "Monaco",
  "Circuit de Barcelona-Catalunya": "Barcelona",
  "Circuit de Spa-Francorchamps": "Spa",
};

/** The front-row conversion ranking, with the real circuit beside it where a verified outline exists. */
export function CircuitBoard() {
  const [era, setEra] = useState<(typeof ERAS)[number]>("2014-2024");
  const leaders = site.frontRow.leaders.filter((row) => row.era === era);
  const [name, setName] = useState(leaders[0]?.circuit ?? "");
  const selected = leaders.find((row) => row.circuit === name) ?? leaders[0];
  const overall = site.frontRow.overall.find((row) => row.era === era);
  const delta = selected && overall ? selected.rate - overall.rate : 0;

  const layoutId = selected ? LAYOUT_OF[selected.circuit] : undefined;
  const { data: layout } = useResource<Layout>(layoutId ?? null, () => loadLayout(layoutId!));
  const reduced = usePrefersReducedMotion();
  const dot = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!layout || reduced || layout.samples.length === 0) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = pointAt(layout.samples, ((now - start) / 14000) % 1);
      dot.current?.setAttribute("transform", `translate(${p.x} ${p.y})`);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [layout, reduced]);

  const chooseEra = (next: (typeof ERAS)[number]) => {
    setEra(next);
    const first = site.frontRow.leaders.find((row) => row.era === next);
    if (first) setName(first.circuit);
  };

  const circuit = layoutId ? circuitByRef(layoutId) : undefined;

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
          <div className="grid min-h-64 place-items-center px-3 py-4">
            {layout ? (
              <CircuitMap layout={layout} className="block max-h-[340px] w-full" label={`${selected?.circuit} outline with a car lapping`} weight={0.9} startLine={layout.samples.length > 0}>
                {!reduced && layout.samples.length > 0 && (
                  <g ref={dot}>
                    <circle r={9} fill="#e10600" stroke="#f4f4f2" strokeWidth={3} />
                  </g>
                )}
              </CircuitMap>
            ) : (
              <p className="px-6 text-center text-steel">
                {layoutId
                  ? "Loading the outline."
                  : `No verified outline for ${selected ? short(selected.circuit) : "this circuit"} exists in our sources, so none is drawn. The rate beside it is still the measured one.`}
              </p>
            )}
          </div>
          <div className="border-t border-line px-4 py-3 text-[0.82rem] text-steel">
            {layout
              ? `${layout.source.outline}${circuit ? "" : ""}. ${layout.corners.length ? "Real corner positions and start line." : "Outline only: no corner or timing data."} The red dot is an illustration of a lap, not data.`
              : "Outlines come from the F1 timing track map or an MIT-licensed GeoJSON of the circuit."}
          </div>
        </div>
        <p className="mt-3 max-w-[62ch] text-steel">
          The rate and the start count come from the front-row table.
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
                  className={`grid w-full cursor-pointer grid-cols-[1.4rem_1fr_auto] items-center gap-3 border-b border-line px-2 py-3 text-left transition-colors ${on ? "bg-signal text-white" : "text-steel hover:bg-line hover:text-ink"}`}
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
  return SHORT[name] ?? name;
}

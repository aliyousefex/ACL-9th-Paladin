import { useMemo, useState } from "react";
import { CircuitMap, CircuitThumb, SECTOR_COLOURS } from "../../components/CircuitMap";
import { Flag } from "../../components/Flag";
import { Icon } from "../../components/Icon";
import { Panel } from "../../components/Panel";
import { LightsLoader, Note, Stat, Tabs } from "../../components/Bits";
import { Missing } from "../../components/Missing";
import {
  RACES,
  RACE_CIRCUITS,
  circuitByRef,
  currentLayout,
  driver,
  loadLayout,
  raceHref,
  teamColour,
  useResource,
  type Circuit,
  type Layout,
  type LayoutMeta,
  type RaceMeta,
} from "../../lib/data";
import { lapTime, pct } from "../../lib/format";
import { useTitle } from "../../lib/hooks";
import { href, replaceQuery } from "../../lib/router";

type Sort = "name" | "length" | "corners" | "hits";

const MAX_COMPARE = 3;

export function CircuitsPage({ reference, query }: { reference?: string; query: URLSearchParams }) {
  const circuit = reference ? circuitByRef(reference) : undefined;
  if (reference && !circuit) return <Missing kind="Circuit" reference={reference} backTo="/circuits" />;
  if (circuit) return <CircuitDetail circuit={circuit} />;
  return <CircuitList query={query} />;
}

function hitsAt(circuit: Circuit): { mean: number; races: RaceMeta[] } {
  const races = RACES.filter((r) => r.circuitId === circuit.circuitId);
  return { mean: races.length ? races.reduce((a, r) => a + r.hits, 0) / races.length : 0, races };
}

/* ------------------------------------------------------------------ list */

function CircuitList({ query }: { query: URLSearchParams }) {
  useTitle("Circuits");
  const sort = (["name", "length", "corners", "hits"].includes(query.get("sort") ?? "") ? query.get("sort") : "name") as Sort;
  const compare = (query.get("compare") ?? "").split(",").filter(Boolean).slice(0, MAX_COMPARE);
  const update = (next: Record<string, string | undefined>) => replaceQuery({ sort: sort === "name" ? undefined : sort, compare: compare.join(",") || undefined, ...next });

  const rows = useMemo(() => {
    const list = RACE_CIRCUITS.map((c) => ({ c, layout: currentLayout(c), hits: hitsAt(c) }));
    list.sort((a, b) => {
      if (sort === "length") return (b.layout.lengthM ?? 0) - (a.layout.lengthM ?? 0);
      if (sort === "corners") return (b.layout.turns ?? 0) - (a.layout.turns ?? 0);
      if (sort === "hits") return b.hits.mean - a.hits.mean;
      return a.c.name.localeCompare(b.c.name);
    });
    return list;
  }, [sort]);

  const toggle = (ref: string) => {
    const next = compare.includes(ref) ? compare.filter((r) => r !== ref) : [...compare, ref].slice(-MAX_COMPARE);
    update({ compare: next.join(",") || undefined });
  };

  return (
    <div className="page-in">
      <header className="border-b border-line pt-[calc(var(--nav-h)+2rem)] pb-8">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <p className="eyebrow">Circuits</p>
          <h1 className="display mt-3 text-[3rem] sm:text-[4.8rem]">The atlas</h1>
          <p className="mt-4 max-w-[68ch] text-[1.1rem] leading-relaxed text-steel">
            Every circuit of the held-out seasons, drawn from the F1 timing track map rather than traced by hand. Open one for numbered
            corners, sectors, DRS usage and how often the model called its podium right there. Select up to three to compare them at the same scale.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] space-y-6 px-4 pt-8 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <label className="ml-auto flex items-center gap-2 text-[0.9rem] text-mute">
            Sort
            <select className="select" value={sort} onChange={(e) => update({ sort: e.target.value === "name" ? undefined : e.target.value })} aria-label="Sort circuits">
              <option value="name">Name</option>
              <option value="length">Lap length</option>
              <option value="corners">Corners</option>
              <option value="hits">Model hits</option>
            </select>
          </label>
        </div>

        {compare.length >= 2 && <CompareToScale refs={compare} onClear={() => update({ compare: undefined })} onToggle={toggle} />}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Circuits">
          {rows.map(({ c, layout, hits }) => (
            <li key={c.circuitId}>
              <CircuitCard circuit={c} layout={layout} hits={hits} selected={compare.includes(c.ref)} disabled={!compare.includes(c.ref) && compare.length >= MAX_COMPARE} onSelect={() => toggle(c.ref)} />
            </li>
          ))}
        </ul>
        <Note>
          Lengths and corner counts are the official figures for the layout raced in 2022–2024. Where a circuit changed layout in that period
          (Barcelona, Singapore) the current layout is shown here and the race page uses the layout of its own year.
        </Note>
      </div>
    </div>
  );
}

function CircuitCard({
  circuit,
  layout,
  hits,
  selected,
  disabled,
  onSelect,
}: {
  circuit: Circuit;
  layout: LayoutMeta;
  hits: { mean: number; races: RaceMeta[] };
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const stat = circuit.stats;
  return (
    <article className={`group relative h-full overflow-hidden border bg-panel transition-colors hover:bg-panel2 ${selected ? "border-ink" : "border-line hover:border-line2"}`}>
      <span className="pointer-events-none absolute top-0 left-0 z-[1] h-3.5 w-3.5 bg-[linear-gradient(135deg,var(--color-signal)_50%,transparent_50%)]" aria-hidden />
      <div className="relative grid h-44 place-items-center overflow-hidden bg-tower px-6 py-5">
        <CircuitThumb meta={layout} className="h-full w-full max-w-[250px] transition-transform duration-500 group-hover:scale-[1.07]" stroke="#f4f4f2" width={12} accent="#2a3039" />
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          aria-pressed={selected}
          aria-label={`Compare ${circuit.name}`}
          className={`absolute top-3 right-3 z-10 flex h-9 items-center gap-1.5 px-2.5 font-display text-[0.9rem] font-bold tracking-wide uppercase disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "bg-ink text-paper" : "bg-panel/90 text-steel hover:text-ink"}`}
        >
          <Icon name={selected ? "check" : "compare"} size={15} strokeWidth={2.2} />
          Compare
        </button>
      </div>
      <div className="p-4">
        <p className="flex items-center gap-2 text-[0.85rem] text-mute">
          <Flag code={circuit.flag} />
          {circuit.location || circuit.country}
        </p>
        <h2 className="display mt-1 text-[1.45rem] leading-[1.02]">
          <a className="no-underline after:absolute after:inset-0 after:z-0 hover:underline" href={href(`/circuits/${circuit.ref}`)}>
            {circuit.name}
          </a>
        </h2>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
          <MiniStat label="Length" value={layout.lengthM ? `${(layout.lengthM / 1000).toFixed(2)} km` : "–"} />
          <MiniStat label="Corners" value={layout.turns ?? "–"} />
          <MiniStat label="DRS" value={layout.drsZones ?? "–"} />
        </dl>
        <p className="mt-3 text-[0.85rem] leading-snug text-mute">
          Model found <span className="font-semibold text-steel">{hits.mean.toFixed(1)} of 3</span> across {hits.races.length}{" "}
          {hits.races.length === 1 ? "race" : "races"}
          {stat ? ` · pole won ${pct(stat.pole.starts ? stat.pole.wins / stat.pole.starts : 0, 0)}` : ""}
        </p>
      </div>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="label !text-[0.68rem]">{label}</dt>
      <dd className="figure mt-0.5 text-[1.35rem]">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ compare to scale */

function CompareToScale({ refs, onClear, onToggle }: { refs: string[]; onClear: () => void; onToggle: (ref: string) => void }) {
  const circuits = refs.map((r) => circuitByRef(r)).filter((c): c is Circuit => Boolean(c));
  return (
    <Panel
      eyebrow="Compare circuits"
      title={circuits.map((c) => c.location || c.name).join(" · ")}
      tag="record"
      actions={
        <button type="button" className="btn btn-ghost !min-h-9 !px-3 !text-[0.95rem]" onClick={onClear}>
          Clear
        </button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {circuits.map((c) => (
          <button key={c.ref} type="button" className="chip" onClick={() => onToggle(c.ref)} aria-label={`Remove ${c.name}`}>
            {c.name}
            <Icon name="cross" size={13} />
          </button>
        ))}
      </div>
      <div className={`mt-6 grid gap-6 ${circuits.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {circuits.map((c) => (
          <ScaledOutline key={c.ref} circuit={c} />
        ))}
      </div>
      <p className="mt-3 text-[0.85rem] text-mute">All outlines share one scale: a longer lap is physically drawn longer.</p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <caption className="sr-only">Circuit statistics side by side</caption>
          <thead>
            <tr className="border-b border-ink">
              <th className="py-2 pr-4"><span className="sr-only">Statistic</span></th>
              {circuits.map((c) => (
                <th key={c.ref} className="py-2 pr-4 font-display text-[1.1rem] font-bold uppercase">{c.location || c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Lap length", (c: Circuit) => `${((currentLayout(c).lengthM ?? 0) / 1000).toFixed(3)} km`],
              ["Corners", (c: Circuit) => currentLayout(c).turns ?? "–"],
              ["DRS usage zones", (c: Circuit) => currentLayout(c).drsZones ?? "–"],
              ["Direction", (c: Circuit) => currentLayout(c).direction ?? "–"],
              ["Pole converted to a win", (c: Circuit) => (c.stats ? pct(c.stats.pole.wins / Math.max(1, c.stats.pole.starts), 0) : "–")],
              ["Front row reaching the podium", (c: Circuit) => (c.stats ? pct(c.stats.frontRow.podiums / Math.max(1, c.stats.frontRow.starts), 0) : "–")],
              ["Model hits per race (of 3)", (c: Circuit) => hitsAt(c).mean.toFixed(1)],
            ].map(([label, f]) => (
              <tr key={String(label)} className="border-b border-line">
                <th scope="row" className="py-2.5 pr-4 text-[0.92rem] font-normal text-steel">{String(label)}</th>
                {circuits.map((c) => (
                  <td key={c.ref} className="py-2.5 pr-4 font-display text-[1.2rem] font-semibold">{(f as (c: Circuit) => string | number)(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** One circuit drawn at a fixed metres-per-pixel so lengths compare honestly. */
function ScaledOutline({ circuit }: { circuit: Circuit }) {
  const meta = currentLayout(circuit);
  const { data: layout } = useResource<Layout>(meta.file ? meta.id : null, () => loadLayout(meta.id));
  // Every box is 3.8 km wide, so the same number of pixels is the same number of metres on every outline.
  const meters = layout ? layout.viewBox[0] * (layout.metersPerUnit ?? 5) : 0;
  return (
    <figure className="border border-line bg-tower p-3">
      <div className="grid aspect-square place-items-center overflow-hidden">
        {layout ? (
          <div style={{ width: `${Math.min(100, meters / 38)}%` }} className="mx-auto">
            <CircuitMap layout={layout} className="block w-full" weight={2.6} startLine={false} label={`${circuit.name} outline`} />
          </div>
        ) : (
          <span className="skeleton h-full w-full" />
        )}
      </div>
      <figcaption className="mt-2 text-[0.85rem] text-steel">
        {circuit.name} · {((meta.lengthM ?? 0) / 1000).toFixed(2)} km
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ detail */

function CircuitDetail({ circuit }: { circuit: Circuit }) {
  useTitle(circuit.name);
  const [layoutId, setLayoutId] = useState(currentLayout(circuit).id);
  const meta = circuit.layouts.find((l) => l.id === layoutId) ?? currentLayout(circuit);
  const { data: layout, loading } = useResource<Layout>(meta.file ? meta.id : null, () => loadLayout(meta.id));
  const [layers, setLayers] = useState({ corners: true, sectors: false, drs: false });
  const [sector, setSector] = useState<number | null>(null);
  const [drs, setDrs] = useState<number | null>(null);
  const [corner, setCorner] = useState<number | null>(null);
  const stats = circuit.stats;
  const races = RACES.filter((r) => r.circuitId === circuit.circuitId);
  const hits = hitsAt(circuit);

  // grid-slot conversion at this circuit against every circuit in the held-out seasons (2014 onwards)
  const overall = useMemo(() => {
    const slots = Array.from({ length: 10 }, () => ({ starts: 0, podiums: 0 }));
    for (const c of RACE_CIRCUITS) c.stats?.gridConversion2014.forEach((g, i) => {
      slots[i].starts += g.starts;
      slots[i].podiums += g.podiums;
    });
    return slots;
  }, []);

  const drsTotal = layout?.drs?.reduce((s, z) => s + z.lengthM, 0) ?? 0;
  const overallMean = RACES.reduce((a, r) => a + r.hits, 0) / RACES.length;

  return (
    <div className="page-in">
      <header className="border-b border-line pt-[calc(var(--nav-h)+1.5rem)] pb-8">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <a href={href("/circuits")} className="eyebrow no-underline hover:text-ink">Circuits</a>
          <h1 className="display mt-4 text-[2.8rem] sm:text-[4.8rem]">{circuit.name}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[1.05rem] text-steel">
            <span className="flex items-center gap-2">
              <Flag code={circuit.flag} /> {circuit.location}{circuit.location && circuit.country ? ", " : ""}{circuit.country}
            </span>
            {stats && <span className="text-mute">{stats.races} Grands Prix in the data since {stats.firstYear}</span>}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] space-y-6 px-4 pt-8 sm:px-6 lg:px-10">
        <Panel eyebrow="The layout" title="Track map" tag="record" actions={circuit.layouts.length > 1 ? (
          <Tabs<string>
            value={layoutId}
            onChange={setLayoutId}
            idPrefix="layout"
            label="Layout"
            size="sm"
            options={circuit.layouts.map((l) => ({ id: l.id, label: yearsLabel(l.years) }))}
          />
        ) : undefined}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div>
              <div className="border border-line bg-tower px-3 py-5 sm:px-8 sm:py-8">
                {loading && !layout && <LightsLoader label="Loading the circuit" />}
                {!meta.file && <p className="grid min-h-56 place-items-center px-6 text-center text-steel">{meta.note ?? "No verified outline is available for this layout."}</p>}
                {layout && (
                  <CircuitMap
                    layout={layout}
                    className="mx-auto block max-h-[560px] w-full"
                    corners={layers.corners}
                    sectors={layers.sectors}
                    drs={layers.drs}
                    activeSector={sector}
                    activeDrs={drs}
                    onCorner={setCorner}
                    animateDraw
                    label={`${circuit.name} track map`}
                  />
                )}
              </div>
              {layout && (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="label mr-1">Layers</span>
                    {(["corners", "sectors", "drs"] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        className="chip disabled:cursor-not-allowed disabled:opacity-40"
                        aria-pressed={layers[l]}
                        disabled={l === "corners" ? layout.corners.length === 0 : l === "sectors" ? !layout.sectors : !layout.drs}
                        onClick={() => setLayers((p) => ({ ...p, [l]: !p[l] }))}
                      >
                        {l === "drs" ? "DRS usage" : l === "corners" ? "Corners" : "Sectors"}
                      </button>
                    ))}
                    {corner !== null && <span className="ml-2 font-display text-[1.1rem] font-bold tracking-wide uppercase">Turn {corner}</span>}
                  </div>
                  {layers.sectors && layout.sectors && (
                    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.9rem] text-steel">
                      {[0, 1, 2].map((i) => (
                        <li key={i} onPointerEnter={() => setSector(i)} onPointerLeave={() => setSector(null)} className="flex items-center gap-2">
                          <span className="h-1.5 w-6" style={{ background: SECTOR_COLOURS[i] }} aria-hidden /> Sector {i + 1}
                        </li>
                      ))}
                    </ul>
                  )}
                  {layers.drs && layout.drs && (
                    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.9rem] text-steel">
                      {layout.drs.map((z, i) => (
                        <li key={i} onPointerEnter={() => setDrs(i)} onPointerLeave={() => setDrs(null)} className="flex items-center gap-2">
                          <span className="h-1.5 w-6 bg-drs" aria-hidden /> DRS zone {i + 1}: {z.lengthM} m
                        </li>
                      ))}
                    </ul>
                  )}
                  {layout.cornersNote && <p className="mt-3 text-[0.9rem] text-amber">{layout.cornersNote}</p>}
                </>
              )}
            </div>

            <div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
                <Stat label="Lap length" value={meta.lengthM ? `${(meta.lengthM / 1000).toFixed(3)} km` : "n/a"} valueClassName="text-[2.2rem]" />
                <Stat label="Corners" value={meta.turns ?? "n/a"} note={layout?.direction ?? undefined} valueClassName="text-[2.2rem]" />
                <Stat label="Race laps" value={meta.lengthM ? Math.ceil((circuit.distanceKm * 1000) / meta.lengthM) : "n/a"} note={meta.lengthM ? `${((Math.ceil((circuit.distanceKm * 1000) / meta.lengthM) * meta.lengthM) / 1000).toFixed(1)} km distance` : undefined} valueClassName="text-[2.2rem]" />
                <Stat label="DRS usage" value={layout?.drs ? `${layout.drs.length} ${layout.drs.length === 1 ? "zone" : "zones"}` : "n/a"} note={layout?.drs ? `${(drsTotal / 1000).toFixed(1)} km open` : "no telemetry"} valueClassName="text-[2.2rem]" />
              </dl>
              {meta.note && <div className="mt-6"><Note kind="warn">{meta.note}</Note></div>}
              {stats && Object.keys(stats.fastestLap).length > 0 && (
                <div className="mt-6 border-t border-line pt-4">
                  <p className="label">Fastest race lap by season</p>
                  <ul className="mt-2 space-y-1">
                    {Object.entries(stats.fastestLap).filter(([year]) => meta.years.length === 0 || meta.years.includes(Number(year))).map(([year, f]) => (
                      <li key={year} className="flex items-baseline justify-between gap-3 text-[0.98rem]">
                        <span className="text-steel">{year} · {driver(f.driverId).last}</span>
                        <span className="font-display text-[1.2rem] font-semibold tabular-nums">{lapTime(f.ms)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Panel>

        {stats && (
          <Panel eyebrow="Does starting position decide it here?" title="Podium rate by grid slot" tag="record">
            <p className="max-w-[70ch] text-[1rem] leading-snug text-steel">
              Share of starts from each of the first ten grid slots that finished on the podium, 2014–2024. The grey tick is the same slot across all
              circuits of the held-out seasons. Small samples (about one race a year) mean single bars move easily.
            </p>
            <GridBars stats={stats.gridConversion2014} overall={overall} />
            <p className="mt-4 text-[0.95rem] text-steel">
              Pole converted to a win {stats.pole.wins} times in {stats.pole.starts} starts ({pct(stats.pole.wins / Math.max(1, stats.pole.starts), 0)}) since {stats.firstYear}; the front row
              reached the podium in {pct(stats.frontRow.podiums / Math.max(1, stats.frontRow.starts), 0)} of {stats.frontRow.starts} starts.
            </p>
          </Panel>
        )}

        <Panel eyebrow="How predictions differ by circuit" title="The model here, race by race" tag={["model", "record"]}>
          <p className="max-w-[70ch] text-[1rem] leading-snug text-steel">
            {races.length} {races.length === 1 ? "edition was" : "editions were"} held in the test seasons. On average the model's top three contained{" "}
            <span className="font-semibold text-ink">{hits.mean.toFixed(1)} of the 3 podium drivers</span> here, against {overallMean.toFixed(1)} across all circuits.
          </p>
          <ul className="mt-5 grid gap-3 md:grid-cols-3">
            {races.map((race) => (
              <li key={race.id}>
                <a className="block border border-line bg-tower p-4 no-underline transition-colors hover:border-line2" href={href(raceHref(race))}>
                  <p className="flex items-center justify-between gap-3">
                    <span className="display text-[1.5rem] leading-none">{race.year}</span>
                    <span className="figure text-[1.7rem]"><span className={race.hits === 3 ? "text-hit" : race.hits === 0 ? "text-signal-text" : "text-steel"}>{race.hits}</span><span className="text-[1rem] text-mute">/3</span></span>
                  </p>
                  <p className="label mt-3 !text-[0.7rem]">Model's podium</p>
                  <ChipRow race={race} ids={race.predicted} />
                  <p className="label mt-2 !text-[0.7rem]">Actual podium</p>
                  <ChipRow race={race} ids={race.actual} plain />
                </a>
              </li>
            ))}
          </ul>
        </Panel>

        {stats && stats.recentWinners.length > 0 && (
          <Panel eyebrow="History" title="Recent winners" tag="record" level={3}>
            <ol className="grid gap-x-8 sm:grid-cols-2">
              {[...stats.recentWinners].reverse().map((w) => (
                <li key={w.year} className="flex items-baseline gap-4 border-b border-line py-2">
                  <span className="figure w-12 text-[1.3rem] text-mute">{w.year}</span>
                  <span className="font-display text-[1.15rem] font-semibold uppercase">{w.driver}</span>
                  <span className="ml-auto text-[0.88rem] text-mute">{w.constructor}</span>
                </li>
              ))}
            </ol>
          </Panel>
        )}
      </div>
    </div>
  );
}

function yearsLabel(years: number[]): string {
  if (years.length === 0) return "Layout";
  return years.length === 1 ? String(years[0]) : `${years[0]}–${years[years.length - 1]}`;
}

function ChipRow({ race, ids, plain }: { race: RaceMeta; ids: number[]; plain?: boolean }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {ids.map((id, i) => {
        const ok = plain ? true : race.actual.includes(id);
        return (
          <li key={id} className="flex items-center gap-1.5 border px-1.5 py-1" style={{ borderColor: ok && !plain ? "var(--color-hit)" : "var(--color-line2)" }}>
            <span className="figure text-[0.9rem] text-mute">{i + 1}</span>
            <span className="h-3.5 w-1" style={{ background: teamColour(race.teams[String(id)], race.year) }} aria-hidden />
            <span className="font-display text-[0.98rem] leading-none font-bold tracking-wide">{driver(id).code}</span>
          </li>
        );
      })}
    </ul>
  );
}

function GridBars({ stats, overall }: { stats: { grid: number; starts: number; podiums: number }[]; overall: { starts: number; podiums: number }[] }) {
  return (
    <ol className="mt-5 flex h-52 items-end gap-2" aria-label="Podium rate by grid slot">
      {stats.map((s, i) => {
        const rate = s.starts ? s.podiums / s.starts : 0;
        const base = overall[i].starts ? overall[i].podiums / overall[i].starts : 0;
        return (
          <li key={s.grid} className="relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <span className="mb-1 text-center font-display text-[0.95rem] font-semibold tabular-nums">{s.starts ? `${Math.round(rate * 100)}%` : "–"}</span>
            <div className="relative flex-1">
              <span className="absolute inset-x-0 bottom-0 bg-signal" style={{ height: `${rate * 100}%`, minHeight: s.starts ? 2 : 0 }} />
              <span className="absolute inset-x-[-3px] h-[3px] bg-steel" style={{ bottom: `calc(${base * 100}% - 1px)` }} aria-hidden title={`All circuits: ${Math.round(base * 100)}%`} />
            </div>
            <span className="mt-1.5 text-center font-display text-[1rem] text-steel">P{s.grid}</span>
            <span className="text-center text-[0.7rem] text-mute">{s.starts} starts</span>
          </li>
        );
      })}
    </ol>
  );
}

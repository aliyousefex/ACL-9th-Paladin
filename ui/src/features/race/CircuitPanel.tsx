import { useState } from "react";
import { CircuitMap, SECTOR_COLOURS } from "../../components/CircuitMap";
import { Flag } from "../../components/Flag";
import { Panel } from "../../components/Panel";
import { LightsLoader, Note, Stat } from "../../components/Bits";
import { driver, loadLayout, useResource, layoutFor, type Circuit, type Layout, type RaceMeta } from "../../lib/data";
import { lapTime } from "../../lib/format";

type Layer = "corners" | "sectors" | "drs";

/** The real circuit: outline, numbered corners, sectors and DRS usage, with the facts that go with it. */
export function CircuitPanel({ race, circuit }: { race: RaceMeta; circuit: Circuit }) {
  const meta = layoutFor(circuit, race.year);
  const { data: layout, error, loading } = useResource<Layout>(meta.file ? meta.id : null, () => loadLayout(meta.id));
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ corners: true, sectors: false, drs: false });
  const [activeSector, setActiveSector] = useState<number | null>(null);
  const [activeDrs, setActiveDrs] = useState<number | null>(null);

  const toggle = (layer: Layer) => setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  const length = meta.lengthM ?? 0;
  const laps = race.scheduledLaps;
  const fastest = circuit.stats?.fastestLap[String(race.year)];
  const drsTotal = layout?.drs?.reduce((sum, z) => sum + z.lengthM, 0) ?? 0;
  const shortened = laps !== null && race.lapsRun < laps;

  return (
    <Panel
      id="circuit"
      eyebrow={`${circuit.location}${circuit.location && circuit.country ? ", " : ""}${circuit.country}`}
      title={circuit.name}
      tag="record"
      actions={circuit.flag ? <Flag code={circuit.flag} className="!h-4 !w-6" /> : undefined}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="border border-line bg-tower px-3 py-5 sm:px-8 sm:py-8">
            {loading && !layout && <LightsLoader label="Loading the circuit" />}
            {error && <p className="py-10 text-center text-steel">The circuit file could not be loaded.</p>}
            {!meta.file && (
              <p className="grid min-h-56 place-items-center px-6 text-center text-steel">
                {meta.note ?? "No verified outline is available for this layout."}
              </p>
            )}
            {layout && (
              <CircuitMap
                layout={layout}
                className="mx-auto block max-h-[520px] w-full"
                corners={layers.corners}
                sectors={layers.sectors}
                drs={layers.drs}
                activeSector={activeSector}
                activeDrs={activeDrs}
                animateDraw
                label={`${circuit.name} track map${layers.corners ? " with numbered corners" : ""}`}
              />
            )}
          </div>

          {layout && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="label mr-1">Layers</span>
              <LayerChip on={layers.corners} onClick={() => toggle("corners")} label="Corners" disabled={layout.corners.length === 0} />
              <LayerChip on={layers.sectors} onClick={() => toggle("sectors")} label="Sectors" disabled={!layout.sectors} />
              <LayerChip on={layers.drs} onClick={() => toggle("drs")} label="DRS usage" disabled={!layout.drs} />
            </div>
          )}

          {layout && layers.sectors && layout.sectors && (
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.9rem] text-steel" aria-label="Sector legend">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  onPointerEnter={() => setActiveSector(i)}
                  onPointerLeave={() => setActiveSector(null)}
                  className="flex items-center gap-2"
                >
                  <span className="h-1.5 w-6" style={{ background: SECTOR_COLOURS[i] }} aria-hidden />
                  Sector {i + 1}
                </li>
              ))}
            </ul>
          )}
          {layout && layers.drs && layout.drs && (
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.9rem] text-steel" aria-label="DRS zones">
              {layout.drs.map((z, i) => (
                <li
                  key={i}
                  onPointerEnter={() => setActiveDrs(i)}
                  onPointerLeave={() => setActiveDrs(null)}
                  className="flex items-center gap-2"
                >
                  <span className="h-1.5 w-6 bg-drs" aria-hidden />
                  Zone {i + 1}: {z.lengthM} m
                </li>
              ))}
            </ul>
          )}
          {layout?.cornersNote && <p className="mt-3 text-[0.9rem] text-amber">{layout.cornersNote}</p>}
        </div>

        <div className="min-w-0">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
            <Stat label="Lap length" value={length ? `${(length / 1000).toFixed(3)} km` : "n/a"} valueClassName="text-[2.2rem]" />
            <Stat
              label={shortened ? "Laps run" : "Race laps"}
              value={shortened ? race.lapsRun : laps ?? race.lapsRun}
              note={shortened && laps ? `shortened from ${laps}` : laps && length ? `${((laps * length) / 1000).toFixed(1)} km distance` : undefined}
              valueClassName="text-[2.2rem]"
            />
            <Stat label="Corners" value={meta.turns ?? "n/a"} valueClassName="text-[2.2rem]" note={layout?.direction ? `${layout.direction}` : undefined} />
            <Stat
              label="DRS usage"
              value={layout?.drs ? `${layout.drs.length} ${layout.drs.length === 1 ? "zone" : "zones"}` : "n/a"}
              note={layout?.drs ? `${(drsTotal / 1000).toFixed(1)} km open` : "no telemetry for this layout"}
              valueClassName="text-[2.2rem]"
            />
            <Stat
              label={`Fastest lap ${race.year}`}
              value={fastest ? lapTime(fastest.ms) : "n/a"}
              note={fastest ? driver(fastest.driverId).last : undefined}
              valueClassName="text-[2.2rem]"
            />
            <Stat
              label="Grands Prix in the data"
              value={circuit.stats?.races ?? "n/a"}
              note={circuit.stats ? `since ${circuit.stats.firstYear}` : undefined}
              valueClassName="text-[2.2rem]"
            />
          </dl>

          {meta.file && meta.note && (
            <div className="mt-6">
              <Note kind="warn">{meta.note}</Note>
            </div>
          )}

          {layout && (
          <details className="mt-6 border-t border-line pt-4 text-[0.92rem] text-steel">
            <summary className="cursor-pointer font-display text-[1rem] tracking-[0.08em] uppercase hover:text-ink">Where this map comes from</summary>
            <div className="mt-3 space-y-2 leading-snug text-mute">
              <p>
                Outline, corner numbers and start line: the F1 timing track map ({layout?.source.outline ?? "MultiViewer circuit API"}, map year{" "}
                {layout?.source.mapYear ?? "n/a"}).
              </p>
              {layout?.source.marks ? (
                <p>
                  Sector boundaries and DRS usage: OpenF1 telemetry from the three fastest laps of the {layout.source.marks.year}{" "}
                  {layout.source.marks.sessionName.toLowerCase()}. Sector boundaries agree across those laps to within{" "}
                  {layout.source.marks.sectorSpreadM.toFixed(0)} m. DRS zones are where the drivers actually opened DRS, which can
                  differ from the official activation zones.
                </p>
              ) : (
                <p>No telemetry is available for this layout, so sectors and DRS zones are not drawn.</p>
              )}
              {layout?.verification && (
                <p>
                  Checks: outline length is {String(layout.verification.lengthDeviationPct)}% from the official {meta.lengthM} m (a sampled
                  line is slightly shorter than the true length); corner count {String(layout.verification.cornersOnMap)} of{" "}
                  {String(layout.verification.turnsOfficial)} official; outline shape differs from an independent GeoJSON outline by{" "}
                  {String(layout.verification.geojsonShapeErrorPct)}% of track size.
                </p>
              )}
            </div>
          </details>
          )}
        </div>
      </div>
    </Panel>
  );
}

function LayerChip({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="chip disabled:cursor-not-allowed disabled:opacity-40"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Not available for this layout" : undefined}
    >
      {label}
    </button>
  );
}

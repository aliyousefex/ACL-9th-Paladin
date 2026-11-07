import { CircuitStage } from "../../components/CircuitStage";
import { Flag } from "../../components/Flag";
import { Panel } from "../../components/Panel";
import { Note, Stat } from "../../components/Bits";
import { driver, loadLayout, useResource, layoutFor, type Circuit, type Layout, type RaceMeta } from "../../lib/data";
import { lapTime } from "../../lib/format";

/** The real circuit: outline, numbered corners, sectors and DRS usage, with the facts that go with it. */
export function CircuitPanel({ race, circuit, revealed }: { race: RaceMeta; circuit: Circuit; revealed: boolean }) {
  const meta = layoutFor(circuit, race.year);
  const { data: layout, error, loading } = useResource<Layout>(meta.file ? meta.id : null, () => loadLayout(meta.id));
  const length = meta.lengthM ?? 0;
  const laps = race.scheduledLaps;
  // This race's own fastest lap is post-race information. Until the result is revealed, show the most recent
  // earlier season at this circuit that the dataset holds (known before the start), and say which year it is.
  const fastestYear = revealed ? race.year : race.year - 1;
  const fastest = circuit.stats?.fastestLap[String(fastestYear)];
  const drsTotal = layout?.drs?.reduce((sum, z) => sum + z.lengthM, 0) ?? 0;
  // A shortened race is only known afterwards, so the laps actually run appear only after the reveal.
  const shortened = revealed && laps !== null && race.lapsRun < laps;

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
          <CircuitStage name={circuit.name} meta={meta} layout={layout} loading={loading} error={error} />
        </div>

        <div className="min-w-0 lg:sticky lg:top-[calc(var(--nav-h)+3.6rem)] lg:self-start">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
            <Stat label="Lap length" value={length ? `${(length / 1000).toFixed(3)} km` : "n/a"} valueClassName="text-[2.2rem]" />
            <Stat
              label={shortened ? "Laps run" : revealed ? "Race laps" : "Scheduled laps"}
              value={shortened ? race.lapsRun : laps ?? race.lapsRun}
              note={shortened && laps ? `shortened from ${laps}` : laps && length ? `${((laps * length) / 1000).toFixed(1)} km ${revealed ? "distance" : "scheduled distance"}` : undefined}
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
              label={`Fastest lap ${fastestYear}`}
              value={fastest ? lapTime(fastest.ms) : "n/a"}
              note={fastest ? `${driver(fastest.driverId).last}${revealed ? "" : " · previous season"}` : revealed ? undefined : "no earlier season in the data"}
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
            <summary className="flex min-h-11 cursor-pointer items-center font-display text-[1rem] tracking-[0.08em] uppercase hover:text-ink">Where this map comes from</summary>
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

import { useMemo, type KeyboardEvent } from "react";
import { CircuitThumb } from "../../components/CircuitMap";
import { Icon } from "../../components/Icon";
import { Tabs } from "../../components/Bits";
import type { LayoutMeta, RaceMeta } from "../../lib/data";
import { ASSISTS, tierOf, type Assist, type Entrant, type GpRecord } from "./raceEngine";
import { durationHint } from "./grandPrixView";

export type Camera = "follow" | "track";

export interface SetupProps {
  seasons: readonly number[];
  season: number;
  onSeason: (season: number) => void;
  races: readonly RaceMeta[];
  raceId: number;
  onRace: (id: number) => void;
  /** Outline of the chosen race's circuit, for the preview. */
  layout: LayoutMeta | null;
  circuitName: string;
  /** null while the field is loading. */
  entrants: readonly Entrant[] | null;
  loadError: boolean;
  driverId: number | null;
  onDriver: (id: number) => void;
  laps: number;
  onLaps: (laps: number) => void;
  assist: Assist;
  onAssist: (assist: Assist) => void;
  /** Autopilot: the car accelerates by itself and the player only watches. */
  auto: boolean;
  onAuto: (auto: boolean) => void;
  camera: Camera;
  onCamera: (camera: Camera) => void;
  onStart: () => void;
  record: GpRecord;
}

const LAP_CHOICES = [2, 3, 5] as const;

/**
 * Before the race: choose a real Grand Prix and a real driver from its grid. Everything shown about the drivers is known
 * before the start (grid slot and the model's podium score), and nothing about how the real race went.
 */
export function GrandPrixSetup(props: SetupProps) {
  const { entrants, driverId, record } = props;
  const sorted = useMemo(() => (entrants ? [...entrants].sort((a, b) => (a.grid ?? 99) - (b.grid ?? 99) || a.id - b.id) : []), [entrants]);
  const chosen = sorted.find((e) => e.id === driverId) ?? null;
  const best = record.best[String(props.raceId)];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key) || sorted.length === 0) return;
    event.preventDefault();
    const index = Math.max(0, sorted.findIndex((e) => e.id === driverId));
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % sorted.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + sorted.length) % sorted.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = sorted.length - 1;
    props.onDriver(sorted[next].id);
    requestAnimationFrame(() => document.getElementById(`gp-driver-${sorted[next].id}`)?.focus());
  };

  return (
    <div className="p-4 sm:p-7">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="gp-step-race">
            <h4 id="gp-step-race" className="label">1 · Pick a race</h4>
            <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <div className="min-w-0">
                <Tabs<string>
                  value={String(props.season)}
                  onChange={(value) => props.onSeason(Number(value))}
                  idPrefix="gp-season"
                  label="Season"
                  size="sm"
                  options={props.seasons.map((year) => ({ id: String(year), label: String(year) }))}
                />
                <label htmlFor="gp-race" className="sr-only">Grand Prix</label>
                <select id="gp-race" className="select mt-3 w-full" value={props.raceId} onChange={(event) => props.onRace(Number(event.target.value))}>
                  {props.races.map((race) => (
                    <option key={race.id} value={race.id}>
                      Round {race.round} · {race.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[0.85rem] text-mute">
                  {props.circuitName}. A real race, on its real circuit outline.
                  {best !== undefined ? ` Your best finish here: P${best}.` : ""}
                </p>
              </div>
              <div className="grid min-h-28 place-items-center border border-line bg-tower p-3" aria-hidden>
                {props.layout ? <CircuitThumb meta={props.layout} className="h-24 w-full" stroke="#f4f4f2" width={11} accent="#262b33" /> : <span className="text-[0.8rem] text-mute">No outline</span>}
              </div>
            </div>
          </section>

          <section aria-labelledby="gp-step-driver">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 id="gp-step-driver" className="label">2 · Pick your driver</h4>
              <p className="text-[0.82rem] text-mute">{entrants ? `${entrants.length} drivers, in starting-grid order` : ""}</p>
            </div>
            {!entrants && !props.loadError && (
              // Same grid and card height as the loaded list, so choosing a race does not collapse and re-grow the page.
              <>
                <p role="status" className="sr-only">Loading the grid</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" aria-hidden>
                  {Array.from({ length: 20 }, (_, i) => (
                    <div key={i} className="min-h-[7.4rem] animate-pulse border border-line bg-tower motion-reduce:animate-none" />
                  ))}
                </div>
              </>
            )}
            {props.loadError && <p role="alert" className="mt-3 text-steel">This race's grid could not be loaded. Check your connection and try another race.</p>}
            {entrants && (
              <div role="radiogroup" aria-label="Choose your driver" onKeyDown={onKeyDown} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {sorted.map((e) => {
                  const on = e.id === driverId;
                  const tier = tierOf(e, sorted);
                  return (
                    <button
                      key={e.id}
                      id={`gp-driver-${e.id}`}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on || (driverId === null && e === sorted[0]) ? 0 : -1}
                      aria-label={`${e.name}, ${e.team}, starts ${e.grid ? `P${e.grid}` : "from the pit lane"}, ${tier}`}
                      onClick={() => props.onDriver(e.id)}
                      className={`relative flex min-h-[7.4rem] min-w-0 flex-col border p-3 pl-4 text-left transition-colors ${on ? "border-ink bg-panel2" : "border-line bg-tower hover:border-line2"}`}
                    >
                      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: e.colour }} aria-hidden />
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-[1.6rem] leading-none font-bold tracking-wide uppercase">{e.code}</span>
                        <span className="figure text-[1.05rem] text-steel">{e.grid ? `P${e.grid}` : "PIT"}</span>
                      </span>
                      <span className="mt-1 block truncate text-[0.85rem] text-steel">{e.name}</span>
                      <span className="block truncate text-[0.75rem] text-mute">{e.team} · {tier}</span>
                      <span className="mt-auto block pt-2" aria-hidden>
                        <span className="block h-1.5 bg-line">
                          <span className="block h-1.5" style={{ width: `${Math.max(4, e.rating * 100)}%`, background: on ? e.colour : "#6b7480" }} />
                        </span>
                      </span>
                      {on && <Icon name="check" size={16} strokeWidth={2.8} className="absolute right-2 bottom-2 text-ink" />}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-[0.82rem] leading-snug text-mute">
              The bar under each driver is the car's pace in this game. A front-runner is quicker everywhere, so winning from the back is hard and a clean race from the midfield can still score.
            </p>
          </section>
        </div>

        <aside className="min-w-0 space-y-6 border-t border-line pt-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6" aria-label="Race settings">
          <div>
            <h4 className="label">3 · Race settings</h4>
            <p className="mt-3 text-[0.9rem] font-semibold text-ink">Distance</p>
            <Tabs<string>
              value={String(props.laps)}
              onChange={(v) => props.onLaps(Number(v))}
              idPrefix="gp-laps"
              label="Number of laps"
              size="sm"
              className="mt-1.5"
              options={LAP_CHOICES.map((n) => ({ id: String(n), label: `${n} laps` }))}
            />
            <p className="mt-1.5 text-[0.8rem] text-mute">{durationHint(props.laps)}</p>
          </div>

          <div>
            <p className="text-[0.9rem] font-semibold text-ink">Driving</p>
            <Tabs<Assist>
              value={props.assist}
              onChange={props.onAssist}
              idPrefix="gp-assist"
              label="Driving assistance"
              size="sm"
              className="mt-1.5"
              options={(Object.keys(ASSISTS) as Assist[]).map((a) => ({ id: a, label: ASSISTS[a].label, disabled: props.auto }))}
            />
            <p className="mt-1.5 text-[0.82rem] leading-snug text-steel">{props.auto ? ASSISTS.assisted.blurb : ASSISTS[props.assist].blurb}</p>
            <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 border-t border-line pt-3 text-[0.86rem] leading-snug text-steel">
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-signal)]" checked={props.auto} onChange={(event) => props.onAuto(event.target.checked)} />
              <span>
                <span className="font-semibold text-ink">Autopilot.</span> The car accelerates and brakes by itself, so you can watch the race with no input. It is not added to your record.
              </span>
            </label>
          </div>

          <div>
            <p className="text-[0.9rem] font-semibold text-ink">Camera</p>
            <Tabs<Camera>
              value={props.camera}
              onChange={props.onCamera}
              idPrefix="gp-camera"
              label="Camera"
              size="sm"
              className="mt-1.5"
              options={[
                { id: "follow", label: "Follow my car" },
                { id: "track", label: "Whole track" },
              ]}
            />
          </div>

          <div className="border-t border-line pt-5">
            <button type="button" className="btn min-h-14 w-full !text-[1.2rem]" disabled={!chosen || !entrants} onClick={props.onStart}>
              {chosen ? `Race as ${chosen.last}` : "Choose a driver"} <Icon name="flag" size={18} />
            </button>
            <p className="mt-2 text-center text-[0.8rem] text-mute">Hold Space, press and hold the button, or touch and hold to accelerate. Release to brake.</p>
          </div>

          <dl className="grid grid-cols-4 gap-px bg-line text-center" aria-label="Your Grand Prix record on this device">
            {[
              ["Races", record.races],
              ["Wins", record.wins],
              ["Podiums", record.podiums],
              ["Points", record.points],
            ].map(([label, value]) => (
              <div key={label} className="bg-panel px-1 py-2">
                <dt className="label !text-[0.62rem]">{label}</dt>
                <dd className="figure mt-0.5 text-[1.3rem]">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}

import { useId } from "react";

export type MapLayer = "corners" | "sectors" | "drs";
export type LayerState = "on" | "off" | "unavailable";

export const LAYERS: readonly MapLayer[] = ["corners", "sectors", "drs"];

export const LAYER_LABELS: Record<MapLayer, string> = {
  corners: "Corner numbers",
  sectors: "Sector colours",
  drs: "DRS usage",
};

/** How a layer is named in a sentence. "DRS" stays capitalised, so this is not just a lower-cased label. */
const LAYER_SPOKEN: Record<MapLayer, string> = {
  corners: "corner numbers",
  sectors: "sector colours",
  drs: "DRS usage",
};

/** Why a layer cannot be drawn. Shown as text, never only as a tooltip. */
const LAYER_UNAVAILABLE: Record<MapLayer, string> = {
  corners: "Corner numbers are not drawn: the data has no corner positions for this layout.",
  sectors: "Sector colours are not drawn: there is no sector telemetry for this layout.",
  drs: "DRS usage is not drawn: there is no DRS telemetry for this layout.",
};

export interface LayerStatus {
  layer: MapLayer;
  label: string;
  state: LayerState;
}

/** A layer that has no data is "unavailable" whatever the user last chose; otherwise it follows the toggle. */
export function layerStatuses(layers: Record<MapLayer, boolean>, available: Record<MapLayer, boolean>): LayerStatus[] {
  return LAYERS.map((layer) => ({
    layer,
    label: LAYER_LABELS[layer],
    state: !available[layer] ? "unavailable" : layers[layer] ? "on" : "off",
  }));
}

/** The sentence a screen reader hears after any change. */
export function layerAnnouncement(statuses: LayerStatus[]): string {
  const on = statuses.filter((s) => s.state === "on").map((s) => LAYER_SPOKEN[s.layer]);
  const unavailable = statuses.filter((s) => s.state === "unavailable").map((s) => LAYER_SPOKEN[s.layer]);
  const shown = on.length ? `Showing ${on.join(", ")}.` : "No map overlays are showing.";
  return unavailable.length ? `${shown} Not available for this layout: ${unavailable.join(", ")}.` : shown;
}

/** Visible explanation for every unavailable layer, so the reason does not depend on hovering. */
export function unavailableNotes(statuses: LayerStatus[]): string[] {
  const missing = statuses.filter((s) => s.state === "unavailable");
  if (missing.length === statuses.length) return ["No overlays are available: the data for this layout holds the outline only."];
  return missing.map((s) => LAYER_UNAVAILABLE[s.layer]);
}

const STATE_TEXT: Record<LayerState, string> = { on: "On", off: "Off", unavailable: "No data" };

/**
 * Three independent overlay switches for a track map. Each is a real switch (role, checked state, visible
 * On / Off / No data text) so the state never relies on colour alone, and each is at least 44 px tall to
 * work on touch screens.
 */
export function MapLayerControls({
  layers,
  available,
  onToggle,
}: {
  layers: Record<MapLayer, boolean>;
  available: Record<MapLayer, boolean>;
  onToggle: (layer: MapLayer) => void;
}) {
  const headingId = useId();
  const statuses = layerStatuses(layers, available);
  const notes = unavailableNotes(statuses);
  return (
    <div role="group" aria-labelledby={headingId} className="min-w-0">
      <p id={headingId} className="label mb-2">
        Map overlays <span className="font-normal tracking-normal text-mute normal-case">· drawn on the outline</span>
      </p>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {statuses.map(({ layer, label, state }) => {
          const on = state === "on";
          const off = state === "unavailable";
          return (
            <button
              key={layer}
              type="button"
              role="switch"
              aria-checked={on}
              disabled={off}
              onClick={() => onToggle(layer)}
              className={`group flex min-h-11 min-w-0 flex-col items-start justify-center gap-1.5 border px-2.5 py-2 text-left transition-colors sm:flex-row sm:items-center sm:gap-2.5 sm:px-3 ${
                off
                  ? "cursor-not-allowed border-dashed border-line bg-transparent text-mute"
                  : on
                    ? "border-ink/70 bg-panel2 text-ink hover:border-ink"
                    : "border-line2 bg-transparent text-steel hover:border-steel hover:text-ink"
              }`}
            >
              <span
                aria-hidden
                className={`relative h-[18px] w-8 shrink-0 border ${on ? "border-ink bg-ink" : off ? "border-line bg-transparent" : "border-line2 bg-tower"}`}
              >
                <span
                  className={`absolute top-[2px] h-3 w-3 transition-transform ${on ? "translate-x-[14px] bg-paper" : off ? "translate-x-[2px] bg-line2" : "translate-x-[2px] bg-mute"}`}
                />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[0.86rem] leading-[1.05] font-bold tracking-[0.06em] uppercase sm:text-[0.92rem]">{label}</span>
                <span className={`mt-0.5 block text-[0.72rem] leading-none font-semibold tracking-[0.08em] uppercase ${on ? "text-ink" : "text-mute"}`}>{STATE_TEXT[state]}</span>
              </span>
            </button>
          );
        })}
      </div>
      {notes.length > 0 && (
        <p className="mt-2 text-[0.85rem] leading-snug text-mute">{notes.join(" ")}</p>
      )}
      <p className="sr-only" role="status">
        {layerAnnouncement(statuses)}
      </p>
    </div>
  );
}

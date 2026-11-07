import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { CircuitMap, SECTOR_COLOURS } from "./CircuitMap";
import { Icon } from "./Icon";
import { LightsLoader } from "./Bits";
import { MapLayerControls, type MapLayer } from "./MapLayerControls";
import type { Layout, LayoutMeta } from "../lib/data";
import {
  canZoomIn,
  canZoomOut,
  initialView,
  isDefaultView,
  keyToAction,
  pixelToMap,
  reduceView,
  unitsPerPixel,
  viewBoxFor,
  zoomLabel,
  type MapAction,
  type MapView,
} from "../lib/mapView";

const DEFAULT_LAYERS: Record<MapLayer, boolean> = { corners: true, sectors: false, drs: false };

/**
 * The circuit map as one unit: the outline, zoom and pan, the overlay switches docked to the frame, and
 * the legends that go with whichever overlays are on. Race pages and circuit pages share it so the two
 * can never drift apart. It draws only what the layout file contains: a layer with no data is switched
 * off and says so.
 */
export function CircuitStage({
  name,
  meta,
  layout,
  loading,
  error,
  maxHeight = 520,
  onCorner,
}: {
  name: string;
  meta: Pick<LayoutMeta, "id" | "file" | "note">;
  layout: Layout | null;
  loading: boolean;
  error?: Error | null;
  maxHeight?: number;
  onCorner?: (corner: number | null) => void;
}) {
  // useResource keeps the previous layout while the next one loads; never draw it under the wrong layout tab.
  const current = layout && layout.id === meta.id ? layout : null;

  return (
    <div>
      <div className="border border-line bg-tower">
        {!meta.file ? (
          <p className="grid min-h-56 place-items-center px-6 py-10 text-center text-steel">{meta.note ?? "No verified outline is available for this layout."}</p>
        ) : error && !current ? (
          <p role="alert" className="grid min-h-56 place-items-center px-6 py-10 text-center text-steel">
            The circuit file could not be loaded. Check your connection and reload the page.
          </p>
        ) : !current ? (
          <div className="min-h-56">{loading && <LightsLoader label="Loading the circuit" />}</div>
        ) : (
          <LoadedStage key={current.id} name={name} layout={current} maxHeight={maxHeight} onCorner={onCorner} />
        )}
      </div>
    </div>
  );
}

function LoadedStage({ name, layout, maxHeight, onCorner }: { name: string; layout: Layout; maxHeight: number; onCorner?: (corner: number | null) => void }) {
  const [w, h] = layout.viewBox;
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [view, setView] = useState<MapView>(() => initialView(w, h));
  const [pinnedSector, setPinnedSector] = useState<number | null>(null);
  const [hoverSector, setHoverSector] = useState<number | null>(null);
  const [pinnedDrs, setPinnedDrs] = useState<number | null>(null);
  const [hoverDrs, setHoverDrs] = useState<number | null>(null);
  const [corner, setCorner] = useState<number | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);

  const available = useMemo(
    () => ({ corners: layout.corners.length > 0, sectors: Boolean(layout.sectors), drs: Boolean(layout.drs?.length) }),
    [layout],
  );
  const apply = useCallback((action: MapAction) => setView((prev) => reduceView(prev, action, w, h)), [w, h]);
  const box = viewBoxFor(view, w, h);
  const zoomed = !isDefaultView(view, w, h);

  const svgSize = () => {
    const svg = region.current?.querySelector("svg");
    const rect = svg?.getBoundingClientRect();
    return svg && rect ? { rect, width: rect.width, height: rect.height } : null;
  };

  // Ctrl or pinch on a trackpad zooms under the cursor. A plain wheel still scrolls the page.
  useEffect(() => {
    const node = region.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const size = svgSize();
      if (!size) return;
      event.preventDefault();
      const at = pixelToMap(viewBoxFor(view, w, h), size.width, size.height, event.clientX - size.rect.left, event.clientY - size.rect.top);
      apply({ type: "zoomAt", factor: Math.exp(-event.deltaY * 0.01), ...at });
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [view, w, h, apply]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const action = keyToAction(event.key, view, w, h);
    if (!action) return;
    event.preventDefault();
    apply(action);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!zoomed || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinch.current = null;
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(event.pointerId);
    if (!last) return;
    const size = svgSize();
    if (!size) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      const [a, b] = points;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current && distance > 0) {
        const at = pixelToMap(box, size.width, size.height, (a.x + b.x) / 2 - size.rect.left, (a.y + b.y) / 2 - size.rect.top);
        apply({ type: "zoomAt", factor: distance / pinch.current, ...at });
      }
      pinch.current = distance;
      return;
    }
    const unit = unitsPerPixel(box, size.width, size.height);
    apply({ type: "pan", dx: -(event.clientX - last.x) * unit, dy: -(event.clientY - last.y) * unit });
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
  };

  const sector = hoverSector ?? pinnedSector;
  const drs = hoverDrs ?? pinnedDrs;
  const toggleLayer = (layer: MapLayer) => setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  const showSectors = layers.sectors && available.sectors;
  const showDrs = layers.drs && available.drs;

  return (
    <>
      <div
        ref={region}
        role="group"
        tabIndex={0}
        aria-roledescription="zoomable map"
        aria-label={`${name} track map. Press plus or minus to zoom, arrow keys to pan when zoomed in, zero to reset.`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className={`px-3 py-5 select-none sm:px-8 sm:py-8 ${zoomed ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ touchAction: zoomed ? "none" : "pan-y pinch-zoom" }}
      >
        <CircuitMap
          layout={layout}
          className="mx-auto block w-full"
          corners={layers.corners && available.corners}
          sectors={showSectors}
          drs={showDrs}
          activeSector={sector}
          activeDrs={drs}
          onCorner={(n) => {
            setCorner(n);
            onCorner?.(n);
          }}
          box={box}
          maxHeight={maxHeight}
          animateDraw
          label={`${name} track map${layers.corners && available.corners ? " with numbered corners" : ""}${showSectors ? ", sectors coloured" : ""}${showDrs ? ", DRS zones marked" : ""}${zoomed ? `, zoom ${zoomLabel(view)}` : ""}`}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-t border-line bg-panel px-3 py-3 sm:px-4">
        <div role="group" aria-label="Zoom the map" className="min-w-0">
          <p className="label mb-2">
            Zoom{" "}
            <span className="ml-1 font-display text-[0.95rem] text-ink tabular-nums" role="status" aria-label={`Zoom ${zoomLabel(view)}`}>
              {zoomLabel(view)}
            </span>
            <span className="ml-3 font-display text-[0.95rem] text-ink" aria-live="polite">
              {corner !== null ? `Turn ${corner}` : ""}
            </span>
          </p>
          <div className="flex gap-2">
            <ZoomButton label="Zoom out" disabled={!canZoomOut(view)} onClick={() => apply({ type: "out" })}>
              <Icon name="minus" size={18} />
            </ZoomButton>
            <ZoomButton label="Zoom in" disabled={!canZoomIn(view)} onClick={() => apply({ type: "in" })}>
              <Icon name="plus" size={18} />
            </ZoomButton>
            <button
              type="button"
              disabled={!zoomed}
              onClick={() => apply({ type: "reset" })}
              className="inline-flex min-h-11 items-center gap-2 border border-line2 px-3 font-display text-[0.92rem] font-bold tracking-[0.08em] text-ink uppercase transition-colors hover:border-ink disabled:cursor-not-allowed disabled:border-line disabled:text-mute"
            >
              <Icon name="replay" size={16} /> Reset<span className="max-[420px]:sr-only">{" view"}</span>
            </button>
          </div>
        </div>
        <MapLayerControls layers={layers} available={available} onToggle={toggleLayer} />
      </div>

      {(showSectors || showDrs || layout.cornersNote) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-3 py-2.5 text-[0.9rem] text-steel sm:px-4">
          {showSectors && layout.sectors && (
            <Legend label="Sector legend" hint="Press a sector to keep it highlighted">
              {[0, 1, 2].map((i) => (
                <LegendItem
                  key={i}
                  swatch={<span className="h-1.5 w-4" style={{ background: SECTOR_COLOURS[i] }} aria-hidden />}
                  text={`Sector ${i + 1}`}
                  pressed={pinnedSector === i}
                  onHover={(on) => setHoverSector(on ? i : null)}
                  onPress={() => setPinnedSector((prev) => (prev === i ? null : i))}
                />
              ))}
            </Legend>
          )}
          {showDrs && layout.drs && (
            <Legend label="DRS zones" hint="Press a zone to keep it highlighted">
              {layout.drs.map((zone, i) => (
                <LegendItem
                  key={i}
                  swatch={<span className="h-1.5 w-4 bg-drs" aria-hidden />}
                  text={`DRS ${i + 1} · ${zone.lengthM} m`}
                  pressed={pinnedDrs === i}
                  onHover={(on) => setHoverDrs(on ? i : null)}
                  onPress={() => setPinnedDrs((prev) => (prev === i ? null : i))}
                />
              ))}
            </Legend>
          )}
          {layout.cornersNote && <p className="basis-full text-amber">{layout.cornersNote}</p>}
        </div>
      )}
    </>
  );
}

function ZoomButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-grid min-h-11 min-w-11 place-items-center border border-line2 text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:border-line disabled:text-mute"
    >
      {children}
    </button>
  );
}

function Legend({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <ul className="flex flex-wrap gap-x-1 gap-y-1" aria-label={label}>
        {children}
      </ul>
      <p className="sr-only">{hint}.</p>
    </div>
  );
}

function LegendItem({ swatch, text, pressed, onHover, onPress }: { swatch: React.ReactNode; text: string; pressed: boolean; onHover: (on: boolean) => void; onPress: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={pressed}
        onClick={onPress}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        className={`flex min-h-9 items-center gap-2 border px-2 transition-colors ${pressed ? "border-ink text-ink" : "border-transparent hover:border-line2 hover:text-ink"}`}
      >
        {swatch}
        {text}
      </button>
    </li>
  );
}

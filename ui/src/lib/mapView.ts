/**
 * Zoom and pan for a track map, as pure functions.
 *
 * A view is a zoom factor plus the point of the map it is centred on, both in the layout's own viewBox
 * units, so the same state works at any rendered size. Nothing here touches the DOM: components feed in
 * pointer or key events and draw whatever viewBox comes out, which keeps the behaviour unit-testable.
 */

export interface MapView {
  /** 1 shows the whole circuit; larger values magnify. */
  k: number;
  cx: number;
  cy: number;
}

export type ViewBox = readonly [x: number, y: number, width: number, height: number];

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
/** Each press of a zoom button multiplies the magnification by this much. */
export const ZOOM_STEP = 1.6;
/** Arrow keys move the map by this fraction of what is currently visible. */
export const PAN_FRACTION = 0.18;

export type MapAction =
  | { type: "in" }
  | { type: "out" }
  | { type: "reset" }
  | { type: "pan"; dx: number; dy: number }
  | { type: "zoomAt"; factor: number; x: number; y: number };

export function initialView(width: number, height: number): MapView {
  return { k: 1, cx: width / 2, cy: height / 2 };
}

const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

/** Keep the zoom inside its limits and the visible window inside the map. */
export function clampView(view: MapView, width: number, height: number): MapView {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, finite(view.k, 1)));
  const halfW = width / k / 2;
  const halfH = height / k / 2;
  const cx = Math.min(width - halfW, Math.max(halfW, finite(view.cx, width / 2)));
  const cy = Math.min(height - halfH, Math.max(halfH, finite(view.cy, height / 2)));
  return { k, cx, cy };
}

/** The SVG viewBox that shows this view. At zoom 1 it is exactly the full map. */
export function viewBoxFor(view: MapView, width: number, height: number): ViewBox {
  const v = clampView(view, width, height);
  const w = width / v.k;
  const h = height / v.k;
  return [v.cx - w / 2, v.cy - h / 2, w, h];
}

/** Zoom by a factor, keeping the map point (x, y) under the same spot on screen. */
export function zoomAt(view: MapView, factor: number, x: number, y: number, width: number, height: number): MapView {
  const current = clampView(view, width, height);
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.k * factor));
  if (k === current.k) return current;
  // The anchor keeps its relative position inside the window: x = cx + (x - cx) * (1 - k0/k)
  const ratio = current.k / k;
  return clampView({ k, cx: x - (x - current.cx) * ratio, cy: y - (y - current.cy) * ratio }, width, height);
}

export function panBy(view: MapView, dx: number, dy: number, width: number, height: number): MapView {
  const current = clampView(view, width, height);
  return clampView({ ...current, cx: current.cx + dx, cy: current.cy + dy }, width, height);
}

export function reduceView(view: MapView, action: MapAction, width: number, height: number): MapView {
  switch (action.type) {
    case "in":
      return zoomAt(view, ZOOM_STEP, view.cx, view.cy, width, height);
    case "out":
      return zoomAt(view, 1 / ZOOM_STEP, view.cx, view.cy, width, height);
    case "zoomAt":
      return zoomAt(view, action.factor, action.x, action.y, width, height);
    case "pan":
      return panBy(view, action.dx, action.dy, width, height);
    case "reset":
      return initialView(width, height);
  }
}

/**
 * Keyboard contract for the map region: + and - zoom, 0 or Home reset, arrows pan once zoomed in.
 * Returns null for keys the map ignores so the page keeps its normal arrow-key scrolling.
 */
export function keyToAction(key: string, view: MapView, width: number, height: number): MapAction | null {
  switch (key) {
    case "+":
    case "=":
      return { type: "in" };
    case "-":
    case "_":
      return { type: "out" };
    case "0":
    case "Home":
      return { type: "reset" };
  }
  if (view.k <= MIN_ZOOM) return null;
  const stepX = (width / view.k) * PAN_FRACTION;
  const stepY = (height / view.k) * PAN_FRACTION;
  switch (key) {
    case "ArrowLeft":
      return { type: "pan", dx: -stepX, dy: 0 };
    case "ArrowRight":
      return { type: "pan", dx: stepX, dy: 0 };
    case "ArrowUp":
      return { type: "pan", dx: 0, dy: -stepY };
    case "ArrowDown":
      return { type: "pan", dx: 0, dy: stepY };
    default:
      return null;
  }
}

export const canZoomIn = (view: MapView) => view.k < MAX_ZOOM - 1e-9;
export const canZoomOut = (view: MapView) => view.k > MIN_ZOOM + 1e-9;
export const isDefaultView = (view: MapView, width: number, height: number) =>
  view.k <= MIN_ZOOM + 1e-9 && Math.abs(view.cx - width / 2) < 1e-6 && Math.abs(view.cy - height / 2) < 1e-6;

/** "1×", "2.6×": short enough for a toolbar and spoken as "times" by screen readers. */
export function zoomLabel(view: MapView): string {
  const k = Math.round(view.k * 10) / 10;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}×`;
}

/**
 * Map units per screen pixel for an SVG drawn with preserveAspectRatio "meet" inside a box of the given
 * size. Used to turn a pointer drag into a pan and to keep labels the same size on screen at any zoom.
 */
export function unitsPerPixel(box: ViewBox, pixelWidth: number, pixelHeight: number): number {
  const scale = Math.min(pixelWidth / box[2], pixelHeight / box[3]);
  return scale > 0 && Number.isFinite(scale) ? 1 / scale : 1;
}

/** Convert a pixel offset inside the SVG's box to a point in map units (meet, centred). */
export function pixelToMap(box: ViewBox, pixelWidth: number, pixelHeight: number, px: number, py: number): { x: number; y: number } {
  const scale = Math.min(pixelWidth / box[2], pixelHeight / box[3]);
  if (!(scale > 0)) return { x: box[0] + box[2] / 2, y: box[1] + box[3] / 2 };
  const offsetX = (pixelWidth - box[2] * scale) / 2;
  const offsetY = (pixelHeight - box[3] * scale) / 2;
  return { x: box[0] + (px - offsetX) / scale, y: box[1] + (py - offsetY) / scale };
}

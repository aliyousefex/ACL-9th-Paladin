import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  PAN_FRACTION,
  ZOOM_STEP,
  canZoomIn,
  canZoomOut,
  clampView,
  initialView,
  isDefaultView,
  keyToAction,
  panBy,
  pixelToMap,
  reduceView,
  unitsPerPixel,
  viewBoxFor,
  zoomAt,
  zoomLabel,
} from "../src/lib/mapView.ts";

const W = 1000;
const H = 600;
const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

test("the initial view is the whole circuit", () => {
  const view = initialView(W, H);
  assert.deepEqual(viewBoxFor(view, W, H), [0, 0, W, H]);
  assert.ok(isDefaultView(view, W, H));
  assert.equal(zoomLabel(view), "1×");
});

test("zoom stays inside its limits and the window stays inside the map", () => {
  let view = initialView(W, H);
  for (let i = 0; i < 30; i++) view = reduceView(view, { type: "in" }, W, H);
  assert.equal(view.k, MAX_ZOOM);
  assert.equal(canZoomIn(view), false);
  for (let i = 0; i < 60; i++) view = reduceView(view, { type: "out" }, W, H);
  assert.equal(view.k, MIN_ZOOM);
  assert.equal(canZoomOut(view), false);
  // Zooming out past 1x re-centres: nothing is left outside the map.
  assert.deepEqual(viewBoxFor(view, W, H), [0, 0, W, H]);
});

test("zooming under a point keeps that point under the same spot on screen", () => {
  const start = initialView(W, H);
  const anchor = { x: 800, y: 150 };
  const next = zoomAt(start, 2, anchor.x, anchor.y, W, H);
  const [x, y, w, h] = viewBoxFor(next, W, H);
  // Relative position of the anchor inside the visible window is unchanged (0.8, 0.25).
  close((anchor.x - x) / w, 0.8, 1e-6);
  close((anchor.y - y) / h, 0.25, 1e-6);
  assert.equal(next.k, 2);
});

test("an anchor near the edge cannot pull the window outside the map", () => {
  const next = zoomAt(initialView(W, H), 4, 995, 5, W, H);
  const [x, y, w, h] = viewBoxFor(next, W, H);
  assert.ok(x >= 0 && y >= 0 && x + w <= W + 1e-9 && y + h <= H + 1e-9);
});

test("panning moves the window and stops at the map edge", () => {
  let view = reduceView(initialView(W, H), { type: "in" }, W, H);
  const before = viewBoxFor(view, W, H);
  view = panBy(view, 50, -20, W, H);
  const after = viewBoxFor(view, W, H);
  close(after[0], before[0] + 50);
  close(after[1], before[1] - 20);
  view = panBy(view, 1e6, 1e6, W, H);
  const far = viewBoxFor(view, W, H);
  close(far[0] + far[2], W);
  close(far[1] + far[3], H);
  view = panBy(view, -1e6, -1e6, W, H);
  assert.deepEqual([viewBoxFor(view, W, H)[0], viewBoxFor(view, W, H)[1]], [0, 0]);
});

test("reset returns to the default view from anywhere", () => {
  let view = zoomAt(initialView(W, H), 3, 900, 500, W, H);
  view = panBy(view, 30, 30, W, H);
  assert.equal(isDefaultView(view, W, H), false);
  assert.ok(isDefaultView(reduceView(view, { type: "reset" }, W, H), W, H));
});

test("non-finite input never produces a broken viewBox", () => {
  const broken = clampView({ k: Number.NaN, cx: Number.POSITIVE_INFINITY, cy: Number.NaN }, W, H);
  assert.deepEqual(viewBoxFor(broken, W, H), [0, 0, W, H]);
});

test("keyboard contract: plus, minus, zero zoom; arrows pan only once zoomed in", () => {
  const whole = initialView(W, H);
  assert.deepEqual(keyToAction("+", whole, W, H), { type: "in" });
  assert.deepEqual(keyToAction("=", whole, W, H), { type: "in" });
  assert.deepEqual(keyToAction("-", whole, W, H), { type: "out" });
  assert.deepEqual(keyToAction("0", whole, W, H), { type: "reset" });
  assert.deepEqual(keyToAction("Home", whole, W, H), { type: "reset" });
  // At 1x arrows are not captured, so the page keeps scrolling.
  for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) assert.equal(keyToAction(key, whole, W, H), null);
  const zoomed = reduceView(whole, { type: "in" }, W, H);
  const right = keyToAction("ArrowRight", zoomed, W, H);
  assert.equal(right?.type, "pan");
  if (right?.type === "pan") close(right.dx, (W / zoomed.k) * PAN_FRACTION);
  assert.equal(keyToAction("a", zoomed, W, H), null);
  assert.equal(keyToAction("Tab", zoomed, W, H), null);
});

test("each zoom-in press multiplies magnification by the documented step", () => {
  const view = reduceView(initialView(W, H), { type: "in" }, W, H);
  close(view.k, ZOOM_STEP);
  assert.equal(zoomLabel(view), "1.6×");
  assert.equal(zoomLabel({ k: 2, cx: 0, cy: 0 }), "2×");
});

test("pixels convert to map units for a drag and for the cursor position", () => {
  const box = [0, 0, W, H] as const;
  // A 500x300 element draws the 1000x600 map at half size: 2 map units per pixel.
  close(unitsPerPixel(box, 500, 300), 2);
  // A wider element letterboxes the map: the limiting side is the height.
  close(unitsPerPixel(box, 2000, 300), 2);
  const mid = pixelToMap(box, 500, 300, 250, 150);
  close(mid.x, 500);
  close(mid.y, 300);
  // With letterboxing the map is centred, so the element centre is still the map centre.
  const centred = pixelToMap(box, 2000, 300, 1000, 150);
  close(centred.x, 500);
  close(centred.y, 300);
  assert.equal(unitsPerPixel(box, 0, 0), 1);
});

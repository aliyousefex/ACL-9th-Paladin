import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { closeServer, loadModule, render } from "./helpers/ssr.ts";

after(closeServer);

type Layers = Record<"corners" | "sectors" | "drs", boolean>;
const all = (value: boolean): Layers => ({ corners: value, sectors: value, drs: value });
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
const layout = (name: string) => JSON.parse(readFileSync(new URL(`../public/data/circuits/${name}.json`, import.meta.url), "utf8"));

/* ------------------------------------------------------------------ overlay switches */

test("overlay controls render one real switch per layer with a visible state", async () => {
  const { MapLayerControls } = await loadModule<{ MapLayerControls: never }>("/src/components/MapLayerControls.tsx");
  const html = render(MapLayerControls, { layers: { corners: true, sectors: false, drs: true }, available: all(true), onToggle: () => {} });
  assert.equal(count(html, /role="switch"/g), 3);
  assert.deepEqual([...html.matchAll(/aria-checked="(true|false)"/g)].map((m) => m[1]), ["true", "false", "true"]);
  // State is text, not only colour or position.
  assert.match(html, /Corner numbers<\/span><span[^>]*>On</);
  assert.match(html, /Sector colours<\/span><span[^>]*>Off</);
  assert.match(html, /DRS usage<\/span><span[^>]*>On</);
  // The group has a visible name that says what the switches act on.
  assert.match(html, /role="group" aria-labelledby=/);
  assert.match(html, /Map overlays/);
  assert.match(html, /role="status"[^>]*>Showing corner numbers, DRS usage\./);
  assert.equal(count(html, /disabled=""/g), 0);
});

test("a layer with no data is disabled, says so in text, and ignores a stale 'on' choice", async () => {
  const { MapLayerControls } = await loadModule<{ MapLayerControls: never }>("/src/components/MapLayerControls.tsx");
  // The user had sectors on, but this layout has no sector telemetry.
  const html = render(MapLayerControls, { layers: all(true), available: { corners: true, sectors: false, drs: false }, onToggle: () => {} });
  assert.equal(count(html, /disabled=""/g), 2);
  assert.deepEqual([...html.matchAll(/aria-checked="(true|false)"/g)].map((m) => m[1]), ["true", "false", "false"]);
  assert.equal(count(html, /No data/g), 2);
  // The reason is visible copy, not a tooltip.
  assert.match(html, /Sector colours are not drawn: there is no sector telemetry for this layout\./);
  assert.match(html, /DRS usage is not drawn: there is no DRS telemetry for this layout\./);
  assert.ok(!/title=/.test(html), "no tooltip-only explanations");
  assert.match(html, /Showing corner numbers\. Not available for this layout: sector colours, DRS usage\./);
});

test("when nothing is available the control explains that the layout is outline-only", async () => {
  const { MapLayerControls } = await loadModule<{ MapLayerControls: never }>("/src/components/MapLayerControls.tsx");
  const html = render(MapLayerControls, { layers: all(false), available: all(false), onToggle: () => {} });
  assert.equal(count(html, /disabled=""/g), 3);
  assert.match(html, /No overlays are available: the data for this layout holds the outline only\./);
  assert.match(html, /No map overlays are showing\./);
});

/* ------------------------------------------------------------------ circuit stage and map fallbacks */

test("the circuit stage draws a real layout with zoom controls and keyboard hints", async () => {
  const { CircuitStage } = await loadModule<{ CircuitStage: never }>("/src/components/CircuitStage.tsx");
  const bahrain = layout("bahrain");
  const html = render(CircuitStage, { name: "Bahrain International Circuit", meta: { id: bahrain.id, file: "circuits/bahrain.json", note: null }, layout: bahrain, loading: false });
  assert.match(html, /aria-roledescription="zoomable map"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /Press plus or minus to zoom, arrow keys to pan when zoomed in, zero to reset/);
  assert.match(html, /aria-label="Zoom in"/);
  assert.match(html, /aria-label="Zoom out"/);
  // "Reset" is visible on phones and "view" is kept for screen readers there, so the full name is always "Reset view".
  assert.match(html.replace(/<[^>]+>/g, "").replace(/ /g, " "), /Reset view/);
  // At 1x there is nothing to undo or zoom out of.
  assert.match(html, /aria-label="Zoom out"[^>]*disabled=""|disabled=""[^>]*aria-label="Zoom out"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>(?:<svg[^>]*>.*?<\/svg>)? ?Reset<span class="max-\[420px\]:sr-only"> view<\/span><\/button>/s);
  // Bahrain has full telemetry: all three overlays are available, corner numbers start on.
  assert.equal(count(html, /role="switch"/g), 3);
  assert.equal(count(html, /disabled=""/g), 2); // only Zoom out and Reset view
  assert.equal(count(html, /<text /g), bahrain.corners.length);
  assert.match(html, /touch-action:pan-y pinch-zoom/);
});

test("a layout without telemetry or corner positions degrades honestly", async () => {
  const { CircuitStage } = await loadModule<{ CircuitStage: never }>("/src/components/CircuitStage.tsx");
  const sepang = layout("sepang");
  const html = render(CircuitStage, { name: "Sepang", meta: { id: sepang.id, file: "circuits/sepang.json", note: "Outline only." }, layout: sepang, loading: false });
  assert.equal(sepang.corners.length, 0);
  assert.equal(count(html, /<text /g), 0, "no invented corner numbers");
  assert.equal(count(html, /role="switch"[^>]*aria-checked="true"/g), 0);
  assert.match(html, /No overlays are available/);
  assert.match(html, /<path /, "the outline itself is still drawn");

  const ricard = layout("ricard");
  const partial = render(CircuitStage, { name: "Paul Ricard", meta: { id: ricard.id, file: "circuits/ricard.json", note: null }, layout: ricard, loading: false });
  assert.equal(ricard.sectors, null);
  assert.match(partial, /Sector colours are not drawn/);
  assert.equal(count(partial, /<text /g), ricard.corners.length);
});

test("the stage shows the right state while loading, on error, and when the layout has no outline file", async () => {
  const { CircuitStage } = await loadModule<{ CircuitStage: never }>("/src/components/CircuitStage.tsx");
  const base = { name: "Marina Bay", layout: null };
  const none = render(CircuitStage, { ...base, meta: { id: "marina_bay-2022", file: null, note: "2022 layout. Its timing map is not available, so no outline is drawn." }, loading: false });
  assert.match(none, /Its timing map is not available, so no outline is drawn\./);
  assert.equal(count(none, /<svg/g), 0, "nothing is drawn without geometry");
  assert.equal(count(none, /role="switch"/g), 0);

  const noNote = render(CircuitStage, { ...base, meta: { id: "x", file: null, note: null }, loading: false });
  assert.match(noNote, /No verified outline is available for this layout\./);

  const loading = render(CircuitStage, { ...base, meta: { id: "x", file: "circuits/x.json", note: null }, loading: true });
  assert.match(loading, /Loading the circuit/);
  assert.match(loading, /role="status"/);

  const failed = render(CircuitStage, { ...base, meta: { id: "x", file: "circuits/x.json", note: null }, loading: false, error: new Error("404") });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /could not be loaded/);
});

test("a layout left over from another tab is never drawn under the wrong one", async () => {
  const { CircuitStage } = await loadModule<{ CircuitStage: never }>("/src/components/CircuitStage.tsx");
  const bahrain = layout("bahrain");
  const html = render(CircuitStage, { name: "Catalunya", meta: { id: "catalunya-2022", file: "circuits/catalunya-2022.json", note: null }, layout: bahrain, loading: true });
  assert.equal(count(html, /<svg[^>]*role="img"/g), 0);
  assert.match(html, /Loading the circuit/);
});

/* ------------------------------------------------------------------ provenance and footer */

test("every kind of information has its own label, including the viewer's own input", async () => {
  const { Tag, ProvenanceLegend } = await loadModule<{ Tag: never; ProvenanceLegend: never }>("/src/components/Provenance.tsx");
  const legend = render(ProvenanceLegend, {});
  for (const label of ["Model output", "Historical record", "Illustrative", "Simulation", "Your input"]) assert.match(legend, new RegExp(label));
  const user = render(Tag, { kind: "user" });
  assert.match(user, /tag-user/);
  assert.match(user, /Your input/);
  assert.match(legend, /Kept only in your browser/);
  assert.notEqual(render(Tag, { kind: "user" }), render(Tag, { kind: "illustrative" }));
});

test("the footer says Paladin is an independent hobby project with no university affiliation or endorsement", async () => {
  const { Shell } = await loadModule<{ Shell: never }>("/src/components/Shell.tsx");
  const html = render(Shell, { section: "", children: "page" });
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/\s+/g, " ");
  assert.match(text, /Paladin is an independent hobby project and is not affiliated with or endorsed by any university, Formula 1, the FIA, or any team\./);
  assert.match(html, /<footer/);
  // Stated once, in readable body text rather than a fine-print aside.
  assert.equal(count(text, /independent hobby project/gi), 1);
  // No institution is named or implied: the repository does not establish one.
  assert.ok(!/university of|universit[ée] de|college of|institute of technology/i.test(text));
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { closeServer, loadModule, render } from "./helpers/ssr.ts";

after(closeServer);

const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("every page has a skip link, one main landmark, named navigation, and the current page marked", async () => {
  const { Shell } = await loadModule<{ Shell: never }>("/src/components/Shell.tsx");
  const html = render(Shell, { section: "circuits", children: "content" });
  assert.match(html, /<a href="#main"[^>]*>Skip to content<\/a>/);
  assert.equal(count(html, /<main /g), 1);
  assert.match(html, /<main id="main" tabindex="-1"/);
  assert.match(html, /<nav[^>]*aria-label="Primary"/);
  // Primary and bottom navigation both mark the section the viewer is in, and only that one.
  assert.equal(count(html, /aria-current="page"/g), 2);
  assert.match(html, /aria-current="page"[^>]*>(?:<[^>]+>)*Circuits/);
  assert.match(html, /aria-label="Paladin F1, season overview"/);
});

test("the home link and footer links are real links with text, not empty icons", async () => {
  const { Shell } = await loadModule<{ Shell: never }>("/src/components/Shell.tsx");
  const html = render(Shell, { section: "", children: "x" });
  const links = [...html.matchAll(/<a [^>]*>(.*?)<\/a>/gs)].map((m) => ({ tag: m[0], text: m[1].replace(/<[^>]+>/g, "").trim() }));
  assert.ok(links.length > 10);
  for (const link of links) assert.ok(link.text.length > 0 || /aria-label="[^"]+"/.test(link.tag), `link without an accessible name: ${link.tag.slice(0, 80)}`);
});

test("reduced motion removes movement but keeps state feedback", () => {
  const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.ok(block.length > 0, "a reduced-motion block exists");
  assert.match(block, /scroll-behavior:\s*auto\s*!important/);
  for (const selector of [".page-in", ".skeleton", ".pop-in", ".rise"]) assert.ok(block.includes(selector), `${selector} animation is switched off`);
  assert.match(block, /transition-transform/);
  // It must not blanket-disable every transition, or state changes stop being visible.
  assert.ok(!/\*,\s*\*::before,\s*\*::after\s*\{[^}]*transition-duration:\s*1ms/.test(block));
});

test("visible keyboard focus is defined for interactive elements", () => {
  assert.match(css, /:focus-visible/);
});

test("the document does not hide horizontal overflow with a blanket rule", () => {
  // A global overflow-x clip would mask layout defects and cut off focus rings.
  const base = css.slice(css.indexOf("html {"), css.indexOf("body {") + 200);
  assert.ok(!/overflow-x:\s*(clip|hidden)/.test(base));
});

test("map overlay switches are real switches with at least a 44px touch height", async () => {
  const { MapLayerControls } = await loadModule<{ MapLayerControls: never }>("/src/components/MapLayerControls.tsx");
  const html = render(MapLayerControls, { layers: { corners: true, sectors: true, drs: false }, available: { corners: true, sectors: true, drs: true }, onToggle: () => {} });
  assert.equal(count(html, /<button type="button" role="switch"/g), 3);
  assert.equal(count(html, /min-h-11/g), 3, "min-h-11 is 2.75rem = 44px");
  assert.ok(!/aria-pressed/.test(html), "a switch uses aria-checked, not aria-pressed");
});

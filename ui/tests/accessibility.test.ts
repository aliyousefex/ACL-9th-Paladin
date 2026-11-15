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
  // Circuits is an archive that lives under the Season destination, so Season is what is marked.
  assert.equal(count(html, /aria-current="page"/g), 2);
  assert.match(html, /aria-current="page"[^>]*>(?:<[^>]+>)*Season/);
  assert.match(html, /aria-label="Paladin F1, season overview"/);
});

test("the information architecture has exactly five destinations and every page sits under one of them", async () => {
  const { Shell } = await loadModule<{ Shell: never }>("/src/components/Shell.tsx");
  const labels = ["Season", "Race", "Analysis", "Lab", "Research"];
  const home = render(Shell, { section: "", children: "x" });
  const primary = home.match(/<nav[^>]*aria-label="Primary"[^>]*>(.*?)<\/nav>/s)![1];
  const names = [...primary.matchAll(/<a [^>]*href="#[^"]*"[^>]*>(.*?)<\/a>/gs)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  for (const label of labels) assert.ok(names.includes(label), `${label} is a primary destination`);

  // Each real section marks exactly one destination in each of the two navigation surfaces.
  for (const section of ["", "race", "analysis", "race-lab", "model", "method", "drivers", "circuits", "history", "league", "guide"]) {
    const html = render(Shell, { section, children: "x" });
    assert.equal(count(html, /aria-current="page"/g), 2, `section "${section}" is marked once per navigation`);
  }
  // The deep archives are one step away, not hidden: the More menu still links to them.
  assert.match(home, /href="#\/drivers"[^>]*>[\s\S]*?Driver archive/);
  assert.match(home, /href="#\/circuits"[^>]*>[\s\S]*?Circuit archive/);
});

test("More is a disclosure whose list is in the page, closed, named, and marks the page the viewer is on", async () => {
  const { Shell } = await loadModule<{ Shell: never }>("/src/components/Shell.tsx");
  const html = render(Shell, { section: "league", children: "x" });
  // One disclosure per navigation surface (the bar and the dock), each closed and pointing at its own list.
  const triggers = [...html.matchAll(/<button[^>]*aria-expanded="false"[^>]*aria-controls="([^"]+)"[^>]*>/g)];
  assert.equal(triggers.length, 2);
  assert.notEqual(triggers[0][1], triggers[1][1], "each disclosure controls its own list");
  for (const [, id] of triggers) assert.match(html, new RegExp(`<div id="${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" hidden=""[^>]*class="more-panel`));
  for (const label of ["Method and data", "How to read this site", "History graph", "Season league", "Driver archive", "Circuit archive"]) {
    assert.equal(count(html, new RegExp(`more-item__label">${label}<`, "g")), 2, `${label} is in both lists`);
  }
  // The current page is marked in the list without being announced as a second "current page".
  assert.equal(count(html, /data-active="true"/g), 2);
  assert.match(html, /data-active="true"[^>]*class="more-item"[^>]*>[\s\S]*?Season league/);
  assert.equal(count(html, /aria-current="page"/g), 2);
  // The destination that owns the page keeps its emphasis on the trigger.
  assert.equal(count(html, /data-owns="true"/g), 2);
  assert.equal(count(render(Shell, { section: "race", children: "x" }), /data-owns="true"/g), 0);
});

test("the phone dock has one slot per destination plus More, and its pill sits under the current one", async () => {
  const { Shell } = await loadModule<{ Shell: never }>("/src/components/Shell.tsx");
  const dock = (section: string) => render(Shell, { section, children: "x" }).match(/<nav class="dock"[^>]*style="([^"]*)"/)![1];
  assert.match(dock(""), /--i:0;--n:6;--on:1/);
  assert.match(dock("race"), /--i:1;--n:6;--on:1/);
  assert.match(dock("analysis"), /--i:2;/);
  assert.match(dock("race-lab"), /--i:3;/);
  assert.match(dock("model"), /--i:4;/);
  assert.match(dock("method"), /--i:4;/, "Method lives under Research");
  assert.match(dock("guide"), /--i:4;/, "the reading guide lives under Research too");
  assert.match(dock("no-such-page"), /--on:0/, "an unknown page leaves the pill hidden instead of lying");
});

test("the theme control is one named light/dark switch, with decorative icons and no second button", async () => {
  const { ThemeSwitch } = await loadModule<{ ThemeSwitch: never }>("/src/components/ThemeSwitch.tsx");
  const html = render(ThemeSwitch, {});
  // A real switch, named in words: a screen reader says "Dark mode, switch". With no saved choice the page is dark.
  const toggle = html.match(/<button[^>]*role="switch"[^>]*>/)![0];
  assert.match(toggle, /aria-label="Dark mode"/);
  assert.match(toggle, /aria-checked="true"/);
  assert.equal(count(html, /role="switch"/g), 1);
  assert.equal(count(html, /<button/g), 1, "the switch is the whole control");
  assert.doesNotMatch(html, /theme-system|Match my device|role="radio"|theme-switch/);
  assert.equal(count(html, /<svg[^>]*aria-hidden="true"/g), 4, "two hints on the track and two icons on the knob");
  assert.equal(count(html, /<svg(?![^>]*aria-hidden)/g), 0);
});

test("the bar carries the horse alone: no wordmark, no search circle, and the brand link is still named", async () => {
  const { Shell } = await loadModule<{ Shell: never }>("/src/components/Shell.tsx");
  const html = render(Shell, { section: "", children: "x" });
  const brand = html.match(/<a [^>]*class="nav-brand[^"]*"[^>]*>(.*?)<\/a>/s)![0];
  assert.match(brand, /aria-label="Paladin F1, season overview"/);
  assert.doesNotMatch(brand, /<svg/, "the wordmark is not in the bar");
  assert.match(brand, /<img/);
  assert.match(css, /\.site-tool\s*\{[^}]*border:\s*0/s, "search is a bare icon");
});

test("the bar's pills and the dock's stop moving when motion is reduced", () => {
  for (const selector of [".site-nav__pill", ".dock__pill", ".theme-toggle__knob", ".theme-toggle__track"]) {
    const escaped = selector.replace(".", "\\.");
    const pattern = new RegExp(`@media \\(prefers-reduced-motion: reduce\\)\\s*\\{[^}]*${escaped}[^}]*\\{[^}]*transition:\\s*none`);
    assert.match(css, pattern, `${selector} stops animating`);
  }
});

test("the glass stays legible: dense enough, the sheen is its own layer, and it turns solid where it cannot blur", () => {
  const block = (selector: string) => css.match(new RegExp(`\\n${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`))![1];
  for (const selector of [".site-bar__inner", ".dock", ".more-panel"]) {
    assert.match(block(selector), /backdrop-filter:\s*blur\(/, `${selector} blurs what is behind it`);
    assert.match(block(selector), /background-color:\s*var\(--glass-bg/, `${selector} is tinted glass`);
    // A gradient on the container would make its labels unmeasurable for the contrast audit; the sheen is a pseudo-element.
    assert.doesNotMatch(block(selector), /background-image|linear-gradient/, `${selector} keeps its sheen off the container`);
  }
  assert.match(css, /\.site-bar__inner::before,\s*\.dock::before\s*\{[^}]*linear-gradient/);
  // Opacity of the tint, dark and light: never so clear that a label can lose its background.
  const dark = css.slice(css.indexOf("/* frosted glass, dark */"), css.indexOf("/* frosted glass, light"));
  const light = css.slice(css.indexOf("/* frosted glass, light"), css.indexOf(".site-bar {"));
  for (const [theme, rules] of [["dark", dark], ["light", light]] as const) {
    const value = Number(rules.match(/--glass-bg:\s*color-mix\(in srgb, var\(--color-[a-z]+\) (\d+)%/)![1]);
    assert.ok(value >= 74, `${theme} glass is ${value}% dense`);
  }
  // Where blur is unavailable, or less transparency is asked for, the surface is solid.
  assert.match(css, /@supports not \(\(-webkit-backdrop-filter: blur\(1px\)\) or \(backdrop-filter: blur\(1px\)\)\)\s*\{[^}]*background-color:\s*var\(--glass-solid\)/s);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)\s*\{[^}]*backdrop-filter:\s*none[^}]*background-color:\s*var\(--glass-solid\)/s);
});

test("pages render inside the shell's single main landmark and never nest another", async () => {
  const { ErrorAtlasPage } = await loadModule<{ ErrorAtlasPage: never }>("/src/features/analysis/ErrorAtlasPage.tsx");
  assert.equal(count(render(ErrorAtlasPage, {}), /<main[\s>]/g), 0);
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

test("the guided path says where the cutoff stands: step 5 is locked until the reveal, then every step is open and marked done", async () => {
  const { GuidedJourney } = await loadModule<{ GuidedJourney: never }>("/src/features/race/GuidedJourney.tsx");
  const race = { predicted: [], baseline: [] } as never;
  const before = render(GuidedJourney, { race, rows: [] as never, revealed: false });
  assert.match(before, /Result hidden until step 4/);
  assert.equal(count(before, /aria-disabled="true"/g), 1, "only the last step is locked");
  assert.equal(count(before, /class="is-locked"/g), 1);
  assert.equal(count(before, /is-done/g), 0);
  assert.match(before, /Unlocks after reveal/);
  // Steps are named for a screen reader with their number, and the numbers themselves are decoration.
  for (const [n, label] of [[1, "Inspect"], [2, "Call"], [3, "Compare"], [4, "Reveal"], [5, "Explain"]] as const) assert.match(before, new RegExp(`Step ${n}: </span>${label}`));
  assert.equal(count(before, /class="journey-node"[^>]*aria-hidden="true"/g), 5);

  const after = render(GuidedJourney, { race, rows: [] as never, revealed: true });
  assert.match(after, /Result revealed/);
  assert.equal(count(after, /aria-disabled/g), 0);
  assert.equal(count(after, /class="is-done"/g), 4);
});

test("changing the theme is a soft-edged wipe with a fade fallback, and neither plays under reduced motion", () => {
  // The incoming theme is masked by a radius that grows, with a feathered edge; the radius defaults to "everything" so a skipped animation hides nothing.
  assert.match(css, /@property --reveal\s*\{[^}]*syntax:\s*"<length>"[^}]*initial-value:\s*9999px/s);
  assert.match(css, /::view-transition-new\(root\)\s*\{[^}]*animation:\s*theme-reveal[^}]*mask-image:\s*radial-gradient\([^;]*var\(--reveal\)\s*-\s*180px[^;]*transparent var\(--reveal\)/s);
  assert.match(css, /@keyframes theme-reveal\s*\{\s*from\s*\{\s*--reveal:\s*0px;\s*\}\s*to\s*\{\s*--reveal:\s*calc\(var\(--vt-r[^)]*\)\s*\+\s*180px\)/s);
  assert.match(css, /html\.theme-fade\s*\*?[^{]*\{[^}]*transition:/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*::view-transition-new\(\*\)[^}]*animation:\s*none/s);
});

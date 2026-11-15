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

test("the theme control is one named day/night switch, drawn in CSS, with no second button", async () => {
  const { ThemeSwitch } = await loadModule<{ ThemeSwitch: never }>("/src/components/ThemeSwitch.tsx");
  const html = render(ThemeSwitch, {});
  // A real switch, named in words: a screen reader says "Dark mode, switch". With no saved choice the page is dark.
  const toggle = html.match(/<button[^>]*role="switch"[^>]*>/)![0];
  assert.match(toggle, /aria-label="Dark mode"/);
  assert.match(toggle, /aria-checked="true"/);
  assert.equal(count(html, /role="switch"/g), 1);
  assert.equal(count(html, /<button/g), 1, "the switch is the whole control");
  assert.doesNotMatch(html, /theme-system|Match my device|role="radio"|theme-switch/);
  // The sun, moon, stars and cloud are CSS shapes inside an aria-hidden track: nothing for a screen reader but the name and state.
  assert.equal(count(html, /<svg/g), 0);
  assert.match(html, /<span class="theme-toggle__track" aria-hidden="true">/);
  assert.equal(count(html, /class="theme-toggle__face theme-toggle__face--(?:sun|moon)"/g), 2, "the knob is a sun and a moon, one face over the other");
});

test("the bar carries the logo mark alone: no wordmark, no search circle, and the brand link is still named", async () => {
  const { Shell } = await loadModule<{ Shell: never }>("/src/components/Shell.tsx");
  const html = render(Shell, { section: "", children: "x" });
  const brand = html.match(/<a [^>]*class="nav-brand[^"]*"[^>]*>(.*?)<\/a>/s)![0];
  assert.match(brand, /aria-label="Paladin F1, season overview"/);
  assert.equal(count(brand, /<svg/g), 1, "one drawing in the brand link");
  assert.match(brand, /<svg[^>]*class="logo-mark /, "and it is the mark");
  assert.doesNotMatch(brand, /viewBox="0 -45/, "the wordmark is not in the bar");
  assert.doesNotMatch(brand, /<img/, "the mark is vector, not a bitmap");
  assert.match(css, /\.site-tool\s*\{[^}]*border:\s*0/s, "search is a bare icon");
});

test("the logo is the supplied mark, drawn from one path that matches the icon source, in a colour that holds on both themes", async () => {
  const { MARK } = await loadModule<{ MARK: { d: string; viewBox: string; aspect: number } }>("/src/components/logo-data.ts");
  const source = readFileSync(new URL("../../scripts/logo-mark.svg", import.meta.url), "utf8");
  assert.equal(MARK.d, source.match(/<path fill="[^"]+" d="([^"]+)"/)![1].trim(), "the page and the icons are drawn from the same path");
  assert.equal(count(MARK.d, /M /g), 8, "the triangle and its seven pieces");
  // Brand blue as supplied on the light page; a lighter tint of the same hue on the dark one (the original is 1.5:1 there).
  assert.match(css, /--color-brand:\s*#8270ff;/);
  assert.match(css, /:root\[data-theme="light"\]\s*\{[^}]*--color-brand:\s*#1800ad;/s);
  assert.match(css, /\.logo-mark\s*\{[^}]*color:\s*var\(--color-brand\)/s);
  // Nothing of the old horse is left to be served.
  assert.doesNotMatch(css, /logo-raster/);
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
  for (const selector of [".site-bar__inner", ".dock", ".to-top"]) {
    assert.match(block(selector), /backdrop-filter:\s*blur\(/, `${selector} blurs what is behind it`);
    assert.match(block(selector), /background-color:\s*var\(--glass-bg/, `${selector} is tinted glass`);
    // A gradient on the container would make its labels unmeasurable for the contrast audit; the sheen is a pseudo-element.
    assert.doesNotMatch(block(selector), /background-image|linear-gradient/, `${selector} keeps its sheen off the container`);
  }
  // The More list opens from inside the frosted bar or dock, where a second blur has no page to blur: it is solid, so nothing
  // behind it shows through as ghost text.
  assert.match(block(".more-panel"), /background-color:\s*var\(--glass-solid\)/);
  assert.doesNotMatch(block(".more-panel"), /backdrop-filter/);
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

test("the search palette is mounted on the body, not inside the frosted bar, and is built for a touchscreen", () => {
  // A frosted ancestor becomes the containing block of fixed descendants, which once shrank the dimmed backdrop to the size of the bar.
  const source = readFileSync(new URL("../src/components/CommandPalette.tsx", import.meta.url), "utf8");
  assert.match(source, /createPortal\(/);
  assert.match(source, /document\.body/);
  // The field has no box of its own, so it must not get the global ring floating around empty space; the row carries the mark.
  assert.match(css, /\.palette__input:focus-visible\s*\{[^}]*outline:\s*none/);
  assert.match(css, /\.palette__field:focus-within\s*\{[^}]*box-shadow:\s*inset/);
  // Words that name keys are for a keyboard only.
  assert.match(css, /\(hover: none\), \(pointer: coarse\)\s*\{\s*\.keyboard-only\s*\{\s*display:\s*none/);
  assert.match(css, /\.palette__hint\s*\{[^}]*display:\s*none/);
  assert.match(css, /\(hover: hover\) and \(pointer: fine\)\s*\{\s*\.palette__hint\s*\{\s*display:\s*block/);
  // The panel never outgrows the part of the screen the on-screen keyboard leaves, and the page behind a phone's palette stays put.
  assert.match(css, /\.palette__panel\s*\{[^}]*max-height:\s*calc\(var\(--vv-h, 100dvh\)/);
  assert.match(css, /html\.palette-open\s*\{\s*overflow:\s*hidden/);
});

test("on a phone the footer, not the body, makes room for the dock, and the hidden bar's shadow stays off screen", () => {
  assert.doesNotMatch(css, /\n\s*body\s*\{[^}]*padding-bottom:\s*var\(--bottom-nav-h\)/);
  assert.match(css, /\.site-footer\s*\{\s*padding-bottom:\s*var\(--bottom-nav-h\)/);
  assert.match(css, /data-chrome="compact"\]\s*\.chrome-bar\s*\{\s*transform:\s*translateY\(calc\(-100% - 3\.5rem\)\)/);
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

test("changing the theme is a quick circle from the switch with a fade fallback, and neither plays under reduced motion", () => {
  // The incoming theme is clipped to a circle that grows from the switch. With no animation there is no clip, so a skipped one hides nothing.
  assert.match(css, /@keyframes theme-reveal\s*\{\s*from\s*\{\s*clip-path:\s*circle\(0px at var\(--vt-x[^)]*\) var\(--vt-y[^)]*\)\);\s*\}\s*to\s*\{\s*clip-path:\s*circle\(var\(--vt-r[^)]*\) at/s);
  // A clip is cheap to animate; a mask changed every frame is not, and it was the slow part.
  assert.doesNotMatch(css, /::view-transition-new\(root\)\s*\{[^}]*mask-image/s);
  assert.doesNotMatch(css, /@property --reveal/);
  // It must feel like an answer to the press: short, and starting fast (the first control point of the curve is above the diagonal).
  const [, ms, x1, y1] = css.match(/::view-transition-new\(root\)\s*\{[^}]*animation:\s*theme-reveal (\d+)ms cubic-bezier\(([\d.]+), ([\d.]+), [\d.]+, [\d.]+\)/s)!.map(Number);
  assert.ok(ms >= 300 && ms <= 600, `${ms}ms is quick without being a flash`);
  assert.ok(y1 > x1 && x1 <= 0.3, `the curve (${x1}, ${y1}) starts fast; the old ease-in one hardly moved for the first 200ms`);
  // There is no page-wide colour fade any more: animating every element's colours froze a phone for seconds. And the wipe itself is
  // for a desktop (a precise pointer): a phone's processor stalls for most of a second on the two extra paints it costs.
  assert.doesNotMatch(css, /theme-fade/);
  const theme = readFileSync(new URL("../src/lib/theme.ts", import.meta.url), "utf8");
  assert.doesNotMatch(theme, /theme-fade/);
  assert.match(theme, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(theme, /typeof doc\.startViewTransition === "function" && canAffordWipe\(\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*::view-transition-new\(\*\)[^}]*animation:\s*none/s);
});

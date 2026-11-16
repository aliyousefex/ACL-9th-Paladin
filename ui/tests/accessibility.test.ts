import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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
  // The kerb, the lane, the floodlights and the car are inside an aria-hidden track: nothing for a screen reader but the name and state.
  assert.equal(count(html, /<svg/g), 1, "one drawing: the car");
  assert.match(html, /<svg class="theme-toggle__car"[^>]*aria-hidden="true"/);
  assert.match(html, /<span class="theme-toggle__track" aria-hidden="true">/);
  assert.equal(count(html, /class="car__wheel"/g), 4, "the car has four wheels");
  assert.equal(count(html, /<i><\/i>/g), 4, "four floodlights");
  assert.match(html, /class="theme-toggle__finish"/, "and a finish line");
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

test("the glass is see-through but legible: its tint is on its own layer, the dropdown is denser glass, and it turns solid where it cannot blur", () => {
  const block = (selector: string) => css.match(new RegExp(`\\n${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`))![1];
  // The tint and the blur live on a layer behind the capsule and the dock, not on the capsule itself: a blurred surface inside
  // another one only sees as far as the outer one, which is why the dropdown had to be solid.
  assert.match(css, /\.site-bar__inner::before,\s*\.dock::before\s*\{[^}]*background:\s*linear-gradient\([^;]*\),\s*var\(--glass-bg\)[^}]*backdrop-filter:\s*blur\(/);
  for (const selector of [".site-bar__inner", ".dock"]) {
    assert.doesNotMatch(block(selector), /backdrop-filter|background-color|linear-gradient/, `${selector} is not itself a blurred surface`);
  }
  // The floating button and the section strip are single surfaces: tinted glass, blurred, with the sheen kept off the container
  // so the contrast audit can still measure their labels.
  assert.match(block(".to-top"), /backdrop-filter:\s*blur\(/);
  assert.match(block(".to-top"), /background-color:\s*var\(--glass-bg\)/);
  assert.doesNotMatch(block(".to-top"), /background-image|linear-gradient/);
  // The dropdown blurs the page behind it too, and is denser than the bar because it holds text.
  assert.match(block(".more-panel"), /background-color:\s*var\(--glass-bg-strong\)/);
  assert.match(block(".more-panel"), /backdrop-filter:\s*blur\(/);
  // How see-through the bar is, dark and light: clearly more transparent than the first 74% and 80%, and never so clear that a label can lose its background.
  const dark = css.slice(css.indexOf("/* frosted glass, dark */"), css.indexOf("/* frosted glass, light"));
  const light = css.slice(css.indexOf("/* frosted glass, light"), css.indexOf(".site-bar {"));
  for (const [theme, rules] of [["dark", dark], ["light", light]] as const) {
    const value = Number(rules.match(/--glass-bg:\s*color-mix\(in srgb, var\(--color-[a-z]+\) (\d+)%/)![1]);
    const strong = Number(rules.match(/--glass-bg-strong:\s*color-mix\(in srgb, var\(--color-[a-z]+\) (\d+)%/)![1]);
    assert.ok(value >= 58 && value <= 70, `${theme} glass is ${value}% dense`);
    assert.ok(strong >= 82, `${theme} dropdown glass is ${strong}% dense`);
  }
  // On the dark theme the idle labels are the brighter of the greys, because they sit on thinner glass.
  assert.match(dark, /--nav-idle:\s*var\(--color-steel\)/);
  // Where blur is unavailable, or less transparency is asked for, the surfaces are solid.
  assert.match(css, /@supports not \(\(-webkit-backdrop-filter: blur\(1px\)\) or \(backdrop-filter: blur\(1px\)\)\)\s*\{\s*\.site-bar__inner::before,\s*\.dock::before\s*\{\s*background:\s*var\(--glass-solid\)/);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)\s*\{\s*\.site-bar__inner::before,\s*\.dock::before\s*\{[^}]*backdrop-filter:\s*none[^}]*background:\s*var\(--glass-solid\)/);
});

test("the More list opens when a mouse rests on it, and a click keeps it open", () => {
  const source = readFileSync(new URL("../src/components/Shell.tsx", import.meta.url), "utf8");
  assert.match(source, /event\.pointerType !== "mouse"/, "only a mouse hovers; a touch is a plain toggle");
  assert.match(source, /placement !== "down"/, "only the top bar's list opens by hover");
  assert.match(source, /setTimeout\(\(\) => setOpen\(true\), \d+\)/, "after a moment's intent");
  assert.match(source, /setTimeout\(\(\) => setOpen\(false\), \d+\)/, "and closes a moment after the pointer leaves");
  // The transparent bridge keeps the pointer inside the menu while it crosses the gap between the button and the list.
  assert.match(css, /\.more-panel--down::before\s*\{[^}]*content:\s*""[^}]*inset:\s*-1\.2rem/);
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

test("changing the theme is one step that the knob leads, with no page-wide animation, and the car shows which theme it is", () => {
  // The page re-styles and repaints in one go; anything animated across that holds the screen still while the browser paints
  // it twice more (a stall of most of a second at a phone's speed), and a colour fade on every element froze a phone for seconds.
  const theme = readFileSync(new URL("../src/lib/theme.ts", import.meta.url), "utf8");
  for (const [name, text] of [["theme.ts", theme], ["index.css", css]] as const) {
    assert.doesNotMatch(text, /startViewTransition|view-transition|theme-fade|theme-reveal/, `${name} has no page-wide transition`);
  }
  // The page changes after two frames, so the switch has started to move first; reduced motion changes at once; a hidden tab still changes.
  assert.match(theme, /requestAnimationFrame\(\(\) => window\.requestAnimationFrame\(once\)\)/);
  assert.match(theme, /prefers-reduced-motion: reduce\)"\)\.matches\) return update\(\)/);
  assert.match(theme, /setTimeout\(once, \d+\)/);
  // The control itself is quick, and moves by transform (which carries on while the page is busy repainting).
  const knob = css.match(/\n\.theme-toggle__knob\s*\{[^}]*transition:\s*transform (\d+)ms/)!;
  assert.ok(Number(knob[1]) <= 300, `the knob takes ${knob[1]}ms`);
  assert.doesNotMatch(css.match(/\n\.theme-toggle__knob\s*\{([^}]*)\}/)![1], /transition:[^;]*(?:left|width|top)/);
  // The car has a real stretch of lane to drive, and the car stays inside the lane at both ends.
  // The switch is sized in pixels: it is a drawing and a tap target, and must not outgrow the bar when the reader enlarges their text.
  const px = (name: string) => Number(css.match(new RegExp(`--${name}:\\s*(\\d+)px`))![1]);
  const lane = px("track-w") - 2 * px("kerb");
  const travel = lane - px("knob-w") - 2 * px("inset");
  assert.ok(travel >= 24, `the car drives ${travel}px`);
  assert.ok(px("knob-h") < lane / 4, "and it is a car, longer than it is wide");
  assert.match(css, /--bar-h:\s*56px/);
  assert.match(css, /--dock-h:\s*64px/);
  // It turns round at the end of the drive, not the start (a delay), so it always goes forwards; and it is a light car by day and a dark one by night.
  assert.match(css, /\.theme-toggle__car\s*\{[^}]*transition:\s*transform \d+ms ease 1\d\dms/s, "the turn is delayed");
  assert.match(css, /\.theme-toggle\[aria-checked="true"\] \.theme-toggle__car\s*\{[^}]*transform:\s*scaleX\(-1\)/s, "it faces back down the lane at night");
  const hex = (text: string, name: string) => text.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`))![1];
  const day = css.match(/\.theme-toggle__car\s*\{([^}]*)\}/)![1];
  const night = css.match(/\.theme-toggle\[aria-checked="true"\] \.theme-toggle__car\s*\{([^}]*)\}/)![1];
  const lum = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  assert.ok(lum(hex(day, "--car-body")) > 0.7 && lum(hex(night, "--car-body")) < 0.05, "a pale car by day and a carbon one by night");
  // It can be seen on its lane in both: the day car against the lightest asphalt, the night car's rim light against the darkest.
  assert.ok(ratio(hex(day, "--car-body"), "#979da8") >= 2, "the day car on the asphalt");
  assert.ok(ratio(hex(night, "--car-edge"), "#171a21") >= 3, "the night car's edge on the dark lane");
  assert.match(css, /\.theme-toggle\[aria-checked="true"\] \.car__beam[\s\S]*?opacity:\s*1/, "its headlamp beams come on at night");
});

test("the capsule answers a deliberate gesture, and the section strip moves with it by transform, never by snapping", async () => {
  const { HIDE_AFTER, SHOW_AFTER } = await loadModule<{ HIDE_AFTER: number; SHOW_AFTER: number }>("/src/components/Shell.tsx");
  // At 10px each way it flickered in and out under a jittery thumb. A little down puts it away; a real pull up brings it back.
  assert.ok(HIDE_AFTER >= 20 && HIDE_AFTER <= 40, `hide after ${HIDE_AFTER}px`);
  assert.ok(SHOW_AFTER >= 48 && SHOW_AFTER > HIDE_AFTER, `show after ${SHOW_AFTER}px`);
  const shell = readFileSync(new URL("../src/components/Shell.tsx", import.meta.url), "utf8");
  assert.match(shell, /Math\.sign\(delta\) === Math\.sign\(travel\) \? travel \+ delta : delta/, "the distance restarts whenever the direction changes");
  // The strip follows the capsule on the same curve over the same time, so they read as one piece.
  const ms = (pattern: RegExp) => css.match(pattern)![1];
  assert.equal(ms(/\.chrome-bar\s*\{\s*transition:\s*transform (\d+)ms var\(--ease-out\)/), ms(/\.subnav\[data-stuck="true"\]\s*\{[^}]*transition:\s*transform (\d+)ms var\(--ease-out\)/));
  assert.match(css, /\.subnav\[data-stuck="true"\]\s*\{\s*transform:\s*translateY\(var\(--chrome-shift\)\)/);
  assert.match(css, /:root\[data-chrome="compact"\]\s*\{\s*--chrome-shift:\s*0px/);
  // Every page with a strip uses it, and none sets the strip's `top` by hand any more (that snapped it 56px at a time).
  for (const page of ["race/RacePage", "method/MethodPage", "model/ModelPage"]) {
    const source = readFileSync(new URL(`../src/features/${page}.tsx`, import.meta.url), "utf8");
    assert.match(source, /<SectionStrip/, `${page} uses the shared strip`);
    assert.doesNotMatch(source, /top: "var\(--sticky-top\)"/, `${page} does not move its strip with \`top\``);
  }
});

test("the section strip is the top bar's own material, shape and width, docked just under it, so the two merge", () => {
  const block = (selector: string) => css.match(new RegExp(`\\n${selector.replace(/[.[\]]/g, "\\$&")}\\s*\\{([^}]*)\\}`))![1];
  const strip = block(".subnav");
  // The same glass, the same pill, the same widest width as the capsule: nothing changes shape where they meet.
  assert.match(strip, /border-radius:\s*999px/);
  assert.match(strip, /backdrop-filter:\s*blur\(12px\)/);
  assert.match(strip, /background-color:\s*var\(--glass-bg\)/);
  assert.match(strip, /box-shadow:\s*var\(--glass-shadow\)/);
  assert.match(strip, /width:\s*min\(1240px,/);
  assert.match(block(".site-bar__inner"), /max-width:\s*1240px/);
  // It docks 8px under the capsule (the capsule ends at bar-h + 0.5rem; the strip sticks at bar-h + 1rem), and a flat band is gone.
  assert.match(css, /--sticky-top:\s*calc\(var\(--bar-h\) \+ 1rem \+ env\(safe-area-inset-top\)\)/);
  assert.doesNotMatch(strip, /border-bottom|bg-tower/);
  // The current tab is marked like the main navigation marks the current page: a tonal pill, not a red underline.
  assert.match(css, /\.subnav__link\[aria-current="true"\]\s*\{[^}]*background-color:\s*var\(--glass-pill\)/);
});

test("nothing bounces: no easing curve in the stylesheet overshoots, and no page title carries a small label above it", () => {
  // A cubic-bezier whose y values leave 0..1 overshoots its target and springs back: that is the "bounce".
  const curves = [...css.matchAll(/cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)];
  assert.ok(curves.length >= 3);
  for (const [text, , y1, , y2] of curves) assert.ok(Number(y1) >= 0 && Number(y1) <= 1 && Number(y2) >= 0 && Number(y2) <= 1, `${text} overshoots`);
  assert.doesNotMatch(css, /@keyframes[^{]*(?:bounce|spring|wobble)/i);
  // The small label above a page title repeated the page's own name and read as decoration; breadcrumbs are links with an arrow.
  assert.doesNotMatch(css, /\.eyebrow\b/);
  const walk = (dir: URL, found: string[] = []): string[] => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
      if (entry.isDirectory()) walk(next, found);
      else if (/\.tsx$/.test(entry.name) && /className=["{`]\s*[^"`}]*\beyebrow\b/.test(readFileSync(next, "utf8"))) found.push(entry.name);
    }
    return found;
  };
  assert.deepEqual(walk(new URL("../src/", import.meta.url)), [], "no component uses the eyebrow class");
});

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { THEME_CHROME, applyTheme, parsePref, resolveTheme } from "../src/lib/theme.ts";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

/** Colour tokens declared in a block of CSS: `--color-name: #rrggbb;`. */
function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2].toLowerCase()]));
}
const theme = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")));
const lightStart = css.indexOf(':root[data-theme="light"] {');
const dark = tokens(theme);
const light = tokens(css.slice(lightStart, css.indexOf("\n}", lightStart)));

const luminance = (hex: string) => {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const SURFACES = ["paper", "tower", "panel", "panel2"];

test("the light theme defines every colour the dark theme does, and nothing the dark theme lacks", () => {
  const missing = Object.keys(dark).filter((name) => !(name in light));
  assert.deepEqual(missing, [], "a colour defined only for dark would stay dark on the light page");
  assert.deepEqual(Object.keys(light).filter((name) => !(name in dark)), []);
  assert.ok(Object.keys(dark).length >= 20);
});

for (const [name, palette] of [["dark", dark], ["light", light]] as const) {
  test(`${name}: every text colour is readable on every surface (WCAG AA, 4.5:1)`, () => {
    for (const fg of ["ink", "steel", "mute", "signal-text", "hit", "amber", "gold", "silver", "bronze"]) {
      for (const surface of SURFACES) {
        const value = ratio(palette[fg], palette[surface]);
        assert.ok(value >= 4.5, `${name}: ${fg} on ${surface} is ${value.toFixed(2)}:1`);
      }
    }
  });

  test(`${name}: controls can be seen and the red button is readable (WCAG non-text 3:1, button text 4.5:1)`, () => {
    for (const surface of SURFACES) {
      assert.ok(ratio(palette.control, palette[surface]) >= 3, `${name}: control border on ${surface} is ${ratio(palette.control, palette[surface]).toFixed(2)}:1`);
      assert.ok(ratio(palette.signal, palette[surface]) >= 3, `${name}: signal red on ${surface}`);
    }
    assert.ok(ratio("#ffffff", palette.signal) >= 4.5, `${name}: white on the red button is ${ratio("#ffffff", palette.signal).toFixed(2)}:1`);
    for (const medal of ["gold", "silver", "bronze"]) assert.ok(ratio(palette["on-medal"], palette[medal]) >= 4.5, `${name}: text on ${medal}`);
    assert.ok(ratio(palette.paper, palette.hit) >= 4.5, `${name}: text on a hit chip`);
    assert.ok(ratio(palette.fastest, palette.panel) >= 3, `${name}: the fastest-lap purple`);
  });
}

test("the decorative hairlines are deliberately fainter than the control border, so a control stands out from a divider", () => {
  for (const palette of [dark, light]) {
    for (const surface of SURFACES) assert.ok(ratio(palette.control, palette[surface]) > ratio(palette["line2"], palette[surface]) + 0.5);
  }
});

test("the theme is chosen by data-theme, and the light block sets color-scheme so native controls follow", () => {
  assert.match(css, /:root\[data-theme="light"\]\s*\{\s*color-scheme:\s*light;/);
  assert.match(css, /color-scheme:\s*dark;/);
  assert.match(html, /<meta name="color-scheme" content="dark light"/);
  assert.match(html, /<meta name="theme-color" content="#0a0b0e"/);
});

test("a stored value is trusted only if it is exactly light or dark; anything else follows the device", () => {
  assert.equal(parsePref("light"), "light");
  assert.equal(parsePref("dark"), "dark");
  for (const bad of [null, undefined, "", "system", "LIGHT", "auto", "{}"]) assert.equal(parsePref(bad as string | null), "system");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("light", true), "light", "an explicit choice beats the device");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("applying a theme sets the attribute, the saved choice, and the colour of the browser chrome", () => {
  const attrs: Record<string, string> = {};
  const meta = { value: "", setAttribute(_: string, v: string) { this.value = v; } };
  const doc = { documentElement: { dataset: attrs }, querySelector: () => meta } as unknown as Document;
  applyTheme("light", "system", doc);
  assert.deepEqual(attrs, { theme: "light", themePref: "system" });
  assert.equal(meta.value, THEME_CHROME.light);
  applyTheme("dark", "dark", doc);
  assert.equal(attrs.theme, "dark");
  assert.equal(meta.value, THEME_CHROME.dark);
  assert.equal(THEME_CHROME.dark, "#0a0b0e");
  assert.equal(THEME_CHROME.light, light.paper, "the browser chrome matches the page");
});

test("the script that runs before first paint resolves the theme exactly as the module does", () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  const cases: { stored: string | null; systemDark: boolean; throws?: boolean }[] = [
    { stored: null, systemDark: true }, { stored: null, systemDark: false },
    { stored: "light", systemDark: true }, { stored: "dark", systemDark: false },
    { stored: "bogus", systemDark: false }, { stored: "system", systemDark: true },
    { stored: null, systemDark: false, throws: true },
  ];
  for (const { stored, systemDark, throws } of cases) {
    const attrs: Record<string, string> = {};
    const meta = { value: "", setAttribute(_: string, v: string) { this.value = v; } };
    const sandbox = {
      document: { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) }, querySelector: () => meta },
      localStorage: { getItem: () => { if (throws) throw new Error("blocked"); return stored; } },
      window: { matchMedia: () => ({ matches: systemDark }) },
    };
    runInNewContext(script, { ...sandbox, window: { ...sandbox.window } });
    const expected = resolveTheme(parsePref(stored), systemDark);
    assert.equal(attrs["data-theme"], expected, `stored=${stored} systemDark=${systemDark} throws=${throws}`);
    assert.equal(attrs["data-theme-pref"], parsePref(stored));
    assert.equal(meta.value, THEME_CHROME[expected]);
  }
});

test("neutral greys that are design tokens are written as tokens in the code, so they change with the theme", () => {
  const NEUTRAL = /#(?:262b33|39414c|c5cad1|98a0ab|f4f4f2)\b/i;
  // Fixed on purpose: the share card is always dark, and data holds team colours.
  const allowed = new Set(["lib/card.ts", "lib/data.ts", "components/CircuitMap.tsx", "components/VectorRaceCar.tsx", "features/race/ReplayPanel.tsx", "features/games/GrandPrixRace.tsx"]);
  const offenders: string[] = [];
  let visited = 0;
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = `${dir}/${name}`;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(name) && !full.includes("/data/") && !name.endsWith("index.css")) {
        const key = full.slice(full.indexOf("/src/") + 5);
        visited += 1;
        if (!allowed.has(key) && NEUTRAL.test(readFileSync(full, "utf8"))) offenders.push(key);
      }
    }
  };
  walk(new URL("../src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  assert.ok(visited > 60, `the scan really read the source (${visited} files)`);
  assert.deepEqual(offenders, [], "use var(--color-…) so the light theme can recolour it");
});

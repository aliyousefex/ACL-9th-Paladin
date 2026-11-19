import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

/** Colour tokens declared in a block of CSS: `--color-name: #rrggbb;`. */
function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2].toLowerCase()]));
}
const palette = tokens(css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {"))));

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

test("the site has one palette, dark: no light theme, no switch, no stored choice, and the page tells the browser so", () => {
  assert.ok(Object.keys(palette).length >= 20, "the palette is read from the stylesheet");
  assert.doesNotMatch(css, /data-theme|prefers-color-scheme|\.theme-toggle|\.theme-control/, "no second theme in the stylesheet");
  assert.match(css, /color-scheme:\s*dark;/, "native controls and scrollbars are dark");
  assert.match(html, /<meta name="color-scheme" content="dark"\s*\/?>/);
  assert.match(html, /<meta name="theme-color" content="#0a0b0e"/);
  assert.doesNotMatch(html, /paladin:theme|data-theme|<script>/, "no script runs before first paint to pick a theme");
  for (const gone of ["../src/lib/theme.ts", "../src/components/ThemeSwitch.tsx"]) assert.ok(!existsSync(new URL(gone, import.meta.url)), `${gone} is gone`);
});

test("every text colour is readable on every surface (WCAG AA, 4.5:1)", () => {
  // "fastest" is the timing-screen purple: it sets the best value in a comparison, and the legend that says so, in small text
  for (const fg of ["ink", "steel", "mute", "signal-text", "hit", "amber", "gold", "silver", "bronze", "fastest"]) {
    for (const surface of SURFACES) {
      const value = ratio(palette[fg], palette[surface]);
      assert.ok(value >= 4.5, `${fg} on ${surface} is ${value.toFixed(2)}:1`);
    }
  }
});

test("controls can be seen and the red button is readable (WCAG non-text 3:1, button text 4.5:1)", () => {
  for (const surface of SURFACES) {
    assert.ok(ratio(palette.control, palette[surface]) >= 3, `control border on ${surface} is ${ratio(palette.control, palette[surface]).toFixed(2)}:1`);
    assert.ok(ratio(palette.signal, palette[surface]) >= 3, `signal red on ${surface}`);
  }
  assert.ok(ratio("#ffffff", palette.signal) >= 4.5, `white on the red button is ${ratio("#ffffff", palette.signal).toFixed(2)}:1`);
  for (const medal of ["gold", "silver", "bronze"]) assert.ok(ratio(palette["on-medal"], palette[medal]) >= 4.5, `text on ${medal}`);
  assert.ok(ratio(palette.paper, palette.hit) >= 4.5, "text on a hit chip");
  assert.ok(ratio(palette.fastest, palette.panel) >= 3, "the fastest-lap purple");
});

test("the decorative hairlines are deliberately fainter than the control border, so a control stands out from a divider", () => {
  for (const surface of SURFACES) assert.ok(ratio(palette.control, palette[surface]) > ratio(palette["line2"], palette[surface]) + 0.5);
});

test("neutral greys that are design tokens are written as tokens in the code, so the palette has one source", () => {
  const NEUTRAL = /#(?:262b33|39414c|c5cad1|98a0ab|f4f4f2)\b/i;
  // Fixed on purpose: the share card is always dark, data holds team colours, the chequered flag in an event mark is black and white in either theme, and the onboard preview paints canvases and vertex colours, where a CSS variable cannot be read.
  const allowed = new Set(["lib/card.ts", "lib/data.ts", "components/CircuitMap.tsx", "components/VectorRaceCar.tsx", "components/EventMark.tsx", "features/race/ReplayPanel.tsx", "features/games/GrandPrixRace.tsx", "features/home/racing/cars.ts", "features/home/racing/textures.ts"]);
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
  assert.deepEqual(offenders, [], "use var(--color-…) so the palette has one source");
});

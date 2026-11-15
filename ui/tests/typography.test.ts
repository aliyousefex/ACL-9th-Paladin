import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const css = readFileSync(`${root}/index.css`, "utf8");

function sources(dir: string, out: { file: string; text: string }[] = []) {
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) sources(full, out);
    else if (name.endsWith(".tsx")) out.push({ file: full.slice(root.length + 1), text: readFileSync(full, "utf8") });
  }
  return out;
}

/** Drawn illustrations whose labels scale with the picture: a number on a toy car is a graphic, not interface text. */
const ILLUSTRATIONS = new Set(["components/VectorRaceCar.tsx"]);

test("no text in the interface is set below 12px", () => {
  const small: string[] = [];
  for (const { file, text } of sources(root)) {
    if (ILLUSTRATIONS.has(file)) continue;
    for (const m of text.matchAll(/text-\[(0?\.\d+)rem\]/g)) if (parseFloat(m[1]) * 16 < 12) small.push(`${file}: text-[${m[1]}rem]`);
    for (const m of text.matchAll(/fontSize=\{(\d+(?:\.\d+)?)\}/g)) if (parseFloat(m[1]) < 12) small.push(`${file}: fontSize={${m[1]}}`);
  }
  for (const m of css.matchAll(/(?<![\w-])(font-size|font)\s*:\s*([^;}]+)/g)) {
    const size = m[1] === "font" ? m[2].match(/(?:^|\s)(\d*\.?\d+)(rem|px)(?=\s*\/|\s+["'A-Za-z]|$)/) : m[2].match(/^\s*(\d*\.?\d+)(rem|px)\b/);
    if (size && (size[2] === "rem" ? parseFloat(size[1]) * 16 : parseFloat(size[1])) < 12) small.push(`index.css: ${m[0].trim().slice(0, 50)}`);
  }
  assert.deepEqual(small, [], "legibility: keep text at 12px or larger");
});

test("provenance tags, which say what kind of information a panel shows, are a little larger than the floor", () => {
  const tag = css.match(/\.tag \{[^}]*?font-size:\s*([\d.]+)rem/s);
  assert.ok(tag, "the tag rule sets a size");
  assert.ok(parseFloat(tag![1]) * 16 >= 12.8, `tags are ${parseFloat(tag![1]) * 16}px`);
});

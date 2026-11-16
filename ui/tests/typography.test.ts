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

/**
 * Nothing in the interface is called an eyebrow, and no small label sits directly over a heading. A panel's `context` is a line under
 * its title, and a dateline or a verdict line goes under the heading it describes, never over it.
 */
test("no label sits directly over a heading, and nothing is named an eyebrow", () => {
  const found: string[] = [];
  for (const { file, text } of sources(root)) {
    if (/eyebrow/i.test(text)) found.push(`${file}: names something an eyebrow`);
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (!/className="[^"]*\b(label|section-context|panel-context)\b/.test(line) || /<h[1-4]\b/.test(line)) return;
      let next = i + 1;
      while (next < lines.length && !lines[next].trim()) next++;
      if (/<h[1-4]\b|<Heading\b/.test(lines[next] ?? "")) found.push(`${file}:${i + 1}: a label over a heading`);
    });
  }
  assert.deepEqual(found, [], "a label belongs under its heading, as a line of context, or in the heading itself");
});

/**
 * An eyebrow is a small label, muted, all capitals, with the letters spaced out, sitting over a title, a value or a column to name it.
 * They are the most recognisable mark of generated design, so there are none: such a label is sentence case at its natural spacing.
 * Capitals stay where they are the thing itself: a driver's name or code, a heading, a button, a tab, a chip, a banner.
 */
test("no eyebrows: no muted, letter-spaced, all-capitals label sits over anything", () => {
  const controls = new Set(["button", "summary", "a", "select", "option", "NavLink"]);
  const found: string[] = [];
  for (const { file, text } of sources(root)) {
    for (const m of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const classes = m[1] ?? m[2] ?? "";
      if (!/\buppercase\b/.test(classes) || !/\btracking-/.test(classes) || !/\btext-(mute|steel)\b/.test(classes)) continue;
      const tag = text.slice(0, m.index).match(/<([A-Za-z][\w.]*)[^<]*$/)?.[1] ?? "";
      if (controls.has(tag)) continue;
      found.push(`${file}: <${tag}> ${classes.replace(/\s+/g, " ").slice(0, 90)}`);
    }
  }
  assert.deepEqual(found, [], "an eyebrow: drop `uppercase` and the wide `tracking-*`, and keep the size and colour");
  // the same labels made in the stylesheet
  for (const selector of [".driver-chyron span", ".journey-readout span", ".decision-row-head", ".label"]) {
    const rule = css.match(new RegExp(`${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    assert.ok(rule, `${selector} has a rule`);
    assert.doesNotMatch(rule, /text-transform:\s*uppercase/, `${selector} is an eyebrow: sentence case`);
  }
});

/**
 * Screen-reader text (`sr-only`) is absolutely positioned. Inside a table that scrolls sideways, in a wrapper that is not itself
 * positioned, it escapes the scroller and sits wherever its cell is: at the far right of a wide table that is far past the screen,
 * and it widened the whole page by 196px on a phone. The wrapper must be `relative`. (A table's own caption is at its left edge, so
 * it cannot do this.)
 */
test("screen-reader text inside a sideways-scrolling table sits in a positioned scroller, so it cannot widen the page", () => {
  const found: string[] = [];
  for (const { file, text } of sources(root)) {
    for (const m of text.matchAll(/<div className="([^"]*\boverflow-x-auto\b[^"]*)"/g)) {
      if (/\brelative\b/.test(m[1])) continue;
      // only a wrapper that goes straight round a table: a row of pills that scrolls is not one, and must not be run on to the next table
      const opened = text.indexOf(">", m.index) + 1;
      if (!/^\s*<table\b/.test(text.slice(opened))) continue;
      const end = text.indexOf("</table>", m.index);
      const inside = text.slice(m.index, end < 0 ? m.index + 4000 : end).replace(/<caption className="sr-only">/g, "");
      if (/\bsr-only\b/.test(inside)) found.push(`${file}: a scroller with sr-only text in its table is not \`relative\``);
    }
  }
  assert.deepEqual(found, [], "add `relative` to the overflow-x-auto wrapper");
});

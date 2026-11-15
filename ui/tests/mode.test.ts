import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { EXPERT_PANELS, EXPERT_TOOLS, linkNeedsExpert, panelVisible, parseMode } from "../src/lib/mode.ts";

const race = readFileSync(new URL("../src/features/race/RacePage.tsx", import.meta.url), "utf8");

/** The ids of the lazily mounted panels on the race page, read from the source so this cannot drift from it. */
const panelIds = [...race.matchAll(/<Lazy id="([a-z-]+)"/g)].map((match) => match[1]);

test("an unknown, missing or damaged stored value always means Simple", () => {
  assert.equal(parseMode("expert"), "expert");
  assert.equal(parseMode("simple"), "simple");
  for (const bad of [null, undefined, "", "EXPERT", "advanced", "1", "{}"]) assert.equal(parseMode(bad as string | null), "simple");
});

test("Simple mode keeps the path a first-time viewer needs and Expert shows everything", () => {
  for (const id of ["grid", "challenge", "prediction", "firmness", "result", "autopsy"]) {
    assert.equal(panelVisible(id, "simple"), true, `${id} stays in Simple mode`);
  }
  for (const id of EXPERT_PANELS) {
    assert.equal(panelVisible(id, "simple"), false, `${id} is Expert only`);
    assert.equal(panelVisible(id, "expert"), true);
  }
  for (const id of panelIds) assert.equal(panelVisible(id, "expert"), true, `${id} is visible in Expert mode`);
});

test("every expert panel really exists on the race page, and every panel there is either kept or described", () => {
  for (const id of EXPERT_PANELS) assert.ok(panelIds.includes(id), `${id} is a panel on the race page`);
  assert.deepEqual([...EXPERT_TOOLS.map((tool) => tool.id)].sort(), [...EXPERT_PANELS].sort(), "the 'more tools' note describes exactly the hidden panels");
  const hidden = panelIds.filter((id) => !panelVisible(id, "simple"));
  assert.deepEqual([...hidden].sort(), [...EXPERT_PANELS].sort());
  assert.ok(panelIds.length - hidden.length >= 6, "Simple mode still has a full path through the race");
  for (const tool of EXPERT_TOOLS) assert.ok(tool.label && tool.detail);
});

test("the race page filters its panels and navigation by mode, so Simple never shows a dead link", () => {
  assert.match(race, /panelVisible\(/);
  assert.match(race, /SUBNAV\.filter/);
  assert.match(race, /linkNeedsExpert/);
  // the "On this race" navigation and the scroll spy are built from the same visible list
  assert.match(race, /useScrollSpy\(/);
});

test("a shared scenario link opens in Expert view, and other links do not", () => {
  assert.equal(linkNeedsExpert("#/race/2024/abu-dhabi?dl=12&dd=815&ds=5"), true);
  assert.equal(linkNeedsExpert("#/race/2024/abu-dhabi?ds=5&dd=815&dl=12"), true);
  assert.equal(linkNeedsExpert("#/race/2024/abu-dhabi?dl=12&dd=815"), false, "a partial link is not a scenario");
  assert.equal(linkNeedsExpert("#/race/2024/abu-dhabi"), false);
  assert.equal(linkNeedsExpert("#/race/2024/abu-dhabi?present=1"), false);
});

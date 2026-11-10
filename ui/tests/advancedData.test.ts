import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const read = (url: URL) => JSON.parse(readFileSync(url, "utf8"));
const raceDir = new URL("../public/data/races/", import.meta.url);
const advancedDir = new URL("../public/data/advanced/", import.meta.url);
const files = readdirSync(advancedDir).filter((file) => file.endsWith(".json")).sort();

test("every held-out race has a versioned trained research distribution", () => {
  assert.equal(files.length, 68);
  for (const file of files) {
    const advanced = read(new URL(file, advancedDir));
    const race = read(new URL(file, raceDir));
    assert.equal(advanced.contract, "paladin.advanced-research.v1");
    assert.equal(advanced.raceId, Number(file.replace(".json", "")));
    assert.equal(advanced.drivers.length, race.entries.length);
    assert.deepEqual(advanced.drivers.map((row: { d: number }) => row.d).sort((a: number, b: number) => a - b), race.entries.map((row: { d: number }) => row.d).sort((a: number, b: number) => a - b));
    const field = advanced.drivers.length;
    for (const driver of advanced.drivers) {
      assert.equal(driver.o.length, field);
      assert.ok(Math.abs(driver.o.reduce((a: number, b: number) => a + b, 0) - 1) < 1e-4);
      assert.ok(driver.w >= 0 && driver.w <= driver.p && driver.p <= 1);
      assert.ok(driver.r >= 0 && driver.r <= 1);
      assert.ok(driver.e >= 1 && driver.e <= field);
    }
    for (let position = 0; position < field; position++) {
      const total = advanced.drivers.reduce((sum: number, driver: { o: number[] }) => sum + driver.o[position], 0);
      assert.ok(Math.abs(total - 1) < 1e-4, `${file} P${position + 1} sums to ${total}`);
    }
  }
});

test("the advanced summary is explicit that the coursework baseline was not changed", () => {
  const summary = read(new URL("../src/data/advanced-summary.json", import.meta.url));
  assert.equal(summary.officialCourseworkBaselineChanged, false);
  assert.equal(summary.test.races, 68);
  assert.equal(summary.features.length, 39);
  assert.ok(summary.test.podiumBrier < summary.test.gridPodiumBrier);
  assert.ok(summary.test.expectedPositionMAE < summary.test.gridPositionMAE);
});

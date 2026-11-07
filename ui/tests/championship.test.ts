import assert from "node:assert/strict";
import { test } from "node:test";
import { swapChampionshipPoints } from "../src/features/race/championship.ts";

const table = [
  { id: 1, points: 100, originalRank: 1 },
  { id: 2, points: 92, originalRank: 2 },
  { id: 3, points: 70, originalRank: 3 },
];

test("alternate championship conserves the season points pool", () => {
    const result = swapChampionshipPoints(table, 2, 1, 10, 25);
    assert.equal(result.reduce((sum, row) => sum + row.points, 0), 262);
});

test("alternate championship re-ranks drivers after transferring race points", () => {
    const result = swapChampionshipPoints(table, 2, 1, 10, 25);
    assert.deepEqual(result.map((row) => row.id), [2, 1, 3]);
    assert.deepEqual(result.find((row) => row.id === 2), { id: 2, points: 107, originalRank: 2, rank: 1, rankDelta: 1, pointsDelta: 15 });
    assert.deepEqual(result.find((row) => row.id === 1), { id: 1, points: 85, originalRank: 1, rank: 2, rankDelta: -1, pointsDelta: -15 });
});

test("alternate championship leaves every other driver unchanged", () => {
    const result = swapChampionshipPoints(table, 2, 1, 10, 25);
    assert.deepEqual(result.find((row) => row.id === 3), { id: 3, points: 70, originalRank: 3, rank: 3, rankDelta: 0, pointsDelta: 0 });
});

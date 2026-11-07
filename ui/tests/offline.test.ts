import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

test("offline worker keeps navigation and generated data network-first", () => {
  assert.match(worker, /request\.mode === "navigate" \|\| url\.pathname\.startsWith\("\/data\/"\)/);
  assert.match(worker, /event\.respondWith\(networkFirst\(request\)\)/);
  assert.match(worker, /request\.mode === "navigate" \? caches\.match\("\/"\)/);
});

test("offline worker scopes caches and ignores non-GET requests", () => {
  assert.match(worker, /key\.startsWith\("paladin-"\)/);
  assert.match(worker, /request\.method !== "GET"/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
});

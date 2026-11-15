import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { entriesByRace } from "../src/lib/atlas.ts";
import type { Driver, RaceMeta } from "../src/lib/data.ts";
import type { Play } from "../src/lib/league.ts";
import { MAX_NAME, decodeCode, encodeCode, sanitiseNickname } from "../src/lib/shareCode.ts";
import { mulberry32 } from "../src/lib/random.ts";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../src/data/${name}`, import.meta.url), "utf8"));
const races = read("races.json") as RaceMeta[];
const drivers = read("drivers.json").drivers as Driver[];
const field = entriesByRace(races, drivers);
const fieldOf = (raceId: number) => field.get(raceId)?.map((entry) => entry.driverId);

/** Plays whose picks are real drivers from each race's field. */
function plays(count: number, seed = 5): Play[] {
  const random = mulberry32(seed);
  return races.slice(0, count).map((race) => {
    const ids = fieldOf(race.id)!;
    const picks = new Set<number>();
    while (picks.size < 3) picks.add(ids[Math.floor(random() * ids.length)]);
    return { raceId: race.id, picks: [...picks] };
  });
}

test("a code round-trips exactly, for none, a few and every race", () => {
  for (const count of [0, 1, 12, 68]) {
    const original = plays(count);
    const decoded = decodeCode(encodeCode("Sam", original), fieldOf);
    assert.ok(decoded.ok, decoded.ok ? "" : decoded.reason);
    if (decoded.ok) {
      assert.equal(decoded.value.nickname, "Sam");
      assert.deepEqual(decoded.value.plays, original);
    }
  }
  assert.ok(encodeCode("Sam", plays(68)).length < 900, "a whole season still fits in a short paste");
  assert.ok(encodeCode("", plays(0)).startsWith("PAL1-"));
});

test("pasting with spaces and line breaks, as chat apps add them, still works", () => {
  const code = encodeCode("Ana", plays(8));
  const messy = `  ${code.slice(0, 20)}\n${code.slice(20, 60)} \r\n${code.slice(60)}  `;
  const decoded = decodeCode(messy, fieldOf);
  assert.ok(decoded.ok);
});

test("any edit to a code is caught or changes nothing", () => {
  const original = plays(10);
  const code = encodeCode("Sam", original);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let caught = 0;
  let harmless = 0;
  for (let i = 5; i < code.length; i += 7) {
    const swap = alphabet[(alphabet.indexOf(code[i]) + 1) % alphabet.length];
    const edited = code.slice(0, i) + swap + code.slice(i + 1);
    const decoded = decodeCode(edited, fieldOf);
    if (!decoded.ok) caught += 1;
    else {
      assert.deepEqual(decoded.value.plays, original, "an undetected edit must not change the picks");
      harmless += 1;
    }
  }
  assert.ok(caught > 10, `${caught} edits caught, ${harmless} harmless`);
  assert.equal(decodeCode(code.slice(0, code.length - 8), fieldOf).ok, false, "a truncated paste is rejected");
  assert.equal(decodeCode(code + "A", fieldOf).ok, false, "extra characters are rejected");
});

test("things that are not codes get a plain reason", () => {
  for (const bad of ["", "hello", "PAL2-AAAA", "PAL1-", "PAL1-!!!!", "PAL1-AAAAAAAA"]) {
    const result = decodeCode(bad, fieldOf);
    assert.equal(result.ok, false, bad);
    if (!result.ok) assert.ok(result.reason.length > 20);
  }
});

test("picks must be drivers who raced that Grand Prix, and races must exist", () => {
  const race = races[0];
  const outsider = drivers.find((driver) => !fieldOf(race.id)!.includes(driver.id))!.id;
  const [a, b] = fieldOf(race.id)!;
  const wrongDriver = decodeCode(encodeCode("x", [{ raceId: race.id, picks: [a, b, outsider] }]), fieldOf);
  assert.equal(wrongDriver.ok, false);
  const wrongRace = decodeCode(encodeCode("x", [{ raceId: 61234, picks: [a, b, fieldOf(race.id)![2]] }]), fieldOf);
  assert.equal(wrongRace.ok, false);
  const repeated = decodeCode(encodeCode("x", [{ raceId: race.id, picks: [a, a, b] }]), fieldOf);
  assert.equal(repeated.ok, false, "three distinct drivers are required");
  const third = fieldOf(race.id)![2];
  const twice = decodeCode(encodeCode("x", [{ raceId: race.id, picks: [a, b, third] }, { raceId: race.id, picks: [b, a, fieldOf(race.id)![3]] }]), fieldOf);
  assert.ok(twice.ok && twice.value.plays.length === 1 && twice.value.plays[0].picks.join() === [a, b, third].join(), "a repeated race is written once, keeping the first pick");
});

test("a well-formed code is accepted whoever made it, so a code proves nothing about being blind", () => {
  // Anyone can write a valid code by hand: it carries a checksum, not a signature. The league page says so.
  const forged: Play[] = races.slice(0, 5).map((race) => ({ raceId: race.id, picks: race.actual }));
  const decoded = decodeCode(encodeCode("Definitely honest", forged), fieldOf);
  assert.ok(decoded.ok);
  if (decoded.ok) assert.deepEqual(decoded.value.plays, forged);
});

test("nicknames are plain, short and safe to print", () => {
  assert.equal(sanitiseNickname("  Sam   Smith  "), "Sam Smith");
  assert.equal(sanitiseNickname("<script>alert(1)</script>"), "scriptalert1scri", "markup characters are removed, then the name is cut to 16");
  assert.equal(sanitiseNickname("Zoë 🏁"), "Zo");
  assert.equal(sanitiseNickname("a".repeat(40)).length, MAX_NAME);
  assert.equal(sanitiseNickname("....").length, 4);
  assert.equal(sanitiseNickname(""), "");
  const decoded = decodeCode(encodeCode("Zoë 🏁 <b>", plays(2)), fieldOf);
  assert.ok(decoded.ok && decoded.value.nickname === "Zo b");
});

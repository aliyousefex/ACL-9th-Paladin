import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { circuitNetwork, driverLabels, driverSeasons, indexGraph, linksBetween, shortestChain, teammatesOf, type GraphFile } from "../src/lib/graph.ts";
import { mulberry32 } from "../src/lib/random.ts";

const file = JSON.parse(readFileSync(new URL("../public/data/graph/graph.json", import.meta.url), "utf8")) as GraphFile;
const index = indexGraph(file);

/** An independent breadth-first search straight over the raw teammate rows, sharing no code with shortestChain. */
function naiveDistance(from: number, to: number): number | null {
  const adjacent = new Map<number, Set<number>>();
  for (const [a, b] of file.teammates) {
    (adjacent.get(a) ?? adjacent.set(a, new Set()).get(a)!).add(b);
    (adjacent.get(b) ?? adjacent.set(b, new Set()).get(b)!).add(a);
  }
  const seen = new Set([from]);
  let layer = [from];
  for (let d = 0; layer.length; d += 1) {
    if (layer.includes(to)) return d;
    const next: number[] = [];
    for (const u of layer) for (const v of adjacent.get(u) ?? []) if (!seen.has(v)) (seen.add(v), next.push(v));
    layer = next;
  }
  return null;
}

test("the export carries its provenance, the Cypher behind each question, and a stable contract", () => {
  assert.equal(file.contract, "paladin.graph.v1");
  assert.equal(file.source.sha256.length, 64);
  assert.ok(file.source.yearFirst === 1950 && file.source.yearLast === 2024);
  for (const name of ["season_standings", "head_to_head", "driver_history", "materialise_teammates", "teammate_path", "circuit_podium_network"]) {
    assert.ok(file.cypher[name]?.query.includes("MATCH"), name);
  }
  assert.match(file.semantics.points, /Sprint points/);
  assert.equal(index.drivers.size, file.drivers.length);
});

test("picker labels are unique, and each one finds its driver again", () => {
  const { byId, byLabel } = driverLabels(index);
  assert.equal(byId.size, index.drivers.size);
  assert.equal(byLabel.size, index.drivers.size);
  for (const [id, label] of byId) assert.equal(byLabel.get(label), id);
  assert.match(byId.get(1)!, /Lewis Hamilton/);
});

test("a link is oriented from the first driver named, and reversing it swaps who was ahead", () => {
  const forward = linksBetween(index, 1, 822);
  const backward = linksBetween(index, 822, 1);
  assert.equal(forward.length, backward.length);
  assert.ok(forward.length >= 1);
  const mercedes = forward.find((link) => index.constructors.get(link.constructorId) === "Mercedes")!;
  const mirror = backward.find((link) => link.constructorId === mercedes.constructorId)!;
  assert.ok(mercedes.sharedRaces > 80);
  assert.equal(mercedes.fromAhead, mirror.toAhead);
  assert.equal(mercedes.toAhead, mirror.fromAhead);
  assert.ok(mercedes.fromAhead + mercedes.toAhead <= mercedes.sharedRaces);
  assert.deepEqual([...forward].sort((a, b) => b.sharedRaces - a.sharedRaces), forward, "most shared races first");
  assert.deepEqual(linksBetween(index, 1, 999999), []);
});

test("chain length matches an independent search for every random pair, in both directions", () => {
  const random = mulberry32(903);
  const ids = [...index.neighbours.keys()];
  let connected = 0;
  for (let i = 0; i < 150; i += 1) {
    const a = ids[Math.floor(random() * ids.length)];
    const b = ids[Math.floor(random() * ids.length)];
    const expected = naiveDistance(a, b);
    const chain = shortestChain(index, a, b);
    assert.equal(chain?.distance ?? null, expected, `${a} to ${b}`);
    assert.equal(shortestChain(index, b, a)?.distance ?? null, expected, "distance is symmetric");
    if (chain && chain.distance > 0) {
      connected += 1;
      assert.equal(chain.hops[0].from, a);
      assert.equal(chain.hops[chain.hops.length - 1].to, b);
      chain.hops.forEach((hop, h) => {
        if (h > 0) assert.equal(hop.from, chain.hops[h - 1].to, "the chain is unbroken");
        assert.ok(hop.links.length >= 1 && hop.sharedRaces === hop.links.reduce((s, l) => s + l.sharedRaces, 0));
        assert.ok(index.neighbours.get(hop.from)!.includes(hop.to), "every hop is a real teammate link");
      });
    }
  }
  assert.ok(connected > 100, "most drivers are connected to one another");
});

test("among chains of the same length the strongest one is chosen, checked by exhaustive search", () => {
  const random = mulberry32(7);
  const ids = [...index.neighbours.keys()];
  let checked = 0;
  for (let i = 0; i < 400 && checked < 25; i += 1) {
    const a = ids[Math.floor(random() * ids.length)];
    const b = ids[Math.floor(random() * ids.length)];
    const chain = shortestChain(index, a, b);
    if (!chain || chain.distance < 2 || chain.distance > 3) continue;
    const weight = (x: number, y: number) => linksBetween(index, x, y).reduce((s, l) => s + l.sharedRaces, 0);
    let best = -1;
    const walk = (node: number, left: number, total: number, seen: number[]) => {
      if (left === 0) {
        if (node === b) best = Math.max(best, total);
        return;
      }
      for (const next of index.neighbours.get(node) ?? []) if (!seen.includes(next)) walk(next, left - 1, total + weight(node, next), [...seen, next]);
    };
    walk(a, chain.distance, 0, [a]);
    assert.equal(chain.hops.reduce((s, h) => s + h.sharedRaces, 0), best, `${a} to ${b}`);
    checked += 1;
  }
  assert.ok(checked >= 10, `checked ${checked} multi-link chains`);
});

test("teammates are one link apart, strangers are not, and a driver is zero links from themselves", () => {
  assert.equal(shortestChain(index, 1, 822)?.distance, 1);
  assert.equal(shortestChain(index, 1, 1)?.distance, 0);
  assert.deepEqual(shortestChain(index, 1, 1)?.hops, []);
  const verstappen = shortestChain(index, 1, 830)!;
  assert.ok(verstappen.distance >= 2, "Hamilton and Verstappen were never teammates");
  assert.equal(verstappen.distance, naiveDistance(1, 830));
  const loners = [...index.drivers.keys()].filter((id) => !index.neighbours.has(id));
  assert.ok(loners.length > 0, "some drivers never had a teammate in the data");
  assert.equal(shortestChain(index, loners[0], 1), null, "no chain exists, and that is reported rather than invented");
  assert.equal(shortestChain(index, 1, 987654321), null);
});

test("a driver's seasons and teammates read straight from the export", () => {
  const seasons = driverSeasons(index, 1);
  const y2021 = seasons.find((line) => line.year === 2021)!;
  assert.equal(index.constructors.get(y2021.constructorId), "Mercedes");
  assert.equal(y2021.points, 385.5, "race-result points only; the 395.5 and 387.5 official totals include sprint points");
  assert.equal(y2021.wins, 8);
  for (let i = 1; i < seasons.length; i += 1) assert.ok(seasons[i].year >= seasons[i - 1].year);
  const mates = teammatesOf(index, 1);
  assert.equal(mates[0].id, 822, "Bottas shared the most races with Hamilton");
  for (let i = 1; i < mates.length; i += 1) assert.ok(mates[i].sharedRaces <= mates[i - 1].sharedRaces);
  assert.ok(mates.every((m) => m.firstYear <= m.lastYear && m.constructors.length >= 1));
});

test("the circuit network equals a direct count and respects the minimum", () => {
  const monaco = file.circuits.find(([, name]) => name.includes("Monaco"))![0];
  const direct = new Map<number, Set<number>>();
  for (const [circuit, team, driver] of file.podiums) if (circuit === monaco) (direct.get(team) ?? direct.set(team, new Set()).get(team)!).add(driver);
  const three = circuitNetwork(index, monaco, 3);
  assert.deepEqual(three.map((line) => line.constructorId).sort(), [...direct].filter(([, d]) => d.size >= 3).map(([t]) => t).sort());
  assert.ok(three.length >= 1);
  for (let i = 1; i < three.length; i += 1) {
    assert.ok(three[i - 1].distinctDrivers > three[i].distinctDrivers || (three[i - 1].distinctDrivers === three[i].distinctDrivers && three[i - 1].podiums >= three[i].podiums));
  }
  for (const line of three) {
    assert.equal(line.distinctDrivers, line.drivers.length);
    assert.equal(line.podiums, line.drivers.reduce((s, d) => s + d.podiums, 0));
  }
  assert.ok(circuitNetwork(index, monaco, 1).length >= three.length);
  assert.deepEqual(circuitNetwork(index, monaco, 9999), []);
  assert.deepEqual(circuitNetwork(index, 999999, 1), []);
});

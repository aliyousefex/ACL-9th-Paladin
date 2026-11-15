import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { after, test } from "node:test";
import portraits from "../src/data/portraits.json" with { type: "json" };
import { closeServer, loadModule, render } from "./helpers/ssr.ts";

after(closeServer);

const driver = (ref: string) => ({ id: 1, ref, code: "XXX", first: "A", last: "B", name: "A B", nationality: "", flag: null, dob: "", permanentNumber: 1, seasons: {} });

test("every portrait has a 320px copy that exists and is smaller than the original", () => {
  for (const [ref, photo] of Object.entries(portraits) as [string, { file: string; small?: string }][]) {
    assert.ok(photo.small, `${ref} lists a small copy`);
    const small = new URL(`../public/portraits/${photo.small}`, import.meta.url);
    const full = new URL(`../public/portraits/${photo.file}`, import.meta.url);
    assert.ok(existsSync(small), `${photo.small} exists, so srcset can never point at a missing file`);
    assert.ok(statSync(small).size < statSync(full).size, `${ref}: the small copy is smaller`);
  }
});

test("a portrait offers both sizes and tells the browser how wide it is drawn, so a small slot gets the small file", async () => {
  const { Portrait } = await loadModule<{ Portrait: never }>("/src/components/Portrait.tsx");
  const [ref, photo] = Object.entries(portraits)[0] as [string, { file: string; small: string; width: number }];
  const html = render(Portrait, { driver: driver(ref), colour: "#ff0000", number: 1, className: "h-14 w-14", sizes: "56px" });
  assert.match(html, new RegExp(`srcSet="[^"]*${photo.small} 320w, [^"]*${photo.file} ${photo.width}w"`));
  assert.match(html, /sizes="56px"/);
  assert.match(html, new RegExp(`src="[^"]*${photo.file}"`), "the full file is still the fallback src");
  // with no hint the browser is told the portrait may be full width, which keeps the larger file on wide screens
  assert.match(render(Portrait, { driver: driver(ref), colour: "#ff0000", number: 1 }), /sizes="100vw"/);
});

test("a driver card tells the browser how wide a card is at each breakpoint", () => {
  const source = readFileSync(new URL("../src/features/drivers/DriversPage.tsx", import.meta.url), "utf8");
  assert.match(source, /sizes="\(min-width: 1280px\) 300px/);
  // the sizes hint has to agree with the grid: four columns from 1280px
  assert.match(source, /xl:grid-cols-4/);
});

test("a portrait with no small copy gets no srcset rather than a broken one", async () => {
  const { Portrait } = await loadModule<{ Portrait: never }>("/src/components/Portrait.tsx");
  const data = await loadModule<{ PORTRAITS: Record<string, { small?: string }> }>("/src/lib/data.ts");
  const ref = Object.keys(data.PORTRAITS)[0];
  const original = data.PORTRAITS[ref].small;
  delete data.PORTRAITS[ref].small;
  try {
    const html = render(Portrait, { driver: driver(ref), colour: "#ff0000", number: 1 });
    assert.ok(!/srcSet=/.test(html) && !/sizes=/.test(html));
  } finally {
    data.PORTRAITS[ref].small = original;
  }
});

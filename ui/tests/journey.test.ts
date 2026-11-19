import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { closeServer, loadModule, render } from "./helpers/ssr.ts";

after(closeServer);

const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/features/race/GuidedJourney.tsx", import.meta.url), "utf8");

test("the race route says in words where the reader is: the first step is next, the last is locked, the rest are open", async () => {
  const { GuidedJourney } = await loadModule<{ GuidedJourney: never }>("/src/features/race/GuidedJourney.tsx");
  const html = render(GuidedJourney, { race: { predicted: [], baseline: [], actual: [], hits: 0 } as never, rows: [] as never, revealed: false });
  assert.equal(count(html, /data-state="next"/g), 1, "exactly one step is the next one");
  assert.match(html, /data-state="next"><a[^>]*><span class="journey-node"[^>]*>01<\/span><span class="journey-flag"[^>]*>Up next</, "and it is the first");
  assert.equal(count(html, /data-state="locked"/g), 1);
  assert.equal(count(html, /data-state="open"/g), 3);
  assert.match(html, />Locked</);
  assert.equal(count(html, />Open</g), 3);
});

test("once the result is revealed, four steps are done and the last is the one to do", async () => {
  const { GuidedJourney } = await loadModule<{ GuidedJourney: never }>("/src/features/race/GuidedJourney.tsx");
  const html = render(GuidedJourney, { race: { predicted: [], baseline: [], actual: [], hits: 0 } as never, rows: [] as never, revealed: true });
  assert.equal(count(html, /data-state="done"/g), 4);
  assert.equal(count(html, /data-state="next"/g), 1);
  assert.equal(count(html, /data-state="locked"/g), 0);
  assert.match(html, />Done</);
});

test("the steps are personal: they quote the reader's own call, and the score after the reveal, and say nothing of a call that has not been made", () => {
  assert.match(source, /Your three are locked in/);
  assert.match(source, /You and Paladin share \$\{shared\} of 3 names/);
  assert.match(source, /You scored \$\{myScore\} of 3, Paladin \$\{race\.hits\}/);
  assert.match(source, /readChallenge\(raceId\)/, "from the reader's own saved call");
  assert.match(source, /paladin:challenge/, "and it follows a call being made or cleared");
  // the score is only ever worked out once the result is open
  assert.match(source, /mine && revealed \? scoreChallenge/);
});

test("the step strip is built from tokens and has no small tracked capitals over anything", () => {
  const block = css.slice(css.indexOf(".journey-steps {"), css.indexOf(".journey-readout {"));
  assert.ok(block.length > 500);
  assert.doesNotMatch(block, /text-transform:\s*uppercase/, "no capitals in the strip");
  assert.doesNotMatch(block, /#[0-9a-f]{3,8}\b/i, "colours come from tokens");
  // the segment bar, its three states, and the narrow layout
  assert.match(block, /li\[data-state="done"\]::before/);
  assert.match(block, /li\[data-state="next"\]::before \{ background: var\(--color-signal\)/);
  assert.match(block, /li\[data-state="locked"\]::before/);
  assert.match(css, /@media \(max-width: 900px\) \{\s*\.journey-steps \{ grid-template-columns: 1fr; \}/);
});

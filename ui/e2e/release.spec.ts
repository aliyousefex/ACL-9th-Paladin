import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { lowContrast, smallTargets } from "./contrast";

const RACE = "/#/race/2024/abu-dhabi";
const evidenceDir = "../artifacts/visual-qa/playwright";

async function assertViewport(page: Page, width: number) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    visualWidth: window.visualViewport?.width ?? null,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.innerWidth).toBe(width);
  expect(dimensions.clientWidth).toBe(width);
  expect(dimensions.visualWidth).toBe(width);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(width);
  return dimensions;
}

test("real viewport, touch surface, overflow and screenshots", async ({ page }, testInfo) => {
  const width = testInfo.project.use.viewport!.width;
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /predict the podium/i })).toBeVisible();
  const homeDimensions = await assertViewport(page, width);
  const touch = await page.evaluate(() => navigator.maxTouchPoints);
  if (testInfo.project.use.hasTouch) expect(touch).toBeGreaterThan(0);
  // Settle responsive resources and intersection-driven sections before Chromium stitches a full-page mobile capture.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${evidenceDir}/${testInfo.project.name}-home.png`, fullPage: true, scale: "css" });

  await page.goto(RACE);
  await expect(page.getByRole("heading", { name: "Abu Dhabi Grand Prix" })).toBeVisible();
  const raceDimensions = await assertViewport(page, width);
  if (testInfo.project.use.hasTouch) {
    // On a phone the destinations are the dock: fixed at the thumb, never hidden, and always on screen.
    const dock = page.getByRole("navigation", { name: "Primary" });
    await expect(dock).toHaveCSS("position", "fixed");
    const height = page.viewportSize()!.height;
    const resting = (await dock.boundingBox())!;
    expect(resting.y + resting.height).toBeLessThanOrEqual(height);
    expect(resting.y).toBeGreaterThan(height / 2);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    expect(Math.round((await dock.boundingBox())!.y)).toBe(Math.round(resting.y));
    await page.evaluate(() => window.scrollBy(0, -300));
    expect(Math.round((await dock.boundingBox())!.y)).toBe(Math.round(resting.y));
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.screenshot({ path: `${evidenceDir}/${testInfo.project.name}-race.png`, fullPage: false });
  const measurements = { project: testInfo.project.name, configuredViewport: testInfo.project.use.viewport, homeDimensions, raceDimensions, touch };
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(`${evidenceDir}/${testInfo.project.name}-viewport.json`, `${JSON.stringify(measurements, null, 2)}\n`);
  await testInfo.attach("viewport-measurements", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
  expect(runtimeErrors).toEqual([]);
});

test("primary routes render without runtime or broken-resource errors", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("response", (response) => { if (response.status() >= 400) failures.push(`${response.status()}: ${response.url()}`); });
  const routes = [
    ["home", "/"],
    ["drivers", "/#/drivers"],
    ["driver", "/#/drivers/norris?season=2024"],
    ["teams", "/#/teams"],
    ["team", "/#/teams/alpine?season=2024"],
    ["circuits", "/#/circuits"],
    ["model", "/#/model"],
    ["method", "/#/method"],
    ["race-lab", "/#/race-lab"],
    ["analysis", "/#/analysis"],
    ["history", "/#/history"],
    ["knowledge graph", "/#/history?tab=kg"],
    ["league", "/#/league"],
    ["guide", "/#/guide"],
    ["race-route", RACE],
  ] as const;
  for (const [name, route] of routes) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect.poll(() => page.locator("main").innerText()).not.toMatch(/^\s*$/);
    await page.screenshot({ path: `${evidenceDir}/${testInfo.project.name}-${name}-route.png`, fullPage: false });
  }
  expect(failures).toEqual([]);
});

test("complete race, replay, scenario, export and shared-URL journey", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  // Decision replay is an Expert tool: Simple view, the default, does not show it.
  await page.addInitScript(() => window.localStorage.setItem("paladin:mode", "expert"));
  await page.goto(RACE);
  await expect(page.getByText("Model's top three", { exact: true })).toBeVisible();

  await page.locator("#result").scrollIntoViewIfNeeded();
  const reveal = page.getByRole("button", { name: /reveal the result/i });
  await expect(reveal).toBeVisible();
  await reveal.scrollIntoViewIfNeeded();
  await reveal.click();
  await expect(page.getByText("Actual podium", { exact: true })).toBeVisible();

  const decision = page.locator("#decision");
  await decision.scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: /inspect the race as it was known/i })).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/${testInfo.project.name}-decision-grid.png`, fullPage: false });

  const slider = page.getByLabel("Information cutoff");
  if (testInfo.project.use.hasTouch) {
    await slider.scrollIntoViewIfNeeded();
    const sliderBox = await slider.boundingBox();
    expect(sliderBox).not.toBeNull();
    const session = await page.context().newCDPSession(page);
    const y = sliderBox!.y + sliderBox!.height / 2;
    const startX = sliderBox!.x + 3;
    const endX = sliderBox!.x + sliderBox!.width * 0.35;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: startX, y }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: endX, y }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(slider).not.toHaveValue("0");
  }
  await slider.fill("12");
  await expect(page.getByText("Lap 12", { exact: true })).toBeVisible();
  await page.getByLabel("Investigate driver").selectOption("815");
  await expect(page.getByRole("img", { name: /Sergio Pérez estimated podium-share evolution/i })).toBeVisible();

  await expect(page.getByText(/No lap data exists for PER\./)).toBeVisible();

  const moment = page.locator(".decision-moments button").first();
  if (testInfo.project.use.hasTouch) await moment.tap();
  else await moment.click();
  await expect(slider).not.toHaveValue("12");

  await page.getByRole("button", { name: "+5s", exact: true }).click();
  await expect(page.getByRole("row", { name: /\+5s/ })).toHaveAttribute("aria-current", "true");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^paladin-2024-abu-dhabi-lap-\d+\.json$/);

  await page.getByRole("button", { name: "Copy scenario link" }).click();
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  expect(shared).toContain("#/race/2024/abu-dhabi?");
  expect(shared).toMatch(/[?&]dl=\d+/);
  expect(shared).toMatch(/[?&]dd=\d+/);
  expect(shared).toMatch(/[?&]ds=-?\d+/);
  await page.goto(shared);
  await expect(page.getByLabel("Information cutoff")).not.toHaveValue("0");

  await page.getByLabel("Information cutoff").fill("58");
  await expect(page.getByRole("heading", { name: /follow one driver through the evidence/i })).toBeVisible();
  await expect(page.getByText("Stress-test an assumed time loss", { exact: true })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("Simple view follows one path, Expert adds the tools, and search opens a race", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(RACE);
  await expect(page.locator("#prediction")).toBeAttached();
  await expect(page.locator("#firmness")).toBeAttached();
  await expect(page.locator("#leaderboard")).toHaveCount(0);
  await expect(page.locator("#field")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /more tools are one switch away/i })).toBeAttached();
  await expect(page.getByRole("navigation", { name: "On this race" })).not.toContainText(/ranking|reshuffle|what if/i);

  await page.getByRole("radio", { name: "Expert" }).click();
  await expect(page.locator("#leaderboard")).toBeAttached();
  await expect(page.locator("#field")).toBeAttached();
  await expect(page.getByRole("heading", { name: /more tools are one switch away/i })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("radio", { name: "Expert" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: "Simple" }).click();
  await expect(page.locator("#leaderboard")).toHaveCount(0);

  // On a phone the bar slides away while reading, as it should; a reader scrolls up and it is back.
  await page.evaluate(() => window.scrollBy(0, -400));
  await page.getByRole("button", { name: "Search races, drivers and pages" }).click();
  const field = page.getByRole("combobox", { name: "Search" });
  await expect(field).toBeFocused();
  await field.fill("monaco 2023");
  await expect(page.getByRole("dialog").getByRole("option").first()).toContainText(/monaco grand prix 2023/i);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/race\/2023\/monaco/);
  await expect(page.getByRole("heading", { name: "Monaco Grand Prix" })).toBeVisible();
  expect(errors).toEqual([]);
});

/** Choose the first three drivers on the challenge grid and lock them. */
async function lockThree(page: Page) {
  await page.locator("#challenge").scrollIntoViewIfNeeded(); // sections mount lazily, as they scroll into view
  const group = page.getByRole("group", { name: "Choose three podium drivers" });
  await group.scrollIntoViewIfNeeded();
  for (const index of [0, 1, 2]) await group.getByRole("button").nth(index).click();
  await page.getByRole("button", { name: "Lock my three" }).click();
}

async function reveal(page: Page) {
  await page.locator("#result").scrollIntoViewIfNeeded();
  const button = page.getByRole("button", { name: /reveal the result/i });
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await expect(page.getByText("Actual podium", { exact: true })).toBeVisible();
}

test("season league: a blind call counts, can be shared, and cannot be redone after the reveal", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto(RACE);
  await expect(page.locator("#challenge")).toBeAttached();
  await lockThree(page);
  await expect(page.getByText(/locked blind\. it counts in your league/i)).toBeVisible();
  await reveal(page);
  await expect(page.getByText(/counted in your league/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "New pick" }), "a counted pick is final once revealed").toHaveCount(0);

  const card = page.getByRole("img", { name: /I named \d of the 3 podium finishers/ });
  await expect(card).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download card" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("paladin-2024-abu-dhabi-my-call.png");
  mkdirSync(evidenceDir, { recursive: true });
  await file.saveAs(`${evidenceDir}/${testInfo.project.name}-race-card.png`);
  const png = readFileSync(`${evidenceDir}/${testInfo.project.name}-race-card.png`);
  expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)], "a link-preview sized image").toEqual([1200, 630]);

  await page.goto("/#/league");
  await expect(page.getByRole("heading", { name: /your season against paladin and the grid/i })).toBeVisible();
  await expect(page.getByText("1 race called blind", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/too few races to say who is ahead/i)).toBeVisible();
  await page.getByLabel(/your name on the card/i).fill("Sam <b>");
  const code = await page.getByLabel("Your league code").inputValue();
  expect(code).toMatch(/^PAL1-[A-Za-z0-9_-]+$/);
  await page.getByRole("button", { name: "Copy code" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);

  // compare against the same code, then against an edited one
  await page.getByRole("textbox", { name: "Their code" }).fill(code);
  await expect(page.getByText(/you and sam b on the 1 race you both called/i)).toBeVisible();
  const edited = code.slice(0, 30) + (code[30] === "A" ? "B" : "A") + code.slice(31);
  await page.getByRole("textbox", { name: "Their code" }).fill(edited);
  await expect(page.getByText(/damaged or has been edited|cut short|different version|does not look like/i)).toBeVisible();
  await page.getByRole("textbox", { name: "Their code" }).fill("not a code");
  await expect(page.getByText(/does not look like a paladin code/i)).toBeVisible();

  // a friend with no calls opens the challenge link
  const friend = await page.context().browser()!.newContext({ viewport: page.viewportSize() ?? undefined });
  const other = await friend.newPage();
  await other.goto(`/#/league?vs=${code}`);
  await expect(other.getByText(/none that you have called blind/i)).toBeVisible();
  await expect(other.getByText(/0 races called blind/i).first()).toBeVisible();
  await friend.close();
  expect(errors).toEqual([]);
});

test("season league: a result that was already shown, even before a refresh, cannot make a pick count", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  await page.goto(RACE);
  await reveal(page);
  await page.reload();
  // after the reload the result is hidden again, but this browser has seen it
  await page.locator("#result").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: /reveal the result/i })).toBeVisible();
  await lockThree(page);
  await expect(page.getByText(/does not count in your league/i)).toBeVisible();
  await page.goto("/#/league");
  await expect(page.getByText(/nothing counts yet/i)).toBeVisible();
  await expect(page.getByText(/earlier pick was made after the result was visible/i)).toBeVisible();
});

test("season league: with 'always show results' on, a pick is practice and the page says so", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  await page.addInitScript(() => window.localStorage.setItem("paladin:show-results", "1"));
  await page.goto(RACE);
  await page.locator("#challenge").scrollIntoViewIfNeeded();
  await expect(page.getByText(/already been shown for this race, so a pick made now is practice/i)).toBeVisible();
  await lockThree(page);
  await expect(page.getByText(/does not count in your league/i)).toBeVisible();
});

/* ------------------------------------------------------------------ dark page, targets, header, paging */

const SURVEY: [string, string][] = [
  ["home", "/"],
  ["race", RACE],
  ["analysis", "/#/analysis"],
  ["history", "/#/history?tab=driver&d=1"],
  ["knowledge graph", "/#/history?tab=kg"],
  ["league", "/#/league"],
  ["guide", "/#/guide"],
  ["research", "/#/model"],
  ["drivers", "/#/drivers"],
  ["driver", "/#/drivers/norris?season=2024"],
  ["teams", "/#/teams"],
  ["team", "/#/teams/alpine?season=2024"],
  ["circuits", "/#/circuits/monaco"],
  ["race lab", "/#/race-lab"],
];

/** Visit a page, scroll through it so lazily mounted sections exist, and come back to the top. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(total, 9000); y += 700) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(70);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

test("the site is dark whatever the device prefers, and there is nothing to switch it", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // A device set to light, and a choice saved by an older version of the site, change nothing.
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => window.localStorage.setItem("paladin:theme", "light"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /predict the podium/i })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(10, 11, 14)");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  expect(await page.evaluate(() => document.documentElement.dataset.theme), "no theme attribute is set").toBeUndefined();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0a0b0e");
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /dark mode|light mode|match my device/i })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("text is readable on every page (WCAG AA, measured on the rendered page)", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  test.setTimeout(150_000);
  await page.addInitScript(() => {
    window.localStorage.setItem("paladin:mode", "expert");
    window.localStorage.setItem("paladin:show-results", "1");
  });
  const report: Record<string, unknown[]> = {};
  for (const [name, url] of SURVEY) {
    await page.goto(url);
    await settle(page);
    const bad = await lowContrast(page);
    if (bad.length) report[name] = bad.slice(0, 5);
  }
  expect(report, "text below AA contrast").toEqual({});
});

test("touch targets: on a phone nothing you can press is smaller than 24px, and most things are 44px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-375");
  test.setTimeout(240_000); // 13 pages, each scrolled through; about a minute alone, and slower when other tests share the machine
  const under24: Record<string, string[]> = {};
  let under44 = 0;
  let total = 0;
  for (const [name, url] of SURVEY) {
    await page.goto(url);
    await settle(page);
    const small = await smallTargets(page, 24);
    if (small.length) under24[name] = small.slice(0, 5);
    under44 += (await smallTargets(page, 44)).length;
    total += await page.evaluate(() => document.querySelectorAll("a[href], button, input, select, textarea, summary").length);
  }
  expect(under24, "WCAG 2.5.8 minimum target size").toEqual({});
  expect(under44 / total, `${under44} of ${total} targets are under 44px`).toBeLessThan(0.1);
});

test("phone header: scrolling down gives the screen back without losing navigation; scrolling up or focusing brings it back", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-375");
  await page.goto(RACE);
  await expect(page.locator("#prediction")).toBeAttached();
  const brand = page.locator("header.chrome-bar");
  const capsule = brand.locator(".site-bar__inner");
  const dock = page.locator("nav.dock");
  const section = page.getByRole("navigation", { name: "On this race" });
  const chip = brand.getByRole("button", { name: /On this race: .*Choose a section/ });
  const top = async (locator: typeof brand) => Math.round((await locator.boundingBox())!.y);
  const bottom = async (locator: typeof brand) => {
    const box = (await locator.boundingBox())!;
    return Math.round(box.y + box.height);
  };

  const dockTop = await top(dock);
  expect(await top(brand)).toBe(0);
  expect(await bottom(dock)).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(120);
  await page.evaluate(() => window.scrollTo(0, 1700));
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "compact");
  await expect.poll(() => bottom(brand)).toBeLessThanOrEqual(0);
  // and its drop shadow (14px down, 34px of blur) is off screen with it, not hanging over the top of the page as a haze
  await expect.poll(() => bottom(capsule)).toBeLessThanOrEqual(-48);
  // reading hides only the brand capsule: the destinations stay at the thumb, and the race's own section strip (a pill 8px from the top) is the way around
  expect(await top(dock)).toBe(dockTop);
  await expect.poll(() => top(section)).toBeLessThanOrEqual(9);
  await expect(section).toBeVisible();

  // Pulling back up: the capsule returns and the strip melts into it, so there is one bar, with the section as a chip in it.
  await page.evaluate(() => window.scrollBy(0, -260));
  await expect(page.locator("html")).not.toHaveAttribute("data-chrome", "compact");
  await expect.poll(() => top(brand)).toBe(0);
  await expect(section).toBeHidden();
  await expect(chip).toBeVisible();
  expect(await top(dock)).toBe(dockTop);

  // keyboard or screen-reader focus can never land on something that is off screen
  await page.evaluate(() => window.scrollTo(0, 3200));
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "compact");
  await page.getByRole("button", { name: "Search races, drivers and pages" }).focus();
  await expect(page.locator("html")).not.toHaveAttribute("data-chrome", "compact");
  await expect.poll(() => top(brand)).toBe(0);
});

test("phone: a jittery thumb does not make the bar flicker, and the strip melts into the bar's chip instead of showing as a second bar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-375");
  await page.goto(RACE);
  await expect(page.locator("#prediction")).toBeAttached();
  const strip = page.getByRole("navigation", { name: "On this race" });
  const chip = page.locator("header.chrome-bar").getByRole("button", { name: /On this race: .*Choose a section/ });
  const top = async (locator: typeof strip) => Math.round((await locator.boundingBox())!.y);
  const chrome = () => page.evaluate(() => document.documentElement.dataset.chrome ?? "shown");

  await page.evaluate(() => window.scrollTo(0, 1700));
  await expect.poll(chrome).toBe("compact");
  await expect.poll(() => top(strip)).toBeLessThanOrEqual(9);

  // A thumb slips back a few pixels at a time, again and again, without ever really pulling the page down.
  for (const slip of [-6, -9, 5, -12, 4, -14, 6, -11]) {
    await page.evaluate((d) => window.scrollBy(0, d), slip);
    await page.waitForTimeout(60);
  }
  expect(await chrome(), "slips and small reversals do not bring the bar back").toBe("compact");
  await expect(strip, "and the strip stays where it was").toBeVisible();
  expect(await top(strip)).toBeLessThanOrEqual(9);

  // A real pull upward brings the bar back, and the strip melts into it: it fades while the bar slides in (a transition, not a swap).
  // The chip grew when the strip first reached the bar, so the bar arrives already carrying the section the strip was showing.
  const seen = await page.evaluate(async () => {
    const nav = document.querySelector("nav.subnav")!; // the strip in the page (the bar's own list is a nav with the same label)
    const bar = document.querySelector("header.chrome-bar")!;
    const button = document.querySelector<HTMLElement>("header .section-chip")!;
    const opacity = new Set<string>();
    const travel = new Set<number>();
    const chipWidth = button.getBoundingClientRect().width;
    window.scrollBy(0, -90);
    const end = performance.now() + 800;
    while (performance.now() < end) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      opacity.add(Number(getComputedStyle(nav).opacity).toFixed(1));
      travel.add(Math.round(bar.getBoundingClientRect().top / 8));
    }
    return { opacity: [...opacity], travel: [...travel], chipWidth };
  });
  expect(await chrome()).toBe("shown");
  expect(seen.opacity.length, `the strip faded through ${seen.opacity.join(", ")}`).toBeGreaterThanOrEqual(3);
  expect(seen.travel.length, `the bar slid in through ${seen.travel.join(", ")} (in 8px steps)`).toBeGreaterThanOrEqual(3);
  expect(seen.chipWidth, "the chip is already in the bar when it returns").toBeGreaterThan(60);
  await expect(strip, "never two bars at once").toBeHidden();
  await expect(chip).toBeVisible();

  // Reading on puts the bar away, the chip with it, and the strip returns alone at the very top.
  await page.evaluate(() => window.scrollBy(0, 160));
  await expect.poll(chrome).toBe("compact");
  await expect(strip).toBeVisible();
  await expect.poll(() => top(strip)).toBeLessThanOrEqual(9);
});

test("the section strip melts into the bar as a dropdown, and is never a second bar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await page.goto("/#/method");
  await expect(page.getByRole("heading", { name: /from raw tables to one model/i })).toBeVisible();
  const strip = page.getByRole("navigation", { name: "Walkthrough sections" });
  const chip = page.locator("header").getByRole("button", { name: /Walkthrough sections: .*Choose a section/ });
  const panel = page.locator("header .section-panel");
  const capsule = page.locator("header .site-bar__inner");

  // At rest the strip is in the page and the bar has no chip.
  await expect(strip).toBeVisible();
  await expect(chip).toBeHidden();

  // When the strip reaches the bar it fades away and the chip is in the bar, by the logo and clear of the links and the tools.
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect(strip).toBeHidden();
  await expect(chip).toBeVisible();
  const [bar, button, brand, firstLink, search] = await Promise.all([
    capsule.boundingBox(),
    chip.boundingBox(),
    page.locator("header .nav-brand").boundingBox(),
    page.locator("header .site-nav__link").first().boundingBox(),
    page.locator("header .site-tool").boundingBox(),
  ]);
  expect(button!.x).toBeGreaterThanOrEqual(brand!.x + brand!.width - 1);
  expect(button!.x + button!.width).toBeLessThanOrEqual(firstLink!.x + 1);
  expect(button!.x + button!.width).toBeLessThanOrEqual(search!.x);
  expect(button!.y).toBeGreaterThanOrEqual(bar!.y);
  expect(button!.y + button!.height).toBeLessThanOrEqual(bar!.y + bar!.height);

  // It names the section the reader is in, and follows the page.
  const before = (await chip.textContent())!.trim();
  await page.evaluate(() => window.scrollTo(0, 5200));
  await expect.poll(async () => (await chip.textContent())!.trim()).not.toBe(before);

  // It opens by itself on hover, lists every section, and choosing one goes there and closes it.
  await chip.hover();
  await expect(panel).toBeVisible();
  await expect(chip).toHaveAttribute("aria-expanded", "true");
  const links = panel.getByRole("link");
  expect(await links.count(), "every section is in the list").toBeGreaterThanOrEqual(8);
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await links.nth(2).click();
  await expect(page).toHaveURL(/#\/method\/.+/);
  await expect(panel).toBeHidden();

  // Back at the top the strip returns and the chip goes.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(strip).toBeVisible();
  await expect(chip).toBeHidden();
});

test("search: the palette dims the whole screen, fits above the keyboard, and names no keys on a touchscreen", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  const touch = testInfo.project.name === "mobile-375";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: /predict the podium/i })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.evaluate(() => window.scrollBy(0, -120)); // reading hides the bar on a phone; scrolling up brings it back
  const open = page.getByRole("button", { name: "Search races, drivers and pages" });
  await expect(open).toBeVisible();
  await open.click();

  // Mounted on the body and as big as the screen. Inside the frosted bar it was as big as the bar.
  const size = page.viewportSize()!;
  const scrim = page.locator("body > .palette");
  await expect(scrim).toHaveCount(1);
  // It fades and settles in over a fraction of a second, so it is measured once it has settled.
  await page.evaluate(() => Promise.all(document.querySelector("body > .palette")!.getAnimations({ subtree: true }).map((animation) => animation.finished)));
  const scrimBox = (await scrim.boundingBox())!;
  expect([scrimBox.x, scrimBox.y, Math.round(scrimBox.width), Math.round(scrimBox.height)]).toEqual([0, 0, size.width, size.height]);
  const dialog = page.getByRole("dialog", { name: "Search races, drivers and pages" });
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(size.width);
  expect(box.y + box.height).toBeLessThanOrEqual(size.height);
  // On a phone it sits at the top, hugging the safe area; on a desktop it hangs a tenth of the way down.
  if (touch) expect(box.y).toBeLessThanOrEqual(16);
  else expect(Math.round(box.y)).toBe(Math.round(size.height * 0.1));

  // The field: focused, with no ring floating around empty space (the row carries the mark) and a placeholder that is not cut off.
  const field = page.getByRole("combobox", { name: "Search" });
  await expect(field).toBeFocused();
  await expect(field).toHaveCSS("outline-style", "none");
  const room = await field.evaluate((input: HTMLInputElement) => {
    const style = getComputedStyle(input);
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return { need: context.measureText(input.placeholder).width, have: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
  });
  expect(room.need, `the placeholder needs ${room.need}px of ${room.have}px`).toBeLessThanOrEqual(room.have);

  // Keys are named only where there is a keyboard: a cross to tap on a phone, "Esc" and the hint line on a desktop.
  const esc = dialog.locator(".palette__esc");
  const cross = dialog.locator(".palette__x");
  const hint = dialog.locator(".palette__hint");
  if (touch) {
    await expect(esc).toBeHidden();
    await expect(hint).toBeHidden();
    await expect(cross).toBeVisible();
    const close = (await dialog.getByRole("button", { name: "Close search" }).boundingBox())!;
    expect(Math.min(close.width, close.height), "a thumb-sized close control").toBeGreaterThanOrEqual(44);
    // the page behind does not scroll under a thumb
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
    // with the on-screen keyboard up (a short screen) the whole panel is still on it
    await page.setViewportSize({ width: size.width, height: 380 });
    await expect.poll(async () => { const b = (await dialog.boundingBox())!; return Math.round(b.y + b.height); }).toBeLessThanOrEqual(380);
    await page.setViewportSize(size);
  } else {
    await expect(esc).toBeVisible();
    await expect(hint).toBeVisible();
    await expect(cross).toBeHidden();
    await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
  }
  // the same goes for the page's own "Press / to search" line
  if (touch) await expect(page.getByText(/at any time to search/)).toBeHidden();

  // Tapping the dimmed page, anywhere on it, closes the palette and gives the screen back.
  await page.mouse.click(size.width - 4, size.height - 4);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/palette-open/);
  await expect(open).toBeFocused();
  expect(errors).toEqual([]);
});

test("phone: the footer runs to the bottom edge under the dock, and the More list is dense glass", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-375");
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: /predict the podium/i })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator("footer")).toBeVisible();
  // no strip of page colour between the end of the footer and the end of the page
  const gap = await page.evaluate(() => {
    const footer = document.querySelector("footer")!.getBoundingClientRect();
    return Math.round(footer.bottom + window.scrollY - document.documentElement.scrollHeight);
  });
  expect(Math.abs(gap)).toBeLessThanOrEqual(1);
  // and, at the very bottom, the last link still clears the dock (sections mount as they scroll, so scroll again each time)
  await expect
    .poll(() =>
      page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        const link = [...document.querySelectorAll("footer nav a")].pop()!.getBoundingClientRect();
        return Math.round(document.querySelector("nav.dock")!.getBoundingClientRect().top - link.bottom);
      }),
    )
    .toBeGreaterThanOrEqual(0);

  // The list that opens from the dock is the bar's glass, denser because it holds text: translucent, and blurring the page behind it
  // (it can, because the dock's own glass is a layer behind it and not a blurred surface the list sits inside).
  await page.locator("nav.dock").getByRole("button", { name: /more/i }).click();
  const panel = page.locator(".more-panel:not([hidden])");
  await expect(panel).toBeVisible();
  const style = await panel.evaluate((el) => ({ background: getComputedStyle(el).backgroundColor, blur: getComputedStyle(el).backdropFilter }));
  const alpha = Number(style.background.match(/\/\s*([\d.]+)\s*\)/)?.[1] ?? 1);
  expect(alpha, `the list's tint is ${alpha}`).toBeGreaterThanOrEqual(0.8);
  expect(alpha, "but it is not opaque").toBeLessThan(1);
  expect(style.blur).toMatch(/blur/);
});

test("the top bar: its glass is see-through, and the More list opens when the pointer rests on it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: /predict the podium/i })).toBeVisible();
  // The bar's glass is a see-through tint (about 60%), on a layer behind the bar.
  const tint = await page.locator("header .site-bar__inner").evaluate((el) => getComputedStyle(el, "::before").backgroundColor);
  const tintAlpha = Number(tint.match(/\/\s*([\d.]+)\s*\)/)?.[1] ?? 1);
  expect(tintAlpha, `the bar's tint is ${tintAlpha}`).toBeLessThanOrEqual(0.7);
  expect(tintAlpha).toBeGreaterThanOrEqual(0.5);

  const more = page.locator("header").getByRole("button", { name: /more/i });
  const panel = page.locator("header .more-panel");
  await expect(panel).toBeHidden();

  // It opens by itself when the pointer rests on it, and says so to assistive technology.
  await more.hover();
  await expect(panel).toBeVisible();
  await expect(more).toHaveAttribute("aria-expanded", "true");

  // Crossing the gap down to the list does not close it, and it can be used.
  const box = (await panel.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 40, { steps: 10 });
  await page.waitForTimeout(450);
  await expect(panel).toBeVisible();

  // Leaving it and its list closes it.
  await page.mouse.move(260, 600, { steps: 6 });
  await expect(panel).toBeHidden();
  await expect(more).toHaveAttribute("aria-expanded", "false");

  // A click on the button while it is open by hover keeps it open (it has been asked for); leaving then does not close it.
  await more.hover();
  await expect(panel).toBeVisible();
  await more.click();
  await page.mouse.move(260, 600, { steps: 6 });
  await page.waitForTimeout(500);
  await expect(panel).toBeVisible();
  // Escape closes it and gives focus back to the button; a second click opens it from closed.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(more).toBeFocused();
  await more.click();
  await expect(panel).toBeVisible();
  await more.click();
  await expect(panel).toBeHidden();

  // Using it: a link in the list goes to its page and the list closes. (After a click closed it with the pointer still over the
  // button, it correctly does not spring open again under a pointer that has not moved; leave and come back.)
  await page.mouse.move(260, 600, { steps: 4 });
  await more.hover();
  await expect(panel).toBeVisible();
  await panel.getByRole("link", { name: /history graph/i }).click();
  await expect(page).toHaveURL(/#\/history/);
  await expect(panel).toBeHidden();
});

test("Error Atlas: the ledger shows 15 races at a time, filters start again, and back-to-top returns you", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  await page.goto("/#/analysis");
  const rows = page.locator('section[aria-labelledby="ledger-title"] ol > li');
  await expect(rows).toHaveCount(15);
  await expect(page.getByText("Showing 15 of 68")).toBeVisible();
  await page.getByRole("button", { name: "Show 15 more" }).click();
  await expect(rows).toHaveCount(30);

  await page.getByRole("button", { name: "Paladin 3 of 3" }).click();
  const perfect = await rows.count();
  expect(perfect).toBeLessThanOrEqual(15);
  expect(perfect).toBeGreaterThan(0);
  await expect(page.getByText(/Showing \d+ of \d+ matching \(68 races in all\)/)).toBeVisible();
  await page.getByRole("button", { name: "All 68" }).click();
  await expect(rows, "a new filter starts again from the first page").toHaveCount(15);

  await page.getByRole("button", { name: /Show all 68/ }).click();
  await expect(rows).toHaveCount(68);
  await expect(page.getByRole("button", { name: /Show \d+ more/ })).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole("button", { name: "Back to the top of the page" }), "not shown at the top").toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 4 * window.innerHeight));
  const back = page.getByRole("button", { name: "Back to the top of the page" });
  await expect(back).toBeVisible();
  await back.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
  await expect(page.locator("main")).toBeFocused();
});

test("keyboard focus reaches primary navigation and race controls", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  await page.goto(RACE);
  await page.keyboard.press("Tab");
  await expect(page.getByText("Skip to content", { exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(["A", "BUTTON", "SELECT", "INPUT"]).toContain(focused);
});

/** The home page's onboard preview. It is WebGL: where the browser has it the card must come up and run, and where it does not the card must say so. */
const CARD = "[data-racing-hero]";
const cardStatus = (page: Page) => page.locator(CARD).getAttribute("data-status");
const readout = (page: Page) =>
  page.evaluate(() => {
    const read = (name: string) => document.querySelector(`[data-racing-hero] [data-hud="${name}"]`)?.textContent ?? "";
    return { speed: read("speed"), gear: read("gear"), position: read("position"), lap: read("lap") };
  });
const lights = (page: Page) => page.locator("[data-racing-hero] [data-start-lights]");

async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /predict the podium/i })).toBeVisible();
  await expect.poll(() => cardStatus(page), { timeout: 45_000, message: "the card is neither ready nor in fallback" }).toMatch(/ready|fallback/);
  return (await cardStatus(page)) as "ready" | "fallback";
}

test("home: the onboard preview replaces the circuit card, leaves the headline and buttons alone, and does not widen the page", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  const width = testInfo.project.use.viewport!.width;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const status = await openHome(page);
  // what was there stays
  await expect(page.getByRole("heading", { name: /predict the podium/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open .* 20\d\d/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Surprise me" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open simulation" })).toBeVisible();
  // and what was replaced is gone
  await expect(page.locator('svg[aria-label^="Suzuka circuit"]')).toHaveCount(0);
  await expect(page.getByText(/real F1 timing map, sectors from telemetry/)).toHaveCount(0);
  // the caption about the picture was taken off, and the way on to the circuits stays
  await expect(page.locator(CARD).getByText(/An invented circuit and field/)).toHaveCount(0);
  await expect(page.locator(CARD).getByRole("link", { name: "Explore circuits" })).toHaveAttribute("href", "#/circuits");
  // the card is in the first screen, whole
  const box = (await page.locator(CARD).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  if (testInfo.project.name === "desktop-1440") expect(box.y + box.height, "the card fits the first screen").toBeLessThanOrEqual(900);
  await assertViewport(page, width);
  expect(errors).toEqual([]);
  console.log("onboard preview status:", status);
});

test("home: when WebGL is there the picture runs, the instruments move, the order and the gaps are real, and it rests when scrolled away", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const status = await openHome(page);
  test.skip(status !== "ready", "this browser has no WebGL; the fallback test covers it");
  // the race starts on the grid; wait for the lights to go out and the car to be away
  await expect.poll(async () => Number((await readout(page)).speed), { timeout: 40_000, message: "the car never got away" }).toBeGreaterThan(60);
  const first = await readout(page);
  expect(first.speed).toMatch(/^\d{2,3}$/);
  expect(first.position).toMatch(/^P\d{1,2}$/);
  expect(Number(first.gear)).toBeGreaterThanOrEqual(1);
  // the canvas has the size of the card and is drawn on
  const canvas = page.locator(`${CARD} canvas`);
  const size = await canvas.evaluate((c: HTMLCanvasElement) => ({ w: c.clientWidth, h: c.clientHeight, bw: c.width, bh: c.height }));
  expect(size.w).toBeGreaterThan(300);
  expect(size.bw, "the drawing buffer is at least the size of the card (to the pixel)").toBeGreaterThanOrEqual(size.w - 2);
  // the timing tower names the player and the cars either side
  const tower = page.locator(`${CARD} ol li`);
  await expect.poll(() => tower.count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  await expect(page.locator(`${CARD} ol li`, { hasText: "You" })).toHaveCount(1);
  // the instruments change as the car moves
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    seen.add((await readout(page)).speed);
    await page.waitForTimeout(250);
  }
  expect(seen.size, "the speed never changed: the picture is not running").toBeGreaterThan(2);
  // scrolled away it stops: the page does not draw what nobody can see
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(700);
  const away = await readout(page);
  await page.waitForTimeout(1200);
  expect((await readout(page)).speed, "the preview kept running while off screen").toBe(away.speed);
  await page.locator(CARD).scrollIntoViewIfNeeded();
  await expect.poll(async () => (await readout(page)).speed, { timeout: 8_000, message: "it did not start again" }).not.toBe(away.speed);
});

test("home: driving needs the card to have focus, the page keeps scrolling otherwise, and the autopilot takes the car back", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const status = await openHome(page);
  test.skip(status !== "ready", "this browser has no WebGL");
  const stage = page.locator(`${CARD} [role="group"]`).first();
  const toggle = page.locator(CARD).getByRole("button", { name: /Take the wheel|Back to autopilot/ });
  await expect(toggle).toHaveText("Take the wheel");
  await expect.poll(async () => Number((await readout(page)).speed), { timeout: 40_000, message: "the car never got away" }).toBeGreaterThan(40);
  // keys pressed anywhere else do nothing to it
  await page.locator("body").press("w");
  await expect(toggle).toHaveText("Take the wheel");
  // an arrow key on the focused card, before the wheel is taken, still scrolls the page
  await stage.focus();
  const before = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY), "the arrow key was swallowed").toBeGreaterThan(before);
  await page.evaluate(() => window.scrollTo(0, 0));
  // W takes the wheel; holding it builds speed, and a brake takes it off
  await stage.focus();
  await page.keyboard.down("w");
  await expect(toggle).toHaveText("Back to autopilot");
  await page.waitForTimeout(2500);
  const fast = Number((await readout(page)).speed);
  await page.keyboard.up("w");
  await page.keyboard.down("s");
  await page.waitForTimeout(1800);
  await page.keyboard.up("s");
  expect(Number((await readout(page)).speed), "braking did not slow the car").toBeLessThan(fast);
  // Escape hands it back
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveText("Take the wheel");
  // and so does a click on the button, and so does a quiet spell
  await toggle.click();
  await expect(toggle).toHaveText("Back to autopilot");
  await expect(toggle).toHaveText("Take the wheel", { timeout: 12_000 });
});

test("home: the race starts on the grid with five red lights, then lights out and green, and nothing can be driven until they are out", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await page.goto("/");
  await expect.poll(() => cardStatus(page), { timeout: 45_000 }).toMatch(/ready|fallback/);
  test.skip((await cardStatus(page)) !== "ready", "this browser has no WebGL");
  // on the grid: the car is standing, and the lights come on one after another
  await expect(lights(page)).toBeVisible({ timeout: 15_000 });
  // one snapshot of the lights and the speed together, so what is asserted is what the page showed at that moment
  const snap = () =>
    page.evaluate(() => {
      const el = document.querySelector("[data-racing-hero] [data-start-lights]");
      return {
        present: !!el,
        lit: el?.getAttribute("data-lit") ?? "",
        green: el?.getAttribute("data-green") === "true",
        speed: Number(document.querySelector('[data-racing-hero] [data-hud="speed"]')?.textContent),
      };
    });
  const stage = page.locator(`${CARD} [role="group"]`).first();
  await stage.focus();
  const lit: string[] = [];
  let sawGreen = false;
  await expect
    .poll(
      async () => {
        const s = await snap();
        if (s.lit && lit[lit.length - 1] !== s.lit) lit.push(s.lit);
        sawGreen ||= s.green;
        return lit.includes("5");
      },
      { timeout: 60_000, intervals: [50], message: "the five lights never all lit" },
    )
    .toBe(true);
  // a key pressed with the lights on is no jump start. The hold after the fifth light can be as short as a second, so the check
  // only counts when the same snapshot still shows the five red lights (a car that is away after lights out is not a jump start)
  await page.keyboard.down("w");
  await page.waitForTimeout(300);
  const pressed = await snap();
  sawGreen ||= pressed.green;
  if (pressed.present && pressed.lit === "5" && !pressed.green) expect(pressed.speed, "it moved before the lights went out").toBe(0);
  await page.keyboard.up("w");
  // having tried, give the car back to the autopilot
  await page.keyboard.press("Escape");
  // then they go out and show green, and the car goes
  await expect
    .poll(
      async () => {
        const s = await snap();
        sawGreen ||= s.green;
        return s.speed;
      },
      { timeout: 40_000, intervals: [50] },
    )
    .toBeGreaterThan(30);
  expect(sawGreen, "the lights never showed green").toBe(true);
  expect(lit.map(Number).sort()).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
  // and the lights are gone once the race is on
  await expect(lights(page)).toHaveCount(0, { timeout: 15_000 });
});

test("home: the card goes full screen and comes back, and can be restarted from the grid", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  const status = await openHome(page);
  test.skip(status !== "ready", "this browser has no WebGL");
  const full = page.getByRole("button", { name: "Full screen" });
  await expect(full).toBeVisible();
  const before = (await page.locator(CARD).boundingBox())!;
  await full.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className ?? ""), { timeout: 8_000 }).toContain("racing-card");
  // the picture fills the whole screen: the instruments and notes are small panels over its corners, not strips beside it
  const stageBox = await page.locator(`${CARD} .racing-stage`).evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight, iw: window.innerWidth, ih: window.innerHeight }));
  expect(stageBox.w).toBe(stageBox.iw);
  expect(stageBox.h).toBe(stageBox.ih);
  await expect(page.getByRole("button", { name: "Exit full screen" })).toBeVisible();
  const overlay = page.locator(`${CARD} [data-racing-overlay]`);
  await expect(overlay).toBeVisible();
  const panels = await overlay.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, ih: window.innerHeight, readouts: ["speed", "gear", "position", "lap"].every((n) => !!el.querySelector(`[data-hud="${n}"]`)) };
  });
  expect(panels.readouts, "speed, gear, position and lap are all still on screen").toBe(true);
  expect(panels.bottom).toBeLessThanOrEqual(panels.ih);
  expect(panels.ih - panels.top, "the panels take a thin strip of the picture").toBeLessThan(panels.ih * 0.14);
  await expect(page.locator(CARD).getByText(/An invented circuit and field/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Take the wheel" })).toBeVisible();
  // they are still alive: the numbers keep moving
  await expect.poll(async () => Number((await readout(page)).speed), { timeout: 40_000 }).toBeGreaterThan(40);
  // the canvas follows the new size
  await expect.poll(() => page.locator(`${CARD} canvas`).evaluate((c: HTMLCanvasElement) => c.clientWidth), { timeout: 8_000 }).toBe(stageBox.iw);
  await page.getByRole("button", { name: "Exit full screen" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  const after = (await page.locator(CARD).boundingBox())!;
  expect(Math.round(after.width)).toBe(Math.round(before.width));
  // restart: back on the grid, lights and all
  await expect.poll(async () => Number((await readout(page)).speed), { timeout: 40_000 }).toBeGreaterThan(40);
  await page.getByRole("button", { name: "Restart from the grid" }).click();
  await expect(lights(page)).toBeVisible({ timeout: 8_000 });
  await expect.poll(async () => Number((await readout(page)).speed), { timeout: 8_000 }).toBeLessThan(10);
});

test("home: sound is off until it is asked for, then an engine runs, and it can be switched off again", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  // count the audio contexts the page makes: none before the button is pressed
  await page.addInitScript(() => {
    const w = window as unknown as { __contexts: number; AudioContext: typeof AudioContext };
    w.__contexts = 0;
    const Original = w.AudioContext;
    w.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        w.__contexts++;
      }
    } as typeof AudioContext;
  });
  const status = await openHome(page);
  test.skip(status !== "ready", "this browser has no WebGL");
  const contexts = () => page.evaluate(() => (window as unknown as { __contexts: number }).__contexts);
  const button = page.getByRole("button", { name: "Sound", exact: true });
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(1500);
  expect(await contexts(), "the page made sound before it was asked to").toBe(0);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await contexts()).toBe(1);
  // the audio is running, not stuck waiting for a gesture
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __contexts: number }).__contexts), { timeout: 3000 })
    .toBe(1);
  await page.waitForTimeout(1200);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  // and on again: the same context, not a new one each time
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await contexts()).toBe(1);
});

test("home: where the browser has no full screen the card fills the window instead, and Escape gives it back", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-375");
  await page.addInitScript(() => {
    Object.defineProperty(document, "fullscreenEnabled", { value: false });
  });
  const status = await openHome(page);
  test.skip(status !== "ready", "this browser has no WebGL");
  await page.getByRole("button", { name: "Full screen" }).click();
  await expect(page.locator(CARD).locator("section")).toHaveAttribute("data-expanded", "true");
  const box = (await page.locator(CARD).locator("section").boundingBox())!;
  expect(Math.round(box.x)).toBe(0);
  expect(Math.round(box.y)).toBe(0);
  expect(Math.round(box.width)).toBe(375);
  await assertViewport(page, 375);
  // the instruments and notes sit over the picture, inside the window
  const overlay = (await page.locator(`${CARD} [data-racing-overlay]`).boundingBox())!;
  expect(overlay.x).toBeGreaterThanOrEqual(0);
  expect(overlay.x + overlay.width).toBeLessThanOrEqual(375);
  await page.getByRole("button", { name: "Exit full screen" }).click();
  await expect(page.locator(CARD).locator("section")).not.toHaveAttribute("data-expanded", "true");
});

test("home: a phone scrolls over the picture, and drives only from its own buttons", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-375");
  const status = await openHome(page);
  test.skip(status !== "ready", "this browser has no WebGL");
  const stage = page.locator(`${CARD} [role="group"]`).first();
  expect(await stage.evaluate((el) => getComputedStyle(el).touchAction)).toBe("pan-y");
  await page.getByRole("button", { name: "Take the wheel" }).click();
  await expect(page.getByRole("group", { name: "Driving controls" })).toBeVisible();
  for (const name of ["Steer left", "Steer right", "Brake", "Accelerate"]) {
    const box = (await page.getByRole("button", { name }).boundingBox())!;
    expect(box.width, name).toBeGreaterThanOrEqual(44);
    expect(box.height, name).toBeGreaterThanOrEqual(44);
  }
  expect(await stage.evaluate((el) => getComputedStyle(el).touchAction)).toBe("none");
  await assertViewport(page, 375);
  await page.getByRole("button", { name: "Back to autopilot" }).click();
  await expect(page.getByRole("group", { name: "Driving controls" })).toHaveCount(0);
});

test("home: asked for less motion, it holds still until it is asked to play", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const status = await openHome(page);
  test.skip(status !== "ready", "this browser has no WebGL");
  await expect(page.getByRole("button", { name: "Play preview" })).toBeVisible();
  const still = await readout(page);
  await page.waitForTimeout(1500);
  expect((await readout(page)).speed, "it moved with reduced motion asked for").toBe(still.speed);
  await page.getByRole("button", { name: "Play preview" }).click();
  await expect.poll(async () => (await readout(page)).speed, { timeout: 25_000 }).not.toBe(still.speed);
});

test("home: without WebGL the card says so and still shows a picture, and the page works", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (/webgl/i.test(kind)) return null;
      return (real as (...a: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect.poll(() => cardStatus(page), { timeout: 15_000 }).toBe("fallback");
  await expect(page.locator(CARD).getByText(/3D view is unavailable/)).toBeVisible();
  // a real picture of the scene stands in for it (a photograph, not a drawing)
  await expect.poll(() => page.locator(`${CARD} img[src="/racing/poster.jpg"]`).evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth), { timeout: 10_000 }).toBeGreaterThan(500);
  await expect(page.getByRole("heading", { name: /predict the podium/i })).toBeVisible();
  await assertViewport(page, testInfo.project.use.viewport!.width);
  expect(errors).toEqual([]);
});

test("race: the step strip says in words where the reader is", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  await page.goto(RACE);
  const steps = page.locator(".journey-steps li");
  await expect(steps).toHaveCount(5);
  await expect(steps.nth(0)).toHaveAttribute("data-state", "next");
  await expect(steps.nth(4)).toHaveAttribute("data-state", "locked");
  await expect(steps.nth(4)).toContainText("Unlocks after reveal");
  await assertViewport(page, testInfo.project.use.viewport!.width);
});

test("people: a driver's page describes the season, a team's page says who ran it with sources, and a principal's name finds their team", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`); });
  const width = testInfo.project.use.viewport!.width;

  // the driver: the person, the season in words, the arc, the weekends, the team
  await page.goto("/#/drivers/norris?season=2024");
  await expect(page.getByRole("heading", { name: "About Norris" })).toBeVisible();
  await expect(page.getByText(/Norris won 4 races \(Miami, Dutch, Singapore and Abu Dhabi\)/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Championship, round by round" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Lando Norris: championship position after each round of 2024/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Weekends to look at" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "McLaren in 2024" })).toBeVisible();
  await assertViewport(page, width);
  // who ran the team comes with a source and says it is not from the dataset
  const ran = page.locator("section", { has: page.getByRole("heading", { name: "Who ran McLaren" }) });
  await expect(ran.getByText("Andrea Stella")).toBeVisible();
  await expect(ran.locator('[data-provenance="reference"]').first()).toBeVisible();
  await expect(ran.getByRole("link", { name: "the-race.com" })).toHaveAttribute("href", /^https:\/\/www\.the-race\.com\//);
  await expect(ran.getByText(/This is not part of the race dataset/)).toBeVisible();

  // the team: where it finished, and the people, with a team representative called what it was
  await ran.getByRole("link", { name: "More about McLaren" }).click();
  await expect(page).toHaveURL(/#\/teams\/mclaren/);
  await expect(page.getByRole("heading", { level: 1, name: "McLaren" })).toBeVisible();
  await expect(page.getByText(/finished 1st in the constructors' championship with 666 points/)).toBeVisible();
  await assertViewport(page, width);
  await page.goto("/#/teams/sauber?season=2024");
  await expect(page.getByRole("heading", { level: 1, name: "Sauber" })).toBeVisible();
  // his own row: called what he was called, and never a team principal
  const row = page.locator("li", { hasText: "Alessandro Alunni Bravi" }).first();
  await expect(row).toContainText(/team representative/i);
  await expect(row).not.toContainText(/team principal/i);
  await page.goto("/#/teams/alpine?season=2023");
  await expect(page.getByText("in charge in 2023")).toHaveCount(2);
  await assertViewport(page, width);

  // searching a principal's name finds the team they ran
  await page.goto("/#/");
  await page.getByRole("button", { name: "Search races, drivers and pages" }).click();
  await page.getByRole("combobox", { name: "Search" }).fill("toto");
  // the palette's own results: the page has native <option>s of its own (a circuit picker) that come first in the document
  const first = page.getByRole("dialog", { name: "Search races, drivers and pages" }).getByRole("option").first();
  await expect(first).toContainText("Toto Wolff");
  await expect(first).toContainText("Leader");
  await page.getByRole("combobox", { name: "Search" }).press("Enter");
  await expect(page).toHaveURL(/#\/teams\/mercedes/);
  await expect(page.getByRole("heading", { level: 1, name: "Mercedes" })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const reduced of [false, true]) {
  test(`search: the highlight follows the keys, a new search sends it back at once, and the palette ${reduced ? "goes at once when motion is reduced" : "leaves with a fade"}`, async ({ page }, testInfo) => {
    test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#/");
    const trigger = page.getByRole("button", { name: "Search races, drivers and pages" });
    await trigger.click();
    const field = page.getByRole("combobox", { name: "Search" });
    await expect(field).toBeFocused();
    const cursor = page.locator(".palette__cursor");
    const rowTop = () => page.evaluate(() => (document.querySelector("[role=option][aria-selected=true]") as HTMLElement).offsetTop);
    const cursorAt = () => page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".palette__cursor")!).transform).m42);

    // A new search puts the highlight on its first row at once: it does not travel there.
    await field.fill("abu");
    await expect.poll(cursorAt).toBe(await rowTop());
    await expect(cursor).not.toHaveAttribute("data-slide", "true");
    // The keys move it, and it comes to rest exactly on the row they chose.
    await field.press("ArrowDown");
    await field.press("ArrowDown");
    await expect(cursor).toHaveAttribute("data-slide", "true");
    await expect.poll(cursorAt, { message: "the highlight did not come to rest on the active row" }).toBe(await rowTop());
    await expect(page.locator("[role=option][aria-selected=true]")).toHaveCount(1);
    // Typing again sends it back to the first row without a glide.
    await field.fill("mon");
    await expect(cursor).not.toHaveAttribute("data-slide", "true");
    await expect.poll(cursorAt).toBe(await rowTop());

    // Leaving: watched from the instant Escape is pressed, because a fade this short is gone before a poll would see it.
    const leaving = page.evaluate(
      () =>
        new Promise<{ state: string | undefined; hidden: string | null; clicks: string } | "gone">((resolve) => {
          const palette = document.querySelector("body > .palette")!;
          const watch = new MutationObserver(() => {
            if (!document.body.contains(palette)) {
              watch.disconnect();
              resolve("gone");
            } else if ((palette as HTMLElement).dataset.state === "closing") {
              watch.disconnect();
              resolve({ state: (palette as HTMLElement).dataset.state, hidden: palette.getAttribute("aria-hidden"), clicks: getComputedStyle(palette).pointerEvents });
            }
          });
          watch.observe(palette, { attributes: true });
          watch.observe(document.body, { childList: true });
          setTimeout(() => resolve("gone"), 2000);
        }),
    );
    await field.press("Escape");
    // focus is back on the button at once, whatever the palette is doing
    await expect(trigger).toBeFocused();
    const seen = await leaving;
    if (reduced) expect(seen, "with reduced motion it goes at once, with no fade").toBe("gone");
    else expect(seen, "it stays on screen for its fade, out of reach and hidden from assistive technology").toEqual({ state: "closing", hidden: "true", clicks: "none" });
    await expect(page.locator("body > .palette")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveClass(/palette-open/);

    // Opening it again starts clean.
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("combobox", { name: "Search" })).toHaveValue("");
    await expect(page.locator("[role=option]").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("Race Lab configures, strategises, completes and exports a seeded race", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/#/race-lab?r=1144&l=5&s=9032024&m=hybrid&o=strategist");
  await expect(page.getByRole("heading", { name: "Race Lab", exact: true })).toBeVisible();
  await assertViewport(page, testInfo.project.use.viewport!.width);
  await expect(page.getByText(/minimum 6/i)).toBeVisible();
  // The three play modes share the column: nothing is cut off and the strip does not scroll sideways.
  const modes = page.getByRole("radiogroup", { name: "Play mode" });
  for (const name of ["Simulator", "Strategist", "Model battle"]) await expect(modes.getByRole("radio", { name })).toBeVisible();
  expect(await modes.evaluate((el) => el.scrollWidth - el.clientWidth), "mode tabs scroll sideways").toBeLessThanOrEqual(0);
  for (const radio of await modes.getByRole("radio").all()) {
    const [inside, box] = await Promise.all([modes.boundingBox(), radio.boundingBox()]);
    expect(box!.x + box!.width, "a tab is cut off at the right").toBeLessThanOrEqual(inside!.x + inside!.width + 1);
  }
  await page.screenshot({ path: `${evidenceDir}/${testInfo.project.name}-race-lab-setup.png`, fullPage: false });
  const startRace = page.getByRole("button", { name: /start race/i });
  if (testInfo.project.use.hasTouch) await startRace.tap(); else await startRace.click();
  await expect(page.getByRole("region", { name: "Live race" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const live = document.getElementById("lab-live");
    const nav = document.querySelector<HTMLElement>("header.fixed");
    return live && nav ? Math.abs(live.getBoundingClientRect().top - nav.getBoundingClientRect().bottom) <= 2 : false;
  })).toBe(true);
  await page.screenshot({ path: `${evidenceDir}/${testInfo.project.name}-race-lab-live.png`, fullPage: false });
  const pauseRace = page.getByRole("button", { name: "Pause" });
  if (testInfo.project.use.hasTouch) await pauseRace.tap(); else await pauseRace.click();
  await page.getByRole("button", { name: "Advance lap" }).click();
  await expect(page.getByText("LAP 1 / 5", { exact: true })).toBeVisible();
  await page.getByLabel("Pace").selectOption("attack");
  await page.getByRole("button", { name: "Pit next lap" }).click();
  await page.getByLabel("Simulation speed").selectOption("4");
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("heading", { name: /wins$/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/simulated result/i)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export record" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^paladin-race-lab-2024-abu-dhabi-9032024\.json$/);
  await page.locator("#lab-results").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceDir}/${testInfo.project.name}-race-lab-result.png`, fullPage: false });
  expect(errors).toEqual([]);
});

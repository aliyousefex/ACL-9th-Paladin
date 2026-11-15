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
    ["circuits", "/#/circuits"],
    ["model", "/#/model"],
    ["method", "/#/method"],
    ["race-lab", "/#/race-lab"],
    ["analysis", "/#/analysis"],
    ["history", "/#/history"],
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
  await expect(page.getByRole("option").first()).toContainText(/monaco grand prix 2023/i);
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

/* ------------------------------------------------------------------ theme, targets, header, paging */

const SURVEY: [string, string][] = [
  ["home", "/"],
  ["race", RACE],
  ["analysis", "/#/analysis"],
  ["history", "/#/history?tab=driver&d=1"],
  ["league", "/#/league"],
  ["guide", "/#/guide"],
  ["research", "/#/model"],
  ["drivers", "/#/drivers"],
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

test("theme: a sliding light/dark switch that follows the device until it is flipped, then remembers the choice", async ({ page }, testInfo) => {
  test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  const pref = () => page.evaluate(() => document.documentElement.dataset.themePref);
  expect([await theme(), await pref()]).toEqual(["dark", "system"]);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(10, 11, 14)");

  const toggle = page.getByRole("switch", { name: "Dark mode" });
  // Which end of the track the knob is at, so the test sees the slide and not only the attribute.
  const knobSide = async () => {
    const [track, knob] = await Promise.all([page.locator(".theme-toggle__track").boundingBox(), page.locator(".theme-toggle__knob").boundingBox()]);
    return knob!.x + knob!.width / 2 < track!.x + track!.width / 2 ? "left" : "right";
  };
  const state = async () => [await theme(), await pref()];
  await expect(page.getByRole("button", { name: "Match my device" }), "there is no second control").toHaveCount(0);

  // Until it is flipped the switch follows the device, live, in both directions.
  await expect(toggle).toBeChecked();
  expect(await knobSide()).toBe("right");
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(theme).toBe("light");
  await expect(toggle).not.toBeChecked();
  await expect.poll(knobSide).toBe("left");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(theme).toBe("dark");
  expect(await pref()).toBe("system");

  // Flipping it saves an explicit choice. The change lands a frame later because it plays as a wipe growing from the knob.
  await toggle.click();
  await expect.poll(state).toEqual(["light", "light"]);
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--vt-r")), "the wipe cleans up after itself").toBe("");
  await expect(toggle).not.toBeChecked();
  await expect.poll(knobSide).toBe("left");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(243, 242, 238)");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f3f2ee");

  // remembered, and applied before the app starts (the first paint is already the right theme)
  await page.reload();
  expect(await theme()).toBe("light");
  await expect(toggle).not.toBeChecked();
  expect(await knobSide()).toBe("left");

  // It is a switch: focus it and Space flips it, and focus stays put.
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect.poll(state).toEqual(["dark", "dark"]);
  await expect(toggle).toBeChecked();
  await expect(toggle).toBeFocused();
  await expect.poll(knobSide).toBe("right");

  // An explicit choice is not overridden by the device.
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(300);
  expect(await theme()).toBe("dark");

  // With reduced motion there is no wipe at all: the theme changes in place, in the same task as the click.
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await toggle.click();
  expect(await state()).toEqual(["light", "light"]);
  expect(errors).toEqual([]);
});

for (const scheme of ["dark", "light"] as const) {
  test(`theme: ${scheme} text is readable on every page (WCAG AA, measured on the rendered page)`, async ({ page }, testInfo) => {
    test.skip(!["mobile-375", "desktop-1440"].includes(testInfo.project.name));
    test.setTimeout(150_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(() => {
      window.localStorage.setItem("paladin:mode", "expert");
      window.localStorage.setItem("paladin:show-results", "1");
    });
    const report: Record<string, unknown[]> = {};
    for (const [name, url] of SURVEY) {
      await page.goto(url);
      await settle(page);
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(scheme);
      const bad = await lowContrast(page);
      if (bad.length) report[name] = bad.slice(0, 5);
    }
    expect(report, "text below AA contrast").toEqual({});
  });
}

test("touch targets: on a phone nothing you can press is smaller than 24px, and most things are 44px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-375");
  test.setTimeout(120_000);
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
  // reading hides only the brand capsule: the destinations stay at the thumb, and the race's own section navigation takes the top
  expect(await top(dock)).toBe(dockTop);
  await expect.poll(() => top(section)).toBeLessThanOrEqual(1);
  await expect(section).toBeVisible();

  await page.evaluate(() => window.scrollBy(0, -260));
  await expect(page.locator("html")).not.toHaveAttribute("data-chrome", "compact");
  await expect.poll(() => top(brand)).toBe(0);
  // the section navigation starts where the capsule ends, never under it
  await expect.poll(async () => (await top(section)) >= (await bottom(capsule)) - 1).toBe(true);
  expect(await top(dock)).toBe(dockTop);

  // keyboard or screen-reader focus can never land on something that is off screen
  await page.evaluate(() => window.scrollTo(0, 3200));
  await expect(page.locator("html")).toHaveAttribute("data-chrome", "compact");
  await page.getByRole("button", { name: "Search races, drivers and pages" }).focus();
  await expect(page.locator("html")).not.toHaveAttribute("data-chrome", "compact");
  await expect.poll(() => top(brand)).toBe(0);
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

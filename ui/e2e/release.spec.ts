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
  // Count how often a page-wide view transition is asked for: it holds the whole screen still, knob included, while the browser paints the page twice more.
  await page.addInitScript(() => {
    (window as unknown as { __wipes: number }).__wipes = 0;
    const original = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition?.bind(document);
    if (original) (document as unknown as { startViewTransition: (cb: () => void) => unknown }).startViewTransition = (cb) => ((window as unknown as { __wipes: number }).__wipes++, original(cb));
  });
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

  // Flipping it saves an explicit choice. The tyre answers the press at once; the page follows two frames later, so the control has
  // started to roll before the page stops to repaint. A switch that waited for the page would feel like it lagged.
  const atOnce = await toggle.evaluate(async (button: HTMLButtonElement) => {
    button.click();
    await Promise.resolve(); // let React's own update land
    await Promise.resolve();
    return [button.getAttribute("aria-checked"), document.documentElement.dataset.theme];
  });
  expect(atOnce, "the knob has moved before the page has changed").toEqual(["false", "dark"]);
  await expect.poll(state).toEqual(["light", "light"]);
  // The page changes in one step on every device: no view transition was asked for.
  expect(await page.evaluate(() => (window as unknown as { __wipes: number }).__wipes), "no page-wide transition").toBe(0);
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

  // With reduced motion there is nothing to wait for: the theme changes in place, in the same task as the click.
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
  // and its drop shadow (14px down, 34px of blur) is off screen with it, not hanging over the top of the page as a haze
  await expect.poll(() => bottom(capsule)).toBeLessThanOrEqual(-48);
  // reading hides only the brand capsule: the destinations stay at the thumb, and the race's own section strip (a pill 8px from the top) takes its place
  expect(await top(dock)).toBe(dockTop);
  await expect.poll(() => top(section)).toBeLessThanOrEqual(9);
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

test("phone: a jittery thumb does not make the capsule and the section strip flicker, and the strip glides with the capsule", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-375");
  await page.goto(RACE);
  await expect(page.locator("#prediction")).toBeAttached();
  const strip = page.getByRole("navigation", { name: "On this race" });
  const capsule = page.locator("header.chrome-bar .site-bar__inner");
  const top = async (locator: typeof strip) => Math.round((await locator.boundingBox())!.y);
  const bottom = async (locator: typeof strip) => {
    const box = (await locator.boundingBox())!;
    return Math.round(box.y + box.height);
  };
  const chrome = () => page.evaluate(() => document.documentElement.dataset.chrome ?? "shown");

  await page.evaluate(() => window.scrollTo(0, 1700));
  await expect.poll(chrome).toBe("compact");
  await expect.poll(() => top(strip)).toBeLessThanOrEqual(9);

  // A thumb slips back a few pixels at a time, again and again, without ever really pulling the page down.
  for (const slip of [-6, -9, 5, -12, 4, -14, 6, -11]) {
    await page.evaluate((d) => window.scrollBy(0, d), slip);
    await page.waitForTimeout(60);
  }
  expect(await chrome(), "slips and small reversals do not bring the capsule back").toBe("compact");
  expect(await top(strip), "and the strip has not moved").toBeLessThanOrEqual(9);

  // A real pull upward brings the capsule back, and the strip goes down with it as a glide (never a 56px snap), to sit right under it.
  const positions = await page.evaluate(async () => {
    const nav = document.querySelector('nav[aria-label="On this race"]')!;
    const seen: number[] = [];
    window.scrollBy(0, -90);
    const end = performance.now() + 700;
    while (performance.now() < end) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      seen.push(Math.round(nav.getBoundingClientRect().top));
    }
    return seen;
  });
  expect(await chrome()).toBe("shown");
  const settled = positions[positions.length - 1];
  expect(settled).toBeGreaterThanOrEqual((await bottom(capsule)) - 1);
  const between = new Set(positions.filter((y) => y > 1 && y < settled - 1));
  expect(between.size, `the strip glided through ${[...between].join(", ")} on its way to ${settled}`).toBeGreaterThanOrEqual(3);

  // Reading on puts both away together, and the strip is back at the very top.
  await page.evaluate(() => window.scrollBy(0, 160));
  await expect.poll(chrome).toBe("compact");
  await expect.poll(() => top(strip)).toBeLessThanOrEqual(9);
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

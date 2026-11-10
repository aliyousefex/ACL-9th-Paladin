import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

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
    const primaryNav = page.getByRole("navigation", { name: "Primary" });
    await expect(primaryNav).toHaveCSS("position", "fixed");
    const beforeScroll = await primaryNav.boundingBox();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const afterScroll = await primaryNav.boundingBox();
    expect(afterScroll?.y).toBeCloseTo(beforeScroll!.y, 0);
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
  await expect(page.getByText("LAP 1 / 5")).toBeVisible();
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

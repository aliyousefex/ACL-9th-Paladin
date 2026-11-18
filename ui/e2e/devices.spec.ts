import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * The device matrix: every page, on the screens people actually use, from a 320px phone to a 2560px monitor,
 * including phones and tablets on their side. For each it checks what a person would notice first: nothing sticks out sideways,
 * no text is cut off, the bar and the dock fit their screen with nothing overlapping, and the search and the More list
 * stay on screen. (The contrast and touch-target audits live in release.spec.ts.) One project runs the whole matrix.
 */

type Device = { name: string; w: number; h: number; mobile: boolean; dpr: number };

const DEVICES: Device[] = [
  { name: "320 phone (small)", w: 320, h: 568, mobile: true, dpr: 2 },
  { name: "360 Android", w: 360, h: 780, mobile: true, dpr: 3 },
  { name: "375 iPhone", w: 375, h: 812, mobile: true, dpr: 3 },
  { name: "390 iPhone 14", w: 390, h: 844, mobile: true, dpr: 3 },
  { name: "412 Pixel", w: 412, h: 915, mobile: true, dpr: 2.6 },
  { name: "430 iPhone Pro Max", w: 430, h: 932, mobile: true, dpr: 3 },
  { name: "667 phone on its side (small)", w: 667, h: 375, mobile: true, dpr: 2 },
  { name: "844 phone on its side", w: 844, h: 390, mobile: true, dpr: 3 },
  { name: "600 small tablet or foldable", w: 600, h: 960, mobile: true, dpr: 2 },
  { name: "768 tablet", w: 768, h: 1024, mobile: true, dpr: 2 },
  { name: "820 iPad Air", w: 820, h: 1180, mobile: true, dpr: 2 },
  { name: "1024 tablet on its side", w: 1024, h: 768, mobile: true, dpr: 2 },
  { name: "1180 iPad on its side", w: 1180, h: 820, mobile: true, dpr: 2 },
  { name: "1280 small laptop", w: 1280, h: 720, mobile: false, dpr: 1 },
  { name: "1366 laptop", w: 1366, h: 768, mobile: false, dpr: 1 },
  { name: "1440 laptop", w: 1440, h: 900, mobile: false, dpr: 2 },
  { name: "1920 desktop", w: 1920, h: 1080, mobile: false, dpr: 1 },
  { name: "2560 monitor", w: 2560, h: 1440, mobile: false, dpr: 1 },
];

const ROUTES: [string, string][] = [
  ["season", "/#/"],
  ["race", "/#/race/2024/abu-dhabi"],
  ["analysis", "/#/analysis"],
  ["race lab", "/#/race-lab"],
  ["model", "/#/model"],
  ["method", "/#/method"],
  ["guide", "/#/guide"],
  ["drivers", "/#/drivers"],
  ["driver", "/#/drivers/norris?season=2024"],
  ["teams", "/#/teams"],
  ["team", "/#/teams/alpine?season=2024"],
  ["circuits", "/#/circuits"],
  ["history", "/#/history"],
  ["knowledge graph", "/#/history?tab=kg"],
  ["league", "/#/league"],
];

/** Sections mount as they scroll into view, so walk the page once before measuring it. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(300, Math.round(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight && y < 40000; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 45));
    }
    window.scrollTo(0, 0);
    // The bar slides back in over 220ms when the page is at the top again; measure it once it has arrived.
    await new Promise((resolve) => setTimeout(resolve, 450));
  });
}

/** What sticks out sideways, and what text is cut off. */
async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const root = document.documentElement;
    const vw = root.clientWidth;
    const label = (el: Element) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : ""} "${(el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 28)}"`;
    if (root.scrollWidth > vw) problems.push(`the page is ${root.scrollWidth - vw}px wider than the screen`);
    // Inside something that scrolls or clips sideways on purpose (a table, a strip of tabs), sticking out is the point.
    const contained = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true;
      }
      return false;
    };
    const out: string[] = [];
    const cut: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
      // The fixed bars are as wide as the layout viewport, so when the page overflows they overflow with it: a symptom, not the
      // cause, and chromeProblems checks their own fit.
      if (el.closest("header.chrome-bar, nav.dock, .to-top")) continue;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || s.position === "fixed") continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      // Text kept for screen readers only is clipped to a pixel on purpose.
      if (r.width <= 1.5 && r.height <= 1.5) continue;
      if (el.closest(".sr-only") || el.classList.contains("sr-only")) continue;
      if ((r.right > vw + 1.5 || r.left < -1.5) && !contained(el)) out.push(`${label(el)} spans ${Math.round(r.left)} to ${Math.round(r.right)} of ${vw}`);
      const text = (el.textContent ?? "").trim();
      if (text && /^(H1|H2|H3|H4|BUTTON|A|LABEL|LI|SPAN|P)$/.test(el.tagName) && /(hidden|clip)/.test(s.overflowX) && s.textOverflow !== "ellipsis" && el.scrollWidth > el.clientWidth + 1 && el.children.length < 3) {
        cut.push(`${label(el)} is cut off (${el.scrollWidth} in ${el.clientWidth})`);
      }
    }
    problems.push(...out.slice(0, 6), ...cut.slice(0, 6));
    return problems;
  });
}

/** The bar, the dock and the tools: all on screen, the right one for the width, nothing overlapping. */
async function chromeProblems(page: Page): Promise<string[]> {
  const c = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const shown = (el: Element | null) => !!el && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden";
    const box = (sel: string) => {
      const el = document.querySelector(sel);
      if (!shown(el)) return null;
      const r = el!.getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, sw: el!.scrollWidth, cw: el!.clientWidth };
    };
    const rects = (sel: string) => [...document.querySelectorAll(sel)].filter(shown).map((el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
    return {
      vw, vh,
      capsule: box("header .site-bar__inner"), nav: box("header nav.site-nav"), dock: box("nav.dock"),
      search: box("header .site-tool"), brand: box("header .nav-brand"), chip: box("header .section-chip"),
      links: rects("header .site-nav__link"), dockItems: rects("nav.dock .dock__item"),
    };
  });
  const problems: string[] = [];
  const inside = (b: { l: number; r: number; t: number; b: number }, what: string, w = c.vw, h = c.vh) => {
    if (b.l < -0.5 || b.r > w + 0.5 || b.t < -0.5 || b.b > h + 0.5) problems.push(`${what} is off screen (${Math.round(b.l)},${Math.round(b.t)} to ${Math.round(b.r)},${Math.round(b.b)} on ${w}x${h})`);
  };
  if (!c.capsule) return ["the top bar is missing"];
  inside(c.capsule, "the top bar");
  if (c.capsule.sw > c.capsule.cw + 1) problems.push(`the top bar's contents overflow it (${c.capsule.sw} in ${c.capsule.cw})`);
  for (const [what, b] of [["search", c.search], ["the brand link", c.brand]] as const) {
    if (!b) problems.push(`${what} is missing`);
    else if (b.l < c.capsule.l - 0.5 || b.r > c.capsule.r + 0.5) problems.push(`${what} sticks out of the top bar`);
  }
  if (c.brand && c.search && c.brand.r > c.search.l + 0.5) problems.push("the brand link overlaps search");
  // The section chip, when the page's strip has melted into the bar: inside it, beside the logo, clear of the links and the tools.
  if (c.chip) {
    if (c.chip.l < c.capsule.l - 0.5 || c.chip.r > c.capsule.r + 0.5) problems.push("the section chip sticks out of the top bar");
    if (c.brand && c.chip.l < c.brand.r - 1) problems.push("the section chip overlaps the brand link");
    if (c.search && c.chip.r > c.search.l + 0.5) problems.push("the section chip overlaps search");
    if (c.vw >= 768 && c.links.length && c.chip.r > Math.min(...c.links.map((link) => link.l)) + 0.5) problems.push("the section chip overlaps the links in the bar");
    if (c.chip.b - c.chip.t < 30) problems.push("the section chip is too short to tap");
  }
  if (c.vw >= 768) {
    if (!c.nav) problems.push("a screen this wide has no navigation in the bar");
    if (c.dock) problems.push("a screen this wide still shows the phone dock");
    const links = [...c.links].sort((a, b) => a.l - b.l);
    if (links.length < 5) problems.push(`only ${links.length} links in the bar`);
    for (let i = 1; i < links.length; i++) if (links[i].l < links[i - 1].r - 0.5) problems.push("two links in the bar overlap");
    if (links.length && c.brand && links[0].l < c.brand.r - 0.5) problems.push("the first link overlaps the brand");
    if (links.length && c.search && links[links.length - 1].r > c.search.l + 0.5) problems.push("the last link overlaps search");
  } else {
    if (c.nav) problems.push("a phone shows the wide navigation");
    if (!c.dock) problems.push("a phone has no dock");
    else {
      inside(c.dock, "the dock");
      if (c.dock.sw > c.dock.cw + 1) problems.push("the dock's contents overflow it");
      for (const item of c.dockItems) if (item.l < c.dock.l - 0.5 || item.r > c.dock.r + 0.5) problems.push("a dock item sticks out of the dock");
      if (c.dockItems.length < 6) problems.push(`only ${c.dockItems.length} dock items`);
      if (c.dockItems.some((item) => item.r - item.l < 44)) problems.push("a dock item is narrower than a fingertip (44px)");
    }
  }
  return problems;
}

/** Search and the More list, each opened and checked to be wholly on screen. */
async function overlayProblems(page: Page, device: Device): Promise<string[]> {
  const problems: string[] = [];
  const vw = device.w;
  const vh = device.h;
  const within = async (locator: ReturnType<Page["locator"]>, what: string) => {
    const box = await locator.boundingBox();
    if (!box) return problems.push(`${what} did not open`);
    if (box.x < -0.5 || box.y < -0.5 || box.x + box.width > vw + 0.5 || box.y + box.height > vh + 0.5) problems.push(`${what} is off screen (${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)} on ${vw}x${vh})`);
  };

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Search races, drivers and pages" }).click();
  await within(page.getByRole("dialog", { name: "Search races, drivers and pages" }), "the search panel");
  const field = page.getByRole("combobox", { name: "Search" });
  await field.fill("abu");
  await expect(page.getByRole("dialog").getByRole("option").first()).toBeVisible();
  await within(page.getByRole("dialog", { name: "Search races, drivers and pages" }), "the search panel with results");
  await page.keyboard.press("Escape");

  const more = vw >= 768 ? page.locator("header").getByRole("button", { name: /more/i }) : page.locator("nav.dock").getByRole("button", { name: /more/i });
  await more.click();
  await within(page.locator(".more-panel:not([hidden])"), "the More list");
  await page.keyboard.press("Escape");
  await page.mouse.click(Math.round(vw / 2), 3);

  return problems;
}

for (const device of DEVICES) {
  test(`${device.name}: every page fits`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one project runs the whole matrix");
    test.setTimeout(420_000);
    mkdirSync("../artifacts/visual-qa/devices", { recursive: true });
    const problems: string[] = [];
    const context = await browser.newContext({
      viewport: { width: device.w, height: device.h },
      deviceScaleFactor: device.dpr,
      isMobile: device.mobile,
      hasTouch: device.mobile,
      colorScheme: "dark",
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto(ROUTES[0][1]);
    for (const [label, path] of ROUTES) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForTimeout(350);
      await settle(page);
      for (const problem of [...(await layoutProblems(page)), ...(await chromeProblems(page))]) problems.push(`${label}: ${problem}`);
      // On a page with sections, the strip melts into the bar when it reaches it: check the bar with the chip showing.
      if (["race", "model", "method"].includes(label)) {
        await page.evaluate(() => window.scrollTo(0, 1800));
        await page.waitForTimeout(250);
        if (device.w < 768) {
          // The bar is away while reading; a pull brings it back. Wait for each state rather than for a time: on a slow, busy
          // machine a fixed wait lets the jump and the pull fold into one scroll, which is correctly not a pull.
          const chrome = () => page.evaluate(() => document.documentElement.dataset.chrome ?? "shown");
          await expect.poll(chrome, { message: `${label}: reading puts the bar away`, timeout: 15_000 }).toBe("compact");
          await page.evaluate(() => window.scrollBy(0, -120));
          await expect.poll(chrome, { message: `${label}: a pull brings the bar back`, timeout: 15_000 }).toBe("shown");
        }
        await page.waitForTimeout(800);
        const chip = page.locator("header .section-chip");
        if (!(await chip.isVisible())) problems.push(`${label}: the strip did not become a chip in the bar`);
        for (const problem of await chromeProblems(page)) problems.push(`${label} (chip showing): ${problem}`);
        if (await page.getByRole("navigation", { name: /On this race|On this page|Walkthrough sections/ }).and(page.locator(".subnav")).isVisible()) problems.push(`${label}: two bars on screen at once`);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(450);
      }
      if (label === "season" || label === "race") {
        await page.screenshot({ path: `../artifacts/visual-qa/devices/${device.w}x${device.h}-${label}.png`, scale: "css" });
      }
    }
    await page.goto(ROUTES[0][1]);
    await expect(page.locator("main")).toBeVisible();
    for (const problem of await overlayProblems(page, device)) problems.push(`${problem}`);
    for (const error of errors) problems.push(`runtime error: ${error}`);
    await context.close();
    expect(problems, `${problems.length} problems on ${device.name}:\n${problems.join("\n")}`).toEqual([]);
  });
}

/**
 * When the reader enlarges their text (the system's font size, which scales everything set in rem). At 200% the floating chrome
 * (bar, dock) must still fit the screen, because it is sized in pixels so it cannot outgrow it; at 150%, a large but common
 * setting, every page's content must fit too. (Browser zoom scales everything, pixels included, and is covered by the 320px phone.)
 */
for (const [scale, wholePage] of [[200, false], [150, true]] as const) {
  test(`text at ${scale}%: ${wholePage ? "every page still fits a phone" : "the bar and the dock still fit a phone"}`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one project runs the whole matrix");
    test.setTimeout(240_000);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("/");
    await page.addStyleTag({ content: `html{font-size:${scale}% !important}` });
    const problems: string[] = [];
    const routes = wholePage ? ROUTES : ROUTES.filter(([name]) => ["guide", "league"].includes(name));
    for (const [label, path] of routes) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForTimeout(350);
      await settle(page);
      for (const problem of await chromeProblems(page)) problems.push(`${label}: ${problem}`);
      if (wholePage) for (const problem of await layoutProblems(page)) problems.push(`${label}: ${problem}`);
    }
    await context.close();
    expect(problems, problems.join("\n")).toEqual([]);
  });
}

/** A phone with a notch on its side: the bar, the dock (on a narrower one), the headline, the button and the search panel all stay clear of the notch and the home indicator. */
for (const [w, h, side, bottom, label] of [
  [844, 390, 47, 21, "an iPhone 14 (the wide bar)"],
  [740, 360, 40, 16, "a narrower notched phone (the dock)"],
] as const) {
  test(`a notched phone on its side, ${label}: nothing is under the notch or the home indicator`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "one project runs the whole matrix");
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: "dark" });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, left: side, bottom, right: side } });
    await page.goto("/#/");
    await expect(page.getByRole("heading", { name: /predict the podium/i })).toBeVisible();
    const problems: string[] = [];
    const clear = (what: string, b: { x: number; width: number } | null) => {
      if (!b) return problems.push(`${what} is missing`);
      if (b.x < side - 0.5) problems.push(`${what} starts at ${Math.round(b.x)}, under the notch (${side})`);
      if (b.x + b.width > w - side + 0.5) problems.push(`${what} ends at ${Math.round(b.x + b.width)}, under the notch (${w - side})`);
    };
    clear("the top bar", await page.locator("header .site-bar__inner").boundingBox());
    clear("the headline", await page.locator("h1").first().boundingBox());
    const dock = page.locator("nav.dock");
    if (w < 768) {
      const box = await dock.boundingBox();
      clear("the dock", box);
      if (box && box.y + box.height > h - bottom + 0.5) problems.push(`the dock reaches ${Math.round(box.y + box.height)}, into the home indicator (${h - bottom})`);
    } else if (await dock.isVisible()) problems.push("a screen this wide still shows the dock");
    await page.evaluate(() => window.scrollTo(0, 2500));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollBy(0, -140));
    await page.waitForTimeout(500);
    const toTop = page.getByRole("button", { name: "Back to the top of the page" });
    if (await toTop.count()) clear("the back-to-top button", await toTop.boundingBox());
    await page.getByRole("button", { name: "Search races, drivers and pages" }).click();
    clear("the search panel", await page.getByRole("dialog").boundingBox());
    await page.screenshot({ path: `../artifacts/visual-qa/devices/notch-landscape-${w}.png`, scale: "css" });
    await context.close();
    expect(problems, problems.join("\n")).toEqual([]);
  });
}

test("forced colours (Windows High Contrast): the bar and the dock are still there and still usable", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "one project runs the whole matrix");
  mkdirSync("../artifacts/visual-qa/devices", { recursive: true });
  for (const [w, h, mobile] of [[1280, 720, false], [390, 844, true]] as const) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, forcedColors: "active", colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("/#/");
    await expect(page.getByRole("heading", { name: /predict the podium/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search races, drivers and pages" })).toBeVisible();
    // The floating surfaces keep an edge in the system's own colour, so they are visible as boxes.
    const edge = await page.locator(mobile ? "nav.dock" : "header .site-bar__inner").evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(edge, "an edge that is not transparent").not.toBe("rgba(0, 0, 0, 0)");
    await page.screenshot({ path: `../artifacts/visual-qa/devices/forced-colours-${w}.png`, scale: "css" });
    await context.close();
  }
});

import { defineConfig } from "@playwright/test";

const viewport = (width: number, height: number, mobile = false) => ({
  name: `${mobile ? "mobile" : width < 1200 ? "tablet" : "desktop"}-${width}`,
  use: {
    channel: "chrome" as const,
    viewport: { width, height },
    hasTouch: mobile,
    isMobile: mobile,
    deviceScaleFactor: mobile ? 2 : 1,
  },
});

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../artifacts/visual-qa/playwright-results",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "../artifacts/visual-qa/playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    actionTimeout: 10_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    viewport(320, 800, true),
    viewport(375, 812, true),
    viewport(390, 844, true),
    viewport(768, 1024),
    viewport(1024, 768),
    viewport(1440, 900),
    viewport(1920, 1080),
  ],
});

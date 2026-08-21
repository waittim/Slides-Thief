import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const systemChrome = [
  process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((candidate) => candidate && existsSync(candidate));

const launchOptions = systemChrome ? { executablePath: systemChrome } : undefined;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    trace: "on-first-retry",
    launchOptions,
  },
  webServer: [
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "GITHUB_PAGES_BASE=/ ./node_modules/.bin/vite preview --config vite.pages.config.ts --host 127.0.0.1 --port 4174 --strictPort",
      url: "http://127.0.0.1:4174/",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "server-build",
      use: { baseURL: "http://127.0.0.1:4173" },
    },
    {
      name: "github-pages-build",
      use: { baseURL: "http://127.0.0.1:4174" },
    },
  ],
});

import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const e2eDataDir = mkdtempSync(path.join(os.tmpdir(), "kosu-playwright-"));
process.env.KOSU_E2E_DATA_DIR = e2eDataDir;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  globalTeardown: "./tests/e2e/global-teardown.ts",
  retries: process.env.CI ? 1 : 0,
  webServer: {
    command: "npm run db:migrate && npm run build && npm start",
    env: {
      KOSU_DATA_DIR: e2eDataDir,
      KOSU_SESSION_SECRET: "kosu-e2e-session-secret-32-characters",
      PORT: "5173",
    },
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

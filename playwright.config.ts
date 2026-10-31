import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "off",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
    // Test-only values so the /api/v1 endpoints are enabled; the issuance limit is raised for repeated runs.
    env: { API_KEY_SECRET: "test-secret-for-playwright-only-0123456789", API_KEY_ISSUE_LIMIT_PER_HOUR: "1000" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: undefined } }],
});

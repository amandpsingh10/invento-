import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a full local stack: `docker compose up` (or `npm run dev`
 * from the repo root) with migrations + seed applied. Not runnable inside
 * this sandbox (no browser binaries / running services here) — intended for
 * CI and local verification.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

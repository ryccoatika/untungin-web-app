import nextEnv from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// The e2e sign-in helper needs the local Supabase URL and keys from .env.local.
nextEnv.loadEnvConfig(process.cwd());

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 2 : 1,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], locale: "id-ID" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], locale: "id-ID" } },
  ],
  webServer: {
    // Always the production build: run `npm run build` first.
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

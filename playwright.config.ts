import nextEnv from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// The e2e sign-in helper needs the local Supabase URL and keys from .env.local.
nextEnv.loadEnvConfig(process.cwd());

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], locale: "id-ID" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], locale: "id-ID" } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

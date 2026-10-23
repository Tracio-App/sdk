import { defineConfig, devices } from "@playwright/test";

// CDN/dist smoke. Serves the built artifacts + fixtures over a real origin and
// drives them in Chromium. Scoped to dist — this is the only coverage of the
// IIFE CDN bundle and the loader's real script-injection behaviour. (SDK audit P1-1.)
const PORT = Number(process.env.PORT || 5273);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/serve.mjs",
    url: `http://localhost:${PORT}/e2e/fixtures/iife.html`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
    timeout: 30_000,
  },
});

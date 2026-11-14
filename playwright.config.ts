import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3105";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT,
      NEXT_PUBLIC_CONVEX_URL: "",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
    },
  },
});

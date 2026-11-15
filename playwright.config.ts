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
    command: "bash e2e/servidor.sh",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    // SIGKILL skips the shell trap that puts .env.local and .convex back.
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    env: {
      PORT,
      CONVEX_AGENT_MODE: "anonymous",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
    },
  },
});

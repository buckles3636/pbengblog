import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  timeout: 45000,
  workers: 1,
  use: { viewport: { width: 1440, height: 1000 } },
  reporter: "list",
});

import { defineConfig, devices } from "@playwright/test";

// E2E for the excalidraw-app via its Vite dev server.
// Infra decisions: tests at repo-root `e2e/`, `@playwright/test` as root devDep,
// Playwright `webServer` runs Vite on port 3001 (与 dev server 同端口;docker
// 独占 3100,见 CLAUDE.md「本地启动与测试」). Chromium only. Browsers must be
// installed once: `npx playwright install chromium`. CI wiring is deferred.
// See .scratch/presentation-text-editor-state/issues/01-e2e-infra-smoke.md.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx vite --port 3001 --strictPort",
    cwd: "excalidraw-app",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

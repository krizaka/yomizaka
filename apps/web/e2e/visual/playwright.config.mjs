// Visual regression of the main journeys (krizaka/.github#375). Run by the org's visual-regression workflow in the official
// Playwright container against the built app (scripts/ci-visual-start.sh); the baselines are Linux ones, never taken on a Mac.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.visual.mjs",
  // One baseline per journey × viewport × theme, named by the journey (defineJourneyTests).
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  outputDir: "../../test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "../../playwright-report" }]],
  workers: 2,
  retries: 0, // a flaky journey is fixed (a mask, a ready selector), never retried
  timeout: 90_000,
  use: { baseURL: process.env.VISUAL_BASE_URL ?? "http://localhost:3000" },
});

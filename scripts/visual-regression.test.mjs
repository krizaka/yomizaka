import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// The visual regression of the main journeys (krizaka/.github#375): compare on pull requests, update on dispatch, one source.
describe("the visual regression", () => {
  const compare = read(".github/workflows/visual.yml");
  const update = read(".github/workflows/update-visual-baselines.yml");

  it("calls the org's reusable workflow, pinned by SHA, in both modes with the same journeys and baselines", () => {
    for (const w of [compare, update]) {
      expect(w).toMatch(/visual-regression\.yml@[0-9a-f]{40}/);
      expect(w).toContain("start-script: scripts/ci-visual-start.sh");
      expect(w).toContain("snapshot-paths: apps/web/e2e/visual/__screenshots__");
    }
    expect(update).toContain("update: true");
    expect(update).toContain("workflow_dispatch");
    expect(compare).toContain("pull_request");
  });

  it("the Playwright version is the one of the pinned container image", () => {
    const pinned = JSON.parse(read("package.json")).devDependencies["@playwright/test"];
    expect(pinned).toBe("1.64.0"); // the org's image is mcr.microsoft.com/playwright:v1.64.0-noble: bump both together
  });

  it("covers the main journeys: public, signed-in, a report, and the first paint of a signed-in page, in both themes", () => {
    const journeys = read("apps/web/e2e/visual/journeys.visual.mjs");
    for (const name of ["landing", "pricing", "sign-in", "app-home", "document-report", "app-home-pending"]) expect(journeys).toContain(`name: "${name}"`);
    expect(journeys).toContain("firstPaint: true");
    expect(journeys).toContain('hold: ["**/api/me"]');
    expect(journeys).toContain("mask: LIVE");
  });

  it("starts the app on the cast, dev only, and records the moment of the seed", () => {
    const start = read("scripts/ci-visual-start.sh");
    expect(start).toContain("APP_ENVIRONMENT=dev");
    expect(start).toContain("demo-seed/cli.mjs --cast");
    expect(start).toContain(".visual-now");
  });
});

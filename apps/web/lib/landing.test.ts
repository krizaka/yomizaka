import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";

import { HOME_SECTIONS, OUTCOMES, productStatus } from "./landing";
import { PAGES } from "./site";

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("the landing tells one story", () => {
  it("in five sections at most: the promise, what you can do, how it works, trust, the closing call", () => {
    expect(HOME_SECTIONS).toEqual(["hero", "outcomes", "how", "trust", "closing"]);
    const home = read("app/[locale]/page.tsx");
    const at = HOME_SECTIONS.map((id) => home.indexOf(`id="${id}"`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("shows three outcomes, each a way in — never a dead-end card", () => {
    expect(OUTCOMES).toHaveLength(3);
    for (const o of OUTCOMES) {
      expect(["run", "verify", "sign-in"]).toContain(o.to);
      expect(en.landing.outcomes[o.id].title.length).toBeGreaterThan(0);
    }
  });

  it("has one primary action per section", () => {
    const home = read("app/[locale]/page.tsx");
    const sections = home.split(/\bid="(?:hero|outcomes|how|trust|closing)"/).slice(1);
    for (const s of sections) expect((s.match(/variant="primary"/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("says its honest status, read from dev-preview.json: in development while a criterion still has a gap", () => {
    const preview = JSON.parse(read("../../dev-preview.json")) as { criteria: Record<string, { evidence: string | null; na?: boolean }> };
    const gaps = Object.values(preview.criteria).some((c) => c.evidence === null && !c.na);
    expect(productStatus(preview)).toBe(gaps ? "development" : "preview");
    expect(en.landing.status[productStatus(preview)]).toBeTruthy();
  });

  it("gives the real run its own address, in the sitemap and both languages", () => {
    expect(PAGES).toContain("run");
    expect(read("app/[locale]/run/page.tsx")).toContain("<ShowcaseRun");
    expect(read("app/[locale]/page.tsx")).not.toContain("<ShowcaseRun");
  });
});

describe("the bar", () => {
  it("carries no version chip (the version is in the footer) and groups the product's pages in one menu", () => {
    const bar = read("components/SiteChrome.tsx");
    expect(bar).not.toContain("NavBar.Badge");
    expect(bar).not.toContain("APP_VERSION");
    expect(bar).toContain("NavBar.Menu");
    expect(read("components/SiteFooter.tsx")).toContain("version={APP_VERSION}");
  });
});

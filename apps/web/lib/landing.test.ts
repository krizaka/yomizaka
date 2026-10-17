import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { HOME_SECTIONS, OUTCOMES, productStatus } from "./landing";
import { PAGES } from "./site";

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("the landing tells one story", () => {
  it("in this order: the promise, what you can do, the proof, how it works, the app recorded, trust, the closing call", () => {
    expect(HOME_SECTIONS).toEqual(["hero", "outcomes", "proof", "how", "app", "trust", "closing"]);
    const home = read("app/[locale]/page.tsx");
    // The proof section is its own component (components/ProofSection.tsx, id="proof").
    const at = HOME_SECTIONS.map((id) => home.indexOf(id === "proof" ? "<ProofSection" : `id="${id}"`));
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
    const sections = home.split(/\bid="(?:hero|outcomes|how|app|trust|closing)"/).slice(1);
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

describe("the first screen is light and clear", () => {
  it("carries no heavy media: the hero is one before/after read from the recorded run, the recorded app tour sits below", () => {
    const home = read("app/[locale]/page.tsx");
    expect(home).not.toMatch(/rel="preload"/);
    expect(home).not.toMatch(/preconnect\(/);
    const hero = home.slice(home.indexOf('id="hero"'), home.indexOf('id="outcomes"'));
    expect(hero).toContain("<BeforeAfter");
    expect(hero).not.toContain("<JourneyTour");
    expect(home.indexOf("<JourneyTour")).toBeGreaterThan(home.indexOf('id="how"'));
  });

  it("puts the who-is-it-for control above the hero, as one segmented control — not two buttons beside the call to action", () => {
    const home = read("app/[locale]/page.tsx");
    expect(home.indexOf("<SideSwitch")).toBeLessThan(home.indexOf("<PageHero"));
    expect(read("components/SideSwitch.tsx")).toContain("rounded-full");
  });
});

describe("Yomizaka is named first; Orazaka is the engine, named only where it belongs", () => {
  const words = (o: unknown): string[] => (typeof o === "string" ? [o] : o && typeof o === "object" ? Object.values(o).flatMap(words) : []);
  for (const [name, d] of [["en", en], ["fr", fr]] as const) {
    it(`${name}: the hero, the outcomes, the steps and both sides' pitch do not name Orazaka`, () => {
      const pitch = [d.landing.eyebrow, d.landing.title, d.landing.lead, d.landing.outcomes, d.landing.how, d.landing.tour, d.landing.app, d.sides.tenant, d.sides.landlord, d.meta.description, d.chrome.menu.run];
      expect(words(pitch).filter((w) => /orazaka/i.test(w))).toEqual([]);
    });
    it(`${name}: the engine line is one sentence, and the proof section is where the run is named`, () => {
      expect(d.landing.trust.powered).toMatch(/Orazaka/);
      expect(d.run.run).toMatch(/Orazaka/);
      expect(words(d.landing.proof).filter((w) => /orazaka/i.test(w))).toEqual([]); // the engine line is shown under the proof by the section itself
    });
    it(`${name}: the app says Checks, with the engine in small print`, () => {
      expect(d.console.document.checks).not.toMatch(/Orazaka/);
      expect(d.console.document.checksLead).toMatch(/Orazaka/);
    });
  }
  it("the proof section shows the engine line", () => {
    expect(read("components/ProofSection.tsx")).toContain("landing.trust.powered");
  });
});

describe("the proof is read from the recording, never typed", () => {
  it("the hero's finding and the proof's figures are counted from the recorded run", async () => {
    const { recordedRun } = await import("./recorded-runs");
    const run = recordedRun("tenant");
    const hero = read("components/BeforeAfter.tsx");
    expect(hero).toContain("recordedRun(\"tenant\")");
    expect(run.report.findings.find((f) => f.ruleId === "QC-LEASE-004")?.citation).toMatch(/art\. 1904/);
    const proof = read("components/ProofSection.tsx");
    expect(proof).toContain("rulesEvaluated");
    expect(proof).toContain("findings.filter");
  });
});

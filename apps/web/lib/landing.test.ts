import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { HERO_FIGURES, HOME_SECTIONS, productStatus } from "./landing";
import { recordedRun } from "./recorded-runs";
import { PAGES } from "./site";

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("the landing is the product landing template of @krizaka/ui", () => {
  const home = read("app/[locale]/page.tsx");

  it("is a LandingPage: a split hero with the product in its window, a band of figures, a bento, our sections, the closing call", () => {
    expect(home).toContain('from "@krizaka/ui/landing-page"');
    for (const prop of ["eyebrow=", "visual={", "visualLabel=", "proofs={[", "features={[", "closing={{"]) expect(home).toContain(prop);
  });

  it("tells its story in this order", () => {
    expect(HOME_SECTIONS).toEqual(["hero", "features", "audiences", "proof", "app", "comparison", "promise", "faq", "closing"]);
    const marks = ["<LandingPage", "features={[", "<AudienceCards", "<ProofSection", 'id="app"', "<ComparisonSection", 'id="promise"', "<FaqSection", "closing={{"];
    const at = marks.map((m) => home.indexOf(m));
    expect(at.every((i) => i >= 0)).toBe(true);
    // closing is a prop of the template (rendered last); every other section is in reading order.
    const body = at.slice(0, -1);
    expect([...body].sort((a, b) => a - b)).toEqual(body);
  });

  it("uses the family's blocks: DeviceFrame (the phone take), ComparisonTable, MascotQuote (the owl), NumberTicker (real figures), CtaPanel (the closing)", () => {
    expect(read("components/home/AppTake.tsx")).toContain("DeviceFrame");
    expect(read("components/home/ComparisonSection.tsx")).toContain("@krizaka/ui/comparison-table");
    expect(home).toContain("@krizaka/ui/mascot-quote");
    expect(home).toContain("<NumberTicker");
    expect(home).toContain('bird="owl"');
  });

  it("has one primary action in the hero and one in the closing call", () => {
    expect((home.match(/variant="primary"/g) ?? []).length).toBe(2);
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
    expect(home).not.toContain("<ShowcaseRun");
  });
});

describe("the bar", () => {
  it("carries no version chip (the version is in the footer) and groups the product's pages in one menu", () => {
    const bar = read("components/SiteChrome.tsx");
    expect(bar).not.toContain("NavBar.Badge");
    expect(bar).not.toContain("APP_VERSION");
    expect(bar).toContain("NavBar.Menu");
    expect(read("components/SiteFooter.tsx")).toContain("#${APP_VERSION}");
  });

  it("uses the family's language switch (a globe and the current code), in the bar and in the phone panel's preferences — never a pill naming the other language", () => {
    const bar = read("components/SiteChrome.tsx");
    expect(bar).toContain("NavBar.Language");
    expect(bar).toContain("NavBar.MobilePreferences");
    expect(bar).toContain("languagesFor(");
    expect(bar).not.toContain("hrefLang");
    expect(bar).not.toContain("otherLocale");
  });
});

describe("the first screen is light, sharp and clear", () => {
  const home = read("app/[locale]/page.tsx");
  it("the hero's visual is the before/after (HTML, sharp at any width), not a recording; the recorded tour sits below", () => {
    expect(home).not.toMatch(/rel="preload"/);
    expect(home).toContain("visual={<BeforeAfter");
    expect(home.indexOf("<AppTake")).toBeGreaterThan(home.indexOf("<AudienceCards"));
  });

  it("« Pour qui ? » is a chip row in the hero (scrolls with snap on a phone, 44 px targets) and a card per audience below", () => {
    const hero = home.slice(home.indexOf("<LandingPage"), home.indexOf("proofs={["));
    expect(hero).toContain("<AudiencePicker");
    const picker = read("components/home/AudiencePicker.tsx");
    expect(picker).toContain("@krizaka/ui/chip-link");
    expect(picker).toContain("snap-x");
    expect(picker).toContain("min-h-11");
    const cards = read("components/home/AudienceCards.tsx");
    expect(cards).toContain("snap-x");
    expect(cards).toContain("md:grid");
  });
});

describe("Yomizaka is named first; Orazaka is the engine, named only where it belongs", () => {
  const words = (o: unknown): string[] => (typeof o === "string" ? [o] : o && typeof o === "object" ? Object.values(o).flatMap(words) : []);
  for (const [name, d] of [["en", en], ["fr", fr]] as const) {
    it(`${name}: the hero, the features, the audiences, the comparison and both sides' pitch do not name Orazaka`, () => {
      const pitch = [d.landing.eyebrow, d.landing.title, d.landing.lead, d.landing.hero, d.landing.figures, d.landing.features, d.landing.audiences, d.landing.comparison, d.landing.how, d.landing.tour, d.landing.app, d.sides.tenant, d.sides.landlord, d.meta.description, d.chrome.menu.run];
      expect(words(pitch).filter((w) => /orazaka/i.test(w))).toEqual([]);
    });
    it(`${name}: the engine is named in the proof's engine line and in one FAQ answer, nowhere else on the home`, () => {
      expect(d.landing.trust.powered).toMatch(/Orazaka/);
      const faq = Object.entries(d.landing.faq.items).filter(([, v]) => /orazaka/i.test(`${v.q} ${v.a}`)).map(([k]) => k);
      expect(faq).toEqual(["engine"]);
      expect(d.run.run).toMatch(/Orazaka/);
    });
    it(`${name}: the app says Checks, with the engine in small print`, () => {
      expect(d.console.document.checks).not.toMatch(/Orazaka/);
      expect(d.console.document.checksLead).toMatch(/Orazaka/);
    });
    it(`${name}: no page claims « never a model »: a model is consulted for the one judgment rule, and the copy says so`, () => {
      const claims = words([d.sides, d.landing]).filter((w) => /(never|jamais)[^.]{0,40}(model|modèle)|(no|aucun) (model|modèle)/i.test(w));
      // The only places that may say Yomizaka itself calls none are the soon audiences' file examination (deterministic).
      for (const w of claims) expect(w).toMatch(/examin|examine|PDF|file|fichier/i);
    });
  }
  it("the proof section shows the engine line", () => {
    expect(read("components/home/ProofSection.tsx")).toContain("landing.trust.powered");
  });
});

describe("the proof is read from the recording, never typed", () => {
  it("the hero's finding and the band's figures are counted from the recorded run", () => {
    const run = recordedRun("tenant");
    expect(read("components/home/BeforeAfter.tsx")).toContain('recordedRun("tenant")');
    expect(run.report.findings.find((f) => f.ruleId === "QC-LEASE-004")?.citation).toMatch(/art\. 1904/);
    const figures = HERO_FIGURES(run.report);
    expect(figures.rules).toBe(run.report.summary?.rulesEvaluated);
    expect(figures.found).toBe(run.report.findings.length);
    expect(figures.articles).toBeGreaterThan(3);
    expect(read("app/[locale]/page.tsx")).toContain("HERO_FIGURES(run.report)");
  });

  it("counts the distinct articles a finding cites, however the citation lists them", () => {
    expect(HERO_FIGURES({ findings: [{ citation: "C.c.Q., art. 1855 et 1903 ; Règlement, section D" }, { citation: "C.c.Q., art. 1904, al. 1" }, { citation: "C.c.Q., art. 1904, al. 2" }, { citation: null }] })).toEqual({ rules: 4, articles: 3, found: 4 });
  });
});

describe("the responsive guard", () => {
  it("is a script that checks 360, 390, 430, 768, 1024 and 1440 px in both themes, and chips of at least 44 px", () => {
    const script = readFileSync(join(ROOT, "../../scripts/check-overflow.mjs"), "utf8");
    expect(script).toContain("export const WIDTHS = [360, 390, 430, 768, 1024, 1440]");
    expect(script).toContain('["dark", "light"]');
    expect(script).toContain("< 44");
    expect(JSON.parse(readFileSync(join(ROOT, "../../package.json"), "utf8")).scripts["check:overflow"]).toBe("node scripts/check-overflow.mjs");
  });
});

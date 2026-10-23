import { authenticityReport, complianceReport } from "@yomizaka/core";
import { describe, expect, it } from "vitest";

import { generateDocument, PERSONA_ERIC } from "../../../scripts/demo-documents/index.mjs";
import { assertNotProduction, collectionWords, seededReport } from "../../../scripts/demo-seed/seed.mjs";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

describe("the demo seed", () => {
  it("refuses production, and anything that is not dev", () => {
    expect(() => assertNotProduction({ APP_ENVIRONMENT: "prod" })).toThrow(/refused/);
    expect(() => assertNotProduction({ APP_ENVIRONMENT: "staging" })).toThrow(/refused/);
    expect(() => assertNotProduction({ APP_ENVIRONMENT: "dev", DEMO_SEED_ALLOW_PRODUCTION: "1" })).toThrow(/refused/);
  });

  it("works on dev and on a local machine (the default environment is dev)", () => {
    expect(() => assertNotProduction({ APP_ENVIRONMENT: "dev" })).not.toThrow();
    expect(() => assertNotProduction({})).not.toThrow();
  });

  it("names the three collections in French and in English, through the messages", () => {
    for (const messages of [fr, en]) {
      for (const c of PERSONA_ERIC.collections as { key: string }[]) {
        const words = collectionWords(messages, "eric", c.key);
        expect(words.name.length).toBeGreaterThan(0);
        expect(words.description?.length ?? 0).toBeLessThanOrEqual(500);
      }
    }
    expect(collectionWords(fr, "eric", "rosemont").name).toBe("Immeuble Rosemont");
    expect(collectionWords(fr, "eric", "villeray").name).toBe("Candidats — 4½ Villeray");
    expect(collectionWords(fr, "eric", "invoices").name).toBe("Factures 2026");
    expect(() => collectionWords(fr, "eric", "nope")).toThrow();
  });

  it("seeds checks the app reads like Orazaka's, each flawed document with its blocking finding", async () => {
    for (const id of PERSONA_ERIC.checked as string[]) {
      const doc = await generateDocument(id);
      const report = seededReport(doc);
      const parsed = doc.family === "lease" ? complianceReport.safeParse(report) : authenticityReport.safeParse(report);
      expect(parsed.success, id).toBe(true);
      const flagged = "findings" in report ? report.findings?.some((f: { verdict: string }) => f.verdict === "FAIL") : report.signals?.some((s: { level: string }) => s.level === "incohérent");
      expect(flagged, id).toBe(doc.flaw !== null);
    }
  });
});

import { describe, expect, it } from "vitest";

import { amountsOnce, displayTitle, orderFindings, severityOf, verdictOf } from "./document-face";

const finding = (ruleId: string, verdict: "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE", severity = "BLOCKING") => ({ ruleId, severity, verdict, explanation: "", evidenceSpan: null });
const insight = (confidence: "high" | "medium" | "low" | "unknown", parties: { role: string; name: string }[] = [], issuer: string | null = null) => ({
  understanding: { nature: { id: "lease", label: { fr: "Bail de logement", en: "Residential lease" }, confidence, score: 0.9 }, parties, issuer },
});

describe("the document's face (the UX review's Y5)", () => {
  it("names the document by what it is and who it is with — the tenant before the landlord — and keeps the filename out of the title", () => {
    const parties = [{ role: "landlord", name: "Mathis Imaginaire-Roy" }, { role: "tenant", name: "Camille Fictif-Beaulieu" }];
    expect(displayTitle({ title: "page", insight: insight("high", parties) }, "fr")).toBe("Bail de logement — Camille Fictif-Beaulieu");
    expect(displayTitle({ title: "page", insight: insight("medium", parties) }, "en")).toBe("Residential lease — Camille Fictif-Beaulieu");
    expect(displayTitle({ title: "facture", insight: insight("high", [], "Plomberie Roy inc.") }, "fr")).toBe("Bail de logement — Plomberie Roy inc.");
    expect(displayTitle({ title: "page", insight: insight("high") }, "fr")).toBe("Bail de logement");
  });

  it("falls back on the stored title when nothing is known for sure", () => {
    expect(displayTitle({ title: "page", insight: insight("low", [{ role: "tenant", name: "X" }]) }, "fr")).toBe("page");
    expect(displayTitle({ title: "page", insight: null }, "fr")).toBe("page");
    expect(displayTitle({ title: "page" }, "fr")).toBe("page");
    expect(displayTitle({ title: "page", insight: insight("high", [{ role: "tenant", name: "N".repeat(200) }]) }, "fr")).toHaveLength(120);
  });

  it("the verdict is the report's: the rules read, the points to look at, how many block — and its tone", () => {
    const report = { findings: [finding("A", "FAIL"), finding("B", "FAIL", "MAJOR"), finding("C", "INSUFFICIENT_EVIDENCE", "INFO"), finding("D", "PASS"), finding("E", "PASS")], summary: { byVerdict: {}, blockingFailures: 1, rulesEvaluated: 10 } };
    expect(verdictOf(report)).toEqual({ rules: 10, attention: 3, blocking: 1, unsure: 1, passed: 2, tone: "danger" });
    expect(verdictOf({ findings: [finding("B", "FAIL", "MAJOR"), finding("D", "PASS")], }).tone).toBe("warning");
    expect(verdictOf({ findings: [finding("C", "INSUFFICIENT_EVIDENCE", "INFO")], })).toMatchObject({ rules: 1, attention: 1, blocking: 0, tone: "warning" });
    expect(verdictOf({ findings: [finding("D", "PASS"), finding("E", "PASS")], })).toMatchObject({ rules: 2, attention: 0, passed: 2, tone: "success" });
  });

  it("orders what failed first — blocking before major — then what could not be checked, and folds what passed", () => {
    const { attention, passed } = orderFindings([finding("P1", "PASS"), finding("U", "INSUFFICIENT_EVIDENCE", "INFO"), finding("M", "FAIL", "MAJOR"), finding("B", "FAIL", "BLOCKING"), finding("P2", "PASS"), finding("B2", "FAIL", "BLOCKING")]);
    expect(attention.map((f) => f.ruleId)).toEqual(["B", "B2", "M", "U"]);
    expect(passed.map((f) => f.ruleId)).toEqual(["P1", "P2"]);
  });

  it("says a severity in words and tone, and shows each kind of amount once", () => {
    expect(severityOf("BLOCKING")).toEqual({ word: "blocking", tone: "danger" });
    expect(severityOf("MAJOR")).toEqual({ word: "major", tone: "warning" });
    expect(severityOf("INFO")).toEqual({ word: "advice", tone: "neutral" });
    expect(amountsOnce([{ kind: "rent", cents: 145000 }, { kind: "rent", cents: 145000 }, { kind: "deposit", cents: 145000 }]).map((a) => a.kind)).toEqual(["rent", "deposit"]);
  });
});

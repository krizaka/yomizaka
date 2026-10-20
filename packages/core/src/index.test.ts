import { describe, expect, it } from "vitest";

import { complianceReport, fromRunStatus, isTerminal, passages, queryKeys, reportOf, startAnalysis } from "./index";

// A report exactly as the compliance Studio assembles it (orazaka-packs document-validation worker, `_assemble`).
const COMPLIANCE = {
  report: {
    rulesetId: "fr-residential-lease",
    rulesetVersion: "2026-07-01",
    rulesetRevision: 1,
    jurisdiction: "FR",
    asOf: "2026-10-14",
    source: "Loi n° 89-462 du 6 juillet 1989",
    summary: { byVerdict: { PASS: 5, FAIL: 4, INSUFFICIENT_EVIDENCE: 1 }, blockingFailures: 4, rulesEvaluated: 10 },
    findings: [
      {
        ruleId: "FR-LEASE-005",
        title: "Dépôt de garantie plafonné à un mois de loyer hors charges",
        severity: "BLOCKING",
        verdict: "FAIL",
        evidenceSpan: { start: 160, end: 187, quote: "Dépôt de garantie : 2 550 €" },
        explanation: "Le dépôt de garantie excède un mois de loyer hors charges.",
        method: "DETERMINISTIC",
        citation: "Loi 89-462, art. 22",
      },
      { ruleId: "FR-LEASE-008", severity: "BLOCKING", verdict: "FAIL", evidenceSpan: null, explanation: "Aucun DPE annexé." },
    ],
  },
};

describe("Orazaka runs", () => {
  it("maps Orazaka's run statuses, an unknown one stays running (asked again)", () => {
    expect(fromRunStatus("SUCCEEDED")).toBe("succeeded");
    expect(fromRunStatus("FAILED")).toBe("failed");
    expect(fromRunStatus("CANCELLED")).toBe("cancelled");
    expect(fromRunStatus("RUNNING")).toBe("running");
    expect(fromRunStatus("COMPENSATING")).toBe("running");
    expect(isTerminal("running")).toBe(false);
    expect(isTerminal("failed")).toBe(true);
  });

  it("reads the compliance report from the run's `report` output, wrapped or bare", () => {
    const wrapped = reportOf("compliance-check", [{ key: "report", type: "JSON", value: JSON.stringify(COMPLIANCE) }]);
    expect(complianceReport.parse(wrapped).findings).toHaveLength(2);
    const bare = reportOf("compliance-check", [{ key: "report", type: "JSON", value: JSON.stringify(COMPLIANCE.report) }]);
    expect(bare).toEqual(wrapped);
  });

  it("reads the authenticity signals from the run's `signals` output", () => {
    const report = { header: "Ce rapport n'est pas une expertise.", pages: 3, signals: [{ signalId: "PDF-META-002", level: "incohérent", observation: "Le producteur déclaré ne correspond pas." }] };
    const read = reportOf("document-authenticity", [
      { key: "report", type: "TEXT", value: "Points à éclaircir…" },
      { key: "signals", type: "JSON", value: JSON.stringify(report) },
    ]);
    expect(read && "signals" in read ? read.signals[0]?.level : null).toBe("incohérent");
  });

  it("never guesses: a missing, broken or foreign output is null", () => {
    expect(reportOf("compliance-check", [])).toBeNull();
    expect(reportOf("compliance-check", [{ key: "report", type: "JSON", value: "{not json" }])).toBeNull();
    expect(reportOf("document-authenticity", [{ key: "signals", type: "JSON", value: JSON.stringify({ nope: true }) }])).toBeNull();
  });
});

describe("the API's requests", () => {
  it("asks a jurisdiction for a compliance check, a date in ISO form", () => {
    expect(startAnalysis.parse({ studio: "compliance-check", jurisdiction: "FR" })).toEqual({ studio: "compliance-check", jurisdiction: "FR" });
    expect(startAnalysis.parse({ studio: "compliance-check", jurisdiction: "QC" })).toEqual({ studio: "compliance-check", jurisdiction: "QC" });
    expect(() => startAnalysis.parse({ studio: "compliance-check", jurisdiction: "ON" })).toThrow();
    expect(() => startAnalysis.parse({ studio: "compliance-check", jurisdiction: "FR", asOf: "14/10/2026" })).toThrow();
    expect(startAnalysis.parse({ studio: "document-authenticity", expectedIssuer: "  Agence Dupont " })).toEqual({ studio: "document-authenticity", expectedIssuer: "Agence Dupont" });
    expect(() => startAnalysis.parse({ studio: "summarise" })).toThrow();
  });

  it("names the Québec invoice rules as a ruleset, for Québec only", () => {
    expect(startAnalysis.parse({ studio: "compliance-check", jurisdiction: "QC", ruleset: "qc-invoice" })).toEqual({ studio: "compliance-check", jurisdiction: "QC", ruleset: "qc-invoice" });
    expect(() => startAnalysis.parse({ studio: "compliance-check", jurisdiction: "FR", ruleset: "qc-invoice" })).toThrow();
    expect(() => startAnalysis.parse({ studio: "compliance-check", jurisdiction: "QC", ruleset: "anything" })).toThrow();
    expect(startAnalysis.parse({ studio: "compliance-check", jurisdiction: "QC", ruleset: "qc-service-contract" })).toMatchObject({ ruleset: "qc-service-contract" });
    expect(() => startAnalysis.parse({ studio: "compliance-check", jurisdiction: "FR", ruleset: "qc-service-contract" })).toThrow();
  });

  it("keys the queries so one invalidation reaches every list", () => {
    expect(queryKeys.document("d1").slice(0, 1)).toEqual(queryKeys.documents());
  });
});

describe("passages", () => {
  const text = "Loyer mensuel : 850 €. Dépôt de garantie : 2 550 €. Fin.";
  it("marks each quoted passage where it sits, by offsets or by its first occurrence", () => {
    const parts = passages(text, [{ id: "FR-LEASE-005", quote: "Dépôt de garantie : 2 550 €" }]);
    expect(parts.map((p) => p.mark ?? "")).toEqual(["", "FR-LEASE-005", ""]);
    expect(parts.map((p) => p.text).join("")).toBe(text);
  });
  it("leaves out a quote the text does not hold, and overlaps", () => {
    const parts = passages(text, [
      { id: "a", quote: "nowhere" },
      { id: "b", quote: "Loyer mensuel", start: 0 },
      { id: "c", quote: "mensuel : 850" },
    ]);
    expect(parts.filter((p) => p.mark).map((p) => p.mark)).toEqual(["b"]);
    expect(parts.map((p) => p.text).join("")).toBe(text);
  });
  it("returns the whole text when nothing is quoted", () => {
    expect(passages("abc", [])).toEqual([{ text: "abc" }]);
    expect(passages("", [])).toEqual([{ text: "" }]);
  });
});

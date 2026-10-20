import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PERSPECTIVES } from "@yomizaka/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import landlordFile from "@/content/recorded-runs/landlord.json";
import tenantFile from "@/content/recorded-runs/tenant.json";

import { ShowcaseRun, summaryLine } from "../components/ShowcaseRun";
import { contractRun, INVOICE_SIDES, invoiceRun, readRecording, recordedRun, RecordedRunError, recordedRuns } from "./recorded-runs";

const ROOT = join(__dirname, "..");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("« A real run » — a recorded run per side of the lease, or the page does not build", () => {
  it("has one recorded run for each side, a real Orazaka run with its id and Studio version", () => {
    expect(recordedRuns().map((r) => r.side)).toEqual([...PERSPECTIVES]);
    for (const r of recordedRuns()) {
      expect(r.runId).toMatch(UUID);
      expect(r.studioVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(r.report.jurisdiction).toBe("QC");
      expect(r.report.findings.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(r.recordedAt))).toBe(false);
    }
    expect(recordedRun("tenant").runId).not.toBe(recordedRun("landlord").runId);
  });

  it("keeps what Orazaka returned, verbatim: the file holds the run as returned and the page reads its findings", () => {
    for (const [side, file] of [["tenant", tenantFile], ["landlord", landlordFile]] as const) {
      expect(file.run.status).toBe("SUCCEEDED");
      expect(file.run.id).toBe(recordedRun(side).runId);
      const report = JSON.parse(file.run.outputs.find((o) => o.key === "report")!.value) as { findings: unknown[] };
      expect(recordedRun(side).report.findings).toHaveLength(report.findings.length);
    }
  });

  it("holds no secret", () => {
    for (const side of PERSPECTIVES) expect(readFileSync(join(ROOT, `content/recorded-runs/${side}.json`), "utf8")).not.toMatch(/oz_[A-Za-z0-9]|Bearer |password/i);
  });

  it("fails — a build error, not a blank page — when a recording is missing, unfinished or has no report", () => {
    expect(() => readRecording("tenant", null)).toThrow(RecordedRunError);
    expect(() => readRecording("tenant", { ...tenantFile, side: "landlord" })).toThrow(RecordedRunError);
    expect(() => readRecording("tenant", { ...tenantFile, run: { ...tenantFile.run, status: "FAILED" } })).toThrow(/did not return a finished run/);
    expect(() => readRecording("tenant", { ...tenantFile, run: { ...tenantFile.run, outputs: [] } })).toThrow(/holds no compliance report/);
  });

  it("the page imports the recordings, so a page without one cannot be built", () => {
    const page = readFileSync(join(ROOT, "app/[locale]/run/page.tsx"), "utf8");
    expect(page).toContain('from "@/lib/recorded-runs"');
    expect(page).toContain("recordedRun(side)");
    expect(page).not.toContain("getShowcaseView");
  });

  it("renders each side's run: the run id, the counted summary, an unsigned specimen", () => {
    for (const r of recordedRuns()) {
      const html = renderToStaticMarkup(createElement(ShowcaseRun, { run: r, locale: "fr" }));
      expect(html).toContain(r.runId);
      expect(html).toContain(summaryLine(r.report.findings, { summary: "{total} contrôles · {fail} non conformes · {pass} conformes", insufficient: "" }));
      expect(html).toContain("SPÉCIMEN — document fictif, sans valeur");
      expect(html).not.toMatch(/download|report\?lang|\/verify/);
    }
  });

  it("the two sides are two different leases with two different results", () => {
    const [t, l] = [recordedRun("tenant"), recordedRun("landlord")];
    expect(t.document.sha256).not.toBe(l.document.sha256);
    expect(t.report.findings.filter((f) => f.verdict === "FAIL").length).toBeGreaterThan(0);
    expect(l.report.findings.filter((f) => f.verdict === "FAIL").length).toBeGreaterThan(0);
  });

  it("was recorded with the corrected ruleset (revision 2, ten rules): the amountless deposit of the landlord's template is caught, the waiver rule ran", () => {
    for (const side of PERSPECTIVES) {
      const r = recordedRun(side);
      expect(r.report.rulesetRevision).toBe(2);
      expect(r.report.findings.map((f) => f.ruleId)).toContain("QC-LEASE-009");
      expect(r.report.summary?.rulesEvaluated).toBe(10);
    }
    expect(recordedRun("landlord").document.text).toMatch(/dépôt de garantie équivalant à un mois de loyer/);
    expect(recordedRun("landlord").report.findings.find((f) => f.ruleId === "QC-LEASE-004")?.verdict).toBe("FAIL");
  });
});

describe("the Québec invoice, recorded for the freelancer and the business", () => {
  it("is a real run of the qc-invoice ruleset, Studio 1.3.0 or later, with every rule answered", () => {
    for (const side of INVOICE_SIDES) {
      const r = invoiceRun(side);
      expect(r.runId).toMatch(UUID);
      expect(r.studioVersion).toMatch(/^1\.(?:[3-9]|\d{2,})\.\d+$/);
      expect(r.report.rulesetId).toBe("qc-invoice");
      expect(r.report.findings.map((f) => f.ruleId)).toEqual(expect.arrayContaining(["QC-INV-001", "QC-INV-002", "QC-INV-003", "QC-INV-007", "QC-INV-008"]));
      expect(r.report.findings.some((f) => f.verdict === "FAIL")).toBe(true);
      expect(readFileSync(join(ROOT, `content/recorded-runs/${side}.json`), "utf8")).not.toMatch(/oz_[A-Za-z0-9]|Bearer |password/i);
    }
    expect(invoiceRun("freelancer").runId).not.toBe(invoiceRun("business").runId);
  });
  it("is shown on the audience's own page and on /run, from the recording", () => {
    const side = readFileSync(join(ROOT, "app/[locale]/[side]/page.tsx"), "utf8");
    expect(side).toContain("invoiceRun(side)");
    expect(side).toContain("<ShowcaseRun");
    expect(readFileSync(join(ROOT, "app/[locale]/run/page.tsx"), "utf8")).toContain("INVOICE_SIDES");
  });
});

describe("the freelancer's service contract, recorded", () => {
  it("is a real run of qc-service-contract (Studio 1.4.0+) whose findings cite the federal texts it was written from", () => {
    const r = contractRun();
    expect(r.runId).toMatch(UUID);
    expect(r.studioVersion).toMatch(/^1\.(?:[4-9]|\d{2,})\.\d+$/);
    expect(r.report.rulesetId).toBe("qc-service-contract");
    expect(r.report.findings.map((f) => f.ruleId)).toEqual(["QC-SVC-001", "QC-SVC-002", "QC-SVC-003", "QC-SVC-004"]);
    expect(r.report.findings.some((f) => f.verdict === "FAIL")).toBe(true);
    expect(r.report.findings.every((f) => /Loi sur (?:l'intérêt|le droit d'auteur)/.test(f.citation ?? ""))).toBe(true);
    expect(readFileSync(join(ROOT, "content/recorded-runs/contract.json"), "utf8")).not.toMatch(/oz_[A-Za-z0-9]|Bearer |password/i);
  });
  it("is shown on the freelancer's page and on /run", () => {
    expect(readFileSync(join(ROOT, "app/[locale]/[side]/page.tsx"), "utf8")).toContain("contractRun()");
    expect(readFileSync(join(ROOT, "app/[locale]/run/page.tsx"), "utf8")).toContain("contractRun()");
  });
});

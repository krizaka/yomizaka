import type { OwnerDocument } from "./owner-report";
import type { RecordedRun } from "./recorded-runs";
import type { ScreeningResult } from "./screening";

/** The home's screening card: fictitious (a demonstration provider), the registry check not available yet — said, never guessed. */
export const DEMO_SCREENING: ScreeningResult = {
  band: "no-concern",
  items: [
    { key: "payment-history", outcome: "clear" },
    { key: "credit", outcome: "clear" },
    { key: "registry", outcome: "soon" },
  ],
  provider: "demo",
  generatedAt: "2026-10-27T12:00:00.000Z",
};

/** The home's owner card: the recorded tenant run, shaped as the owner's page shows a document (its fingerprint, its failed findings, its run). */
export function demoOwnerDocument(run: Pick<RecordedRun, "document" | "report" | "runId" | "studioVersion" | "finishedAt">): OwnerDocument {
  return {
    typeId: "lease",
    sha256: run.document.sha256,
    pages: null,
    signals: [],
    findings: run.report.findings.filter((f) => f.verdict !== "PASS").slice(0, 2).map((f) => ({ ruleId: f.ruleId, verdict: f.verdict, severity: f.severity, citation: f.citation ?? null })),
    notExamined: [],
    runs: [{ studio: "compliance-check", runId: run.runId, studioVersion: run.studioVersion, finishedAt: run.finishedAt }],
  };
}

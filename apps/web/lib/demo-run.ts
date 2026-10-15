import type { ComplianceReport } from "@yomizaka/core";

/**
 * The real run the public page shows (« A real run »): recorded from dev.orazaka.com by `scripts/record-demo.mjs` — a
 * sample lease sent to Orazaka's compliance Studio, the run id and the report exactly as they came back. `null` until
 * it has run: the page then says so instead of showing an invented result.
 */
export interface DemoRun {
  runId: string;
  studio: "compliance-check";
  blueprintVersion: string | null;
  finishedAt: string;
  document: string;
  report: ComplianceReport;
}

export const DEMO_RUN: DemoRun | null = null;

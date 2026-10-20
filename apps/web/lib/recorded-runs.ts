import { type Analysis, type ComplianceReport, orazakaRun, type Perspective, PERSPECTIVES, reportOf } from "@yomizaka/core";

import business from "@/content/recorded-runs/business.json";
import contract from "@/content/recorded-runs/contract.json";
import freelancer from "@/content/recorded-runs/freelancer.json";
import landlord from "@/content/recorded-runs/landlord.json";
import tenant from "@/content/recorded-runs/tenant.json";

import { type buildPayload, sha256 } from "./report";
import type { Showcase } from "./showcase";

/**
 * « A real run », one per side of the lease: a sample lease sent to Orazaka's compliance Studio (the Québec ruleset) on
 * dev, and the answer kept exactly as Orazaka returned it (`content/recorded-runs/<side>.json`, written by
 * `scripts/record-runs.mjs` — never by hand). The page is built from these files, so a page without a recorded run does
 * not build: this module throws when one is missing or unreadable, and `/run` imports it.
 */
export class RecordedRunError extends Error {}

/** Orazaka's status of a finished, successful run. */
const RUN_SUCCEEDED = "SUCCEEDED";

const FILES: Record<Perspective, unknown> = { tenant, landlord };

/** The Québec invoice check, recorded for the two audiences that have it: a freelancer's own invoice, a supplier's invoice received. */
export const INVOICE_SIDES = ["freelancer", "business"] as const;
export type InvoiceSide = (typeof INVOICE_SIDES)[number];
const INVOICE_FILES: Record<InvoiceSide, unknown> = { freelancer, business };

/** What a recording says — never a signed file: a sample is a visual specimen (ADR-0002). */
export interface RecordedRun extends Showcase {
  side: Perspective | InvoiceSide | "contract";
  recordedAt: string;
  source: string;
}

export function readRecording(side: Perspective | InvoiceSide | "contract", raw: unknown): { run: RecordedRun; analysis: Analysis; document: Parameters<typeof buildPayload>[0] } {
  const fail = (why: string) => new RecordedRunError(`recorded run "${side}": ${why} — record it with scripts/record-runs.mjs`);
  const file = raw as { side?: string; recordedAt?: string; source?: string; studio?: string; document?: { title: string; filename: string; text: string }; inputs?: unknown; run?: unknown } | null;
  if (!file || file.side !== side || file.studio !== "compliance-check" || !file.document?.text || !file.recordedAt) throw fail("the file is not a recording");
  const parsed = orazakaRun.safeParse(file.run);
  if (!parsed.success || parsed.data.status !== RUN_SUCCEEDED || !parsed.data.finishedAt) throw fail("Orazaka did not return a finished run");
  const run = parsed.data;
  const finishedAt = run.finishedAt!; // checked just above
  const report = reportOf("compliance-check", run.outputs) as ComplianceReport | null;
  if (!report || !("findings" in report) || report.findings.length === 0) throw fail("Orazaka's answer holds no compliance report");
  const bytes = new TextEncoder().encode(file.document.text);
  const document = { sha256: sha256(bytes), filename: file.document.filename, title: file.document.title, sizeBytes: bytes.length, pages: null };
  const analysis: Analysis = {
    id: `recorded-${side}`,
    studio: "compliance-check",
    status: "succeeded",
    runId: run.id,
    blueprintVersion: run.blueprintVersion ?? null,
    inputs: {},
    report,
    error: null,
    createdAt: run.startedAt ?? finishedAt,
    finishedAt,
  };
  return {
    run: {
      side,
      recordedAt: file.recordedAt,
      source: file.source ?? "",
      analysisId: analysis.id,
      runId: run.id,
      studioVersion: run.blueprintVersion ?? null,
      finishedAt,
      document: { title: document.title, filename: document.filename, sha256: document.sha256, pages: null, text: file.document.text, mimeType: "text/plain" },
      report,
    },
    analysis,
    document,
  };
}

/** Both recorded runs, validated now (at module load: a missing or broken recording fails the build, not the visitor). */
const ALL = Object.fromEntries(PERSPECTIVES.map((side) => [side, readRecording(side, FILES[side])])) as Record<Perspective, ReturnType<typeof readRecording>>;

export const recordedRun = (side: Perspective): RecordedRun => ALL[side].run;
export const recordedRuns = (): RecordedRun[] => PERSPECTIVES.map(recordedRun);

/** The invoice recordings, validated at module load like the lease ones: a page without its run does not build. */
const INVOICES = Object.fromEntries(INVOICE_SIDES.map((side) => [side, readRecording(side, INVOICE_FILES[side])])) as Record<InvoiceSide, ReturnType<typeof readRecording>>;

export const invoiceRun = (side: InvoiceSide): RecordedRun => INVOICES[side].run;

/** The freelancer's service contract (pack 1.4.0, federal law only): recorded like the invoices. */
const CONTRACT = readRecording("contract", contract);
export const contractRun = (): RecordedRun => CONTRACT.run;

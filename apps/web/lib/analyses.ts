import { type Analysis, AUTHENTICITY_MAX_BYTES, COMPLIANCE_MAX_CHARS, fromRunStatus, isTerminal, type OrazakaRun, reportOf, type StartAnalysis } from "@yomizaka/core";

import { query } from "./db";
import { type AnalysisRow, isUuid, needsAttention, toAnalysis } from "./documents";
import { refuse } from "./http";
import { orazaka } from "./orazaka";

/**
 * An analysis is an Orazaka run. Starting one sends the document to the Studio that does the job — the compliance
 * check reads the text against a jurisdiction's rules, the authenticity check reads the PDF file itself — and keeps the
 * run id. Reading one asks Orazaka for the run until it is finished, then keeps the report Orazaka returned (and the
 * words a search should find in it). Yomizaka adds no verdict of its own.
 */
export function runInputs(request: StartAnalysis, doc: { mimeType: string; text: string; content: Buffer }, today = new Date()): Record<string, string> {
  if (request.studio === "compliance-check") {
    if (!doc.text.trim()) throw refuse(422, "NO_TEXT", "This document has no text layer to check");
    if (doc.text.length > COMPLIANCE_MAX_CHARS) throw refuse(422, "TEXT_TOO_LONG", "This document is longer than the compliance check reads");
    return { document: doc.text, jurisdiction: request.jurisdiction, asOf: request.asOf ?? today.toISOString().slice(0, 10) };
  }
  if (doc.mimeType !== "application/pdf") throw refuse(422, "NOT_A_PDF", "The authenticity check reads PDF files");
  if (doc.content.length > AUTHENTICITY_MAX_BYTES) throw refuse(422, "PDF_TOO_LARGE", "The authenticity check reads PDFs up to 1 MB");
  return { documentBase64: doc.content.toString("base64"), ...(request.expectedIssuer ? { expectedIssuer: request.expectedIssuer } : {}) };
}

/** The words a search should find in a report: rule titles, explanations, quoted passages, citations, signals. */
export function searchText(report: ReturnType<typeof reportOf>): string {
  if (!report) return "";
  if ("findings" in report) return report.findings.flatMap((f) => [f.ruleId, f.title ?? "", f.explanation, f.evidenceSpan?.quote ?? "", f.citation ?? ""]).join("\n");
  return report.signals.flatMap((s) => [s.signalId, s.observation, s.mayIndicate ?? "", s.where ?? ""]).join("\n");
}

export async function startAnalysis(ownerId: string, documentId: string, request: StartAnalysis): Promise<Analysis> {
  if (!isUuid(documentId)) throw refuse(404, "NOT_FOUND", "No such document");
  const [doc] = await query<{ mime_type: string; text: string; content: Buffer }>("SELECT mime_type, text, content FROM documents WHERE owner_id = $1 AND id = $2", [ownerId, documentId]);
  if (!doc) throw refuse(404, "NOT_FOUND", "No such document");
  const [running] = await query("SELECT id FROM analyses WHERE document_id = $1 AND studio = $2 AND status = 'running'", [documentId, request.studio]);
  if (running) throw refuse(409, "ALREADY_RUNNING", "This check is already running");
  const inputs = runInputs(request, { mimeType: doc.mime_type, text: doc.text, content: doc.content });
  const run = await orazaka().startRun(request.studio, inputs);
  const kept = Object.fromEntries(Object.entries(inputs).filter(([k]) => k !== "document" && k !== "documentBase64"));
  const [row] = await query<AnalysisRow>(
    "INSERT INTO analyses (document_id, studio, status, run_id, blueprint_version, inputs) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [documentId, request.studio, fromRunStatus(run.status), run.id, run.blueprintVersion ?? null, JSON.stringify(kept)],
  );
  return isTerminal(row!.status) ? refresh(row!, run) : toAnalysis(row!);
}

/** Brings an analysis up to date with its Orazaka run (only while it runs; a finished one is kept as it was). */
export async function refresh(row: AnalysisRow, known?: OrazakaRun): Promise<Analysis> {
  if (row.status !== "running" && !known) return toAnalysis(row);
  if (!row.run_id) return toAnalysis(row);
  const run = known ?? (await orazaka().getRun(row.run_id));
  const status = fromRunStatus(run.status);
  if (!isTerminal(status)) return toAnalysis(row);
  const report = status === "succeeded" ? reportOf(row.studio, run.outputs) : null;
  const error = status === "succeeded" ? (report ? null : "Orazaka finished without a report Yomizaka can read") : (run.errorMessage ?? `The run ended ${run.status}`);
  const [updated] = await query<AnalysisRow>(
    `UPDATE analyses SET status = $2, report = $3, error = $4, search_text = $5, blueprint_version = coalesce($6, blueprint_version), finished_at = coalesce($7::timestamptz, now())
      WHERE id = $1 RETURNING *`,
    [row.id, report ? status : "failed", report ? JSON.stringify({ ...report, attention: needsAttention(report) }) : null, error, searchText(report), run.blueprintVersion ?? null, run.finishedAt ?? null],
  );
  return toAnalysis(updated!);
}

export async function getAnalysis(ownerId: string, documentId: string, analysisId: string): Promise<Analysis> {
  if (!isUuid(documentId) || !isUuid(analysisId)) throw refuse(404, "NOT_FOUND", "No such analysis");
  const [row] = await query<AnalysisRow>(
    "SELECT a.* FROM analyses a JOIN documents d ON d.id = a.document_id WHERE d.owner_id = $1 AND a.document_id = $2 AND a.id = $3",
    [ownerId, documentId, analysisId],
  );
  if (!row) throw refuse(404, "NOT_FOUND", "No such analysis");
  return refresh(row);
}

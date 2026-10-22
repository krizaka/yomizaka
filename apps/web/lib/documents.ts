import { type Analysis, type AnalysisStatus, type AuthenticityReport, type ComplianceReport, type DocumentDetail, type DocumentInsight, type DocumentKind, type DocumentStatus, type DocumentSummary, type Studio } from "@yomizaka/core";

import { query } from "./db";
import { refuse } from "./http";
import { readText } from "./pdf-text";
import { personalInfo } from "./pii";
import { createInspector } from "./preflight/inspector";
import { OUTCOME, type RejectReason } from "./preflight/port";
import { YOMIZAKA_RULES } from "./preflight/rules";
import { understanding } from "./understanding";

interface DocumentRow {
  id: string;
  title: string;
  filename: string;
  mime_type: "application/pdf" | "text/plain";
  kind: DocumentKind;
  size_bytes: number;
  pages: number | null;
  has_text: boolean;
  created_at: Date;
  statuses: { studio: Studio; status: AnalysisStatus; attention: boolean }[] | null;
}

export interface AnalysisRow {
  id: string;
  studio: Studio;
  status: AnalysisStatus;
  run_id: string | null;
  blueprint_version: string | null;
  inputs: Record<string, string>;
  report: ComplianceReport | AuthenticityReport | null;
  error: string | null;
  created_at: Date;
  finished_at: Date | null;
}

/** Whether a report asks for attention: a failed blocking rule, or a signal Orazaka calls incoherent. */
export function needsAttention(report: ComplianceReport | AuthenticityReport | null): boolean {
  if (!report) return false;
  if ("findings" in report) return report.findings.some((f) => f.verdict === "FAIL" && f.severity === "BLOCKING");
  return report.signals.some((s) => s.level === "incohérent");
}

/** A document's state from its latest analysis per Studio. */
export function documentStatus(latest: { status: AnalysisStatus; attention: boolean }[]): DocumentStatus {
  if (latest.length === 0) return "stored";
  if (latest.some((a) => a.status === "running")) return "analysing";
  if (latest.some((a) => a.status === "succeeded" && a.attention)) return "attention";
  if (latest.every((a) => a.status !== "succeeded")) return "failed";
  return "checked";
}

const SUMMARY_COLUMNS = `d.id, d.title, d.filename, d.mime_type, d.kind, d.size_bytes, d.pages, d.text <> '' AS has_text, d.created_at,
  (SELECT json_agg(json_build_object('studio', l.studio, 'status', l.status, 'attention', l.attention))
     FROM (SELECT DISTINCT ON (a.studio) a.studio, a.status, coalesce((a.report->>'attention')::boolean, false) AS attention
             FROM analyses a WHERE a.document_id = d.id ORDER BY a.studio, a.created_at DESC) l) AS statuses`;

function summary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    title: row.title,
    filename: row.filename,
    mimeType: row.mime_type,
    kind: row.kind,
    sizeBytes: row.size_bytes,
    pages: row.pages,
    hasText: row.has_text,
    status: documentStatus(row.statuses ?? []),
    createdAt: row.created_at.toISOString(),
  };
}

export function toAnalysis(row: AnalysisRow): Analysis {
  const report = { ...((row.report ?? {}) as Record<string, unknown>) };
  delete report.attention;
  return {
    id: row.id,
    studio: row.studio,
    status: row.status,
    runId: row.run_id,
    blueprintVersion: row.blueprint_version,
    inputs: Object.fromEntries(Object.entries(row.inputs ?? {}).filter(([k]) => k !== "documentBase64" && k !== "document")),
    report: row.report ? (report as unknown as Analysis["report"]) : null,
    error: row.error,
    createdAt: row.created_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
  };
}

export async function listDocuments(ownerId: string): Promise<DocumentSummary[]> {
  const rows = await query<DocumentRow>(`SELECT ${SUMMARY_COLUMNS} FROM documents d WHERE d.owner_id = $1 ORDER BY d.created_at DESC LIMIT 500`, [ownerId]);
  return rows.map(summary);
}

export async function getDocument(ownerId: string, id: string): Promise<DocumentDetail> {
  if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such document");
  const [row] = await query<DocumentRow & { sha256: string; text: string }>(`SELECT ${SUMMARY_COLUMNS}, d.sha256, d.text FROM documents d WHERE d.owner_id = $1 AND d.id = $2`, [ownerId, id]);
  if (!row) throw refuse(404, "NOT_FOUND", "No such document");
  const analyses = await query<AnalysisRow>("SELECT * FROM analyses WHERE document_id = $1 ORDER BY created_at DESC LIMIT 50", [id]);
  return { ...summary(row), sha256: row.sha256, text: row.text, insight: insightOf(row.text, row.pages), analyses: analyses.map(toAnalysis) };
}

export async function getFile(ownerId: string, id: string): Promise<{ filename: string; mimeType: string; content: Buffer }> {
  if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such document");
  const [row] = await query<{ filename: string; mime_type: string; content: Buffer }>("SELECT filename, mime_type, content FROM documents WHERE owner_id = $1 AND id = $2", [ownerId, id]);
  if (!row) throw refuse(404, "NOT_FOUND", "No such document");
  return { filename: row.filename, mimeType: row.mime_type, content: row.content };
}

export async function deleteDocument(ownerId: string, id: string): Promise<void> {
  if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such document");
  const rows = await query("DELETE FROM documents WHERE owner_id = $1 AND id = $2 RETURNING id", [ownerId, id]);
  if (rows.length === 0) throw refuse(404, "NOT_FOUND", "No such document");
}

/** What the document is and holds — read in-process from its text, for nothing; personal information as counts only. */
export function insightOf(text: string, pages: number | null): DocumentInsight {
  const { total, counts } = personalInfo.scan(text);
  return { understanding: understanding.understand(text, { pages }), pii: { total, counts: counts as Record<string, number> } };
}

/** The upload form's « automatic » choice: the document kind follows the detected nature (never a default that is wrong). */
export function kindFromNature(natureId: string | null): DocumentKind {
  return natureId === "residential-lease" ? "lease" : natureId === "invoice" ? "invoice" : natureId === "service-contract" ? "contract" : "other";
}

/** Why a file is refused: the HTTP answer and the stable code the page translates (messages `console.errors.*`). */
const REFUSALS: Record<RejectReason, { status: number; code: string }> = {
  EMPTY: { status: 400, code: "EMPTY_FILE" },
  TOO_LARGE: { status: 413, code: "FILE_TOO_LARGE" },
  UNSUPPORTED_TYPE: { status: 415, code: "UNSUPPORTED_TYPE" },
  TYPE_MISMATCH: { status: 415, code: "FILE_TYPE_MISMATCH" },
  EXECUTABLE: { status: 415, code: "FILE_EXECUTABLE" },
  CORRUPT: { status: 422, code: "UNREADABLE_FILE" },
  TRUNCATED: { status: 422, code: "FILE_TRUNCATED" },
  ENCRYPTED: { status: 422, code: "FILE_ENCRYPTED" },
  TOO_MANY_PAGES: { status: 422, code: "FILE_TOO_MANY_PAGES" },
  ACTIVE_CONTENT: { status: 422, code: "FILE_ACTIVE_CONTENT" },
  ARCHIVE_BOMB: { status: 422, code: "FILE_ARCHIVE_BOMB" },
};

const inspector = createInspector(YOMIZAKA_RULES);

/** The pre-flight (lib/preflight, ADR-0005): what an upload must be, decided here for nothing before anything is stored or sent to an engine. */
export async function checkUpload(file: { name: string; type: string; size: number }, bytes: Uint8Array): Promise<{ mimeType: "application/pdf" | "text/plain"; sha256: string; pages: number | null }> {
  const outcome = await inspector.inspect(bytes, file);
  if (outcome.kind === OUTCOME.rejected) {
    const { status, code } = REFUSALS[outcome.reason];
    throw refuse(status, code, `Refused by the pre-flight: ${outcome.reason}`, { reason: outcome.reason });
  }
  return { mimeType: outcome.fileKind === "pdf" ? "application/pdf" : "text/plain", sha256: outcome.sha256, pages: outcome.pages };
}

export const titleOf = (filename: string) => filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 200) || "Document";
/** NFC first (a macOS name arrives decomposed: the accent is a combining mark), then keep letters, marks, digits and apostrophes. */
/** A filename that says nothing (scan, IMG_2041, a hash): the title then comes from the (normalised) first line of the text. */
const GENERIC_NAME = /^(document|doc|scan|scanner|image|img|photo|file|fichier|untitled|sans titre|download|télécharg\w*)?[\s_-]*[\d\s_()-]*$|^[a-f0-9-]{16,}$/i;
export function titleFor(filename: string, text: string): string {
  const fromName = titleOf(filename);
  if (!GENERIC_NAME.test(fromName)) return fromName;
  const first = text.split("\n").map((l) => l.trim()).find((l) => l.length >= 4);
  return first ? first.slice(0, 120) : fromName;
}

export const safeFilename = (name: string) => name.normalize("NFC").replace(/[^\p{L}\p{M}\p{N}._ '’-]+/gu, "_").slice(0, 200) || "document";

export async function storeDocument(ownerId: string, file: { name: string; type: string; size: number }, bytes: Uint8Array, requested: DocumentKind | "auto"): Promise<{ summary: DocumentSummary; duplicate: boolean }> {
  const { mimeType, sha256 } = await checkUpload(file, bytes);
  const [existing] = await query<DocumentRow>(`SELECT ${SUMMARY_COLUMNS} FROM documents d WHERE d.owner_id = $1 AND d.sha256 = $2`, [ownerId, sha256]);
  if (existing) return { summary: summary(existing), duplicate: true };
  let read: { text: string; pages: number | null };
  try {
    read = await readText(mimeType, bytes);
  } catch {
    throw refuse(422, "UNREADABLE_FILE", "This PDF cannot be opened");
  }
  const kind = requested === "auto" ? kindFromNature(understanding.understand(read.text, { pages: read.pages }).nature?.id ?? null) : requested;
  const filename = safeFilename(file.name);
  const [row] = await query<DocumentRow>(
    `WITH d AS (
       INSERT INTO documents (owner_id, title, filename, mime_type, kind, size_bytes, sha256, pages, content, text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *)
     SELECT ${SUMMARY_COLUMNS} FROM d`,
    [ownerId, titleFor(filename, read.text), filename, mimeType, kind, bytes.length, sha256, read.pages, Buffer.from(bytes), read.text],
  );
  return { summary: summary(row!), duplicate: false };
}

export const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

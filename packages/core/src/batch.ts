import { z } from "zod";

import { startAnalysis, type StartAnalysis } from "./index";
import { DOCUMENT_KINDS } from "./vocabulary";

/**
 * A batch of checks from a CSV (yomizaka#232): one row per document, the file it names, the check to run and its
 * options — the same request a single check sends (`startAnalysis`), so a batch can never ask for what one check could
 * not. Pure: the parser, the row rules and the matching with the files sent; the server stores and runs.
 */

/** The manifest's columns — data, read by name (any order, any case); `file` and `check` are required. */
export const BATCH_COLUMNS = ["file", "check", "documentType", "jurisdiction", "ruleset", "expectedIssuer", "reference", "collection"] as const;
export type BatchColumn = (typeof BATCH_COLUMNS)[number];
const REQUIRED: readonly BatchColumn[] = ["file", "check"];

/** The check words a person writes in the CSV (English or French), and the Studio each runs. */
export const BATCH_CHECKS = { compliance: "compliance-check", conformite: "compliance-check", authenticity: "document-authenticity", authenticite: "document-authenticity" } as const;

/** The French headers a spreadsheet may carry, read as the columns they name (data: add one here, never in code). */
export const BATCH_COLUMN_ALIASES: Readonly<Record<string, BatchColumn>> = {
  fichier: "file",
  verification: "check",
  controle: "check",
  typededocument: "documentType",
  type: "documentType",
  juridiction: "jurisdiction",
  regles: "ruleset",
  emetteurattendu: "expectedIssuer",
  emetteur: "expectedIssuer",
  reference: "reference",
  dossier: "collection",
};

export const BATCH_ROW_ERROR = {
  missingFile: "MISSING_FILE",
  unknownCheck: "UNKNOWN_CHECK",
  invalidOptions: "INVALID_OPTIONS",
  unknownDocumentType: "UNKNOWN_DOCUMENT_TYPE",
  duplicateRow: "DUPLICATE_ROW",
  fileNotSent: "FILE_NOT_SENT",
} as const;
export type BatchRowError = (typeof BATCH_ROW_ERROR)[keyof typeof BATCH_ROW_ERROR];

export interface BatchRow {
  /** The row's number in the file, header = 1: what a person looks for in their spreadsheet. */
  line: number;
  file: string;
  request: StartAnalysis | null;
  documentType: (typeof DOCUMENT_KINDS)[number] | null;
  reference: string | null;
  collection: string | null;
  errors: BatchRowError[];
}

export interface BatchManifest {
  rows: BatchRow[];
  /** The header's problems: a required column missing, an unknown one (ignored, said). */
  missingColumns: BatchColumn[];
  unknownColumns: string[];
}

/** The separator a spreadsheet used: the one of `,` `;` tab that splits the header into the most columns (a French Excel writes `;`). */
export function detectDelimiter(header: string): "," | ";" | "\t" {
  const count = (c: string) => header.split(c).length;
  return ([",", ";", "\t"] as const).reduce((best, c) => (count(c) > count(best) ? c : best), ",");
}

/** RFC 4180 records: quoted fields, doubled quotes, separators and line breaks inside quotes, CRLF or LF, a leading BOM. */
export function parseCsv(text: string, delimiter = detectDelimiter(text.replace(/^﻿/, "").split(/\r?\n/)[0] ?? "")): string[][] {
  const src = text.replace(/^﻿/, "");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) record.push(field), (field = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      record.push(field), records.push(record), (record = []), (field = "");
    } else field += c;
  }
  if (field !== "" || record.length) record.push(field), records.push(record);
  return records.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Lower case, no accents, no spaces, dashes or underscores: « Émetteur attendu » and « expected_issuer » read as one. */
const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[\s_-]+/g, "");
const COLUMN_OF = new Map<string, BatchColumn>([...BATCH_COLUMNS.map((c) => [norm(c), c] as const), ...Object.entries(BATCH_COLUMN_ALIASES)]);
const cell = (s: string | undefined) => (s ?? "").trim() || null;

/** The manifest from the CSV's text: its header read by name, every row checked against the single-check rules. */
export function readBatchManifest(text: string): BatchManifest {
  const [header = [], ...body] = parseCsv(text);
  const columns = header.map((h) => COLUMN_OF.get(norm(h)) ?? null);
  const unknownColumns = header.filter((_, i) => columns[i] === null).map((h) => h.trim()).filter(Boolean);
  const missingColumns = REQUIRED.filter((c) => !columns.includes(c));
  const seen = new Map<string, number>();
  const rows = body.map((fields, n): BatchRow => {
    const get = (c: BatchColumn) => cell(fields[columns.indexOf(c)]);
    const errors: BatchRowError[] = [];
    const file = get("file") ?? "";
    if (!file) errors.push(BATCH_ROW_ERROR.missingFile);
    const studio = BATCH_CHECKS[norm(get("check") ?? "") as keyof typeof BATCH_CHECKS];
    let request: StartAnalysis | null = null;
    if (!studio) errors.push(BATCH_ROW_ERROR.unknownCheck);
    else {
      const parsed = startAnalysis.safeParse(
        studio === BATCH_CHECKS.compliance
          ? { studio, jurisdiction: (get("jurisdiction") ?? "QC").toUpperCase(), ...(get("ruleset") ? { ruleset: get("ruleset") } : {}) }
          : { studio, ...(get("expectedIssuer") ? { expectedIssuer: get("expectedIssuer") } : {}) },
      );
      if (parsed.success) request = parsed.data;
      else errors.push(BATCH_ROW_ERROR.invalidOptions);
    }
    const kind = get("documentType")?.toLowerCase() ?? null;
    if (kind && !(DOCUMENT_KINDS as readonly string[]).includes(kind)) errors.push(BATCH_ROW_ERROR.unknownDocumentType);
    // The same file and the same check twice is one check asked twice: the second row says so.
    const key = `${file.toLowerCase()}|${studio ?? ""}`;
    if (file && seen.has(key)) errors.push(BATCH_ROW_ERROR.duplicateRow);
    else seen.set(key, n);
    return { line: n + 2, file, request, documentType: kind && !errors.includes(BATCH_ROW_ERROR.unknownDocumentType) ? (kind as BatchRow["documentType"]) : null, reference: get("reference"), collection: get("collection"), errors };
  });
  return { rows, missingColumns, unknownColumns };
}

/** The rows against the files sent with them (matched by name, case-insensitive): a row whose file is missing says so, a file no row names is listed. */
export function matchBatchFiles(manifest: BatchManifest, fileNames: readonly string[]): { rows: BatchRow[]; unnamedFiles: string[] } {
  const sent = new Map(fileNames.map((f) => [f.toLowerCase(), f]));
  const named = new Set(manifest.rows.map((r) => r.file.toLowerCase()));
  return {
    rows: manifest.rows.map((r) => (r.file && !sent.has(r.file.toLowerCase()) ? { ...r, errors: [...r.errors, BATCH_ROW_ERROR.fileNotSent] } : r)),
    unnamedFiles: fileNames.filter((f) => !named.has(f.toLowerCase())),
  };
}

/** The template a person downloads: the header and two example rows, one of each check. */
export const BATCH_TEMPLATE = [
  BATCH_COLUMNS.join(","),
  "bail-dupont.pdf,compliance,lease,QC,,,LOC-0012,Immeuble Laurier",
  "talon-paie-dupont.pdf,authenticity,other,,,Employeur inc.,LOC-0012,Immeuble Laurier",
].join("\r\n");

export const batchRowSchema = z.object({ line: z.number().int(), file: z.string(), errors: z.array(z.string()) });

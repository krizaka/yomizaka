import { refuse } from "./http";

export const MAX_REPORT_BYTES = 2 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** The biggest body /api/verify reads: the report and the original document (nothing is kept — memory only). */
export const MAX_BODY_BYTES = MAX_REPORT_BYTES + MAX_DOCUMENT_BYTES + 64 * 1024;

const isHtmlReport = (file: File) => /\.html?$/i.test(file.name) || file.type === "text/html";
const isPdfReport = (file: File) => /\.pdf$/i.test(file.name) || file.type === "application/pdf";

/**
 * What /api/verify receives from a signed-in member: the report as a file or as pasted text, and optionally the original
 * document's bytes. Everything is read in memory, checked and dropped: nothing is stored, nothing reaches a model
 * (verification is Ed25519 and SHA-256 only). Who may verify is decided before the signature is checked (lib/report-access.ts).
 */
export async function readVerifyForm(form: FormData): Promise<{ text: string; pdf: Uint8Array | null; document: Uint8Array | null }> {
  const file = form.get("report");
  const pasted = form.get("reportText");
  let text = "";
  let pdf: Uint8Array | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_REPORT_BYTES) throw refuse(413, "FILE_TOO_LARGE", "The report is larger than 2 MB");
    if (isPdfReport(file)) pdf = new Uint8Array(await file.arrayBuffer());
    else if (isHtmlReport(file)) text = await file.text();
    else throw refuse(415, "UNSUPPORTED_TYPE", "An audit report is an .html or .pdf file");
  } else if (typeof pasted === "string" && pasted.trim()) {
    if (pasted.length > MAX_REPORT_BYTES) throw refuse(413, "FILE_TOO_LARGE", "The report is larger than 2 MB");
    text = pasted;
  } else throw refuse(400, "BAD_REQUEST", "Give a report file or its text");
  const doc = form.get("document");
  let document: Uint8Array | null = null;
  if (doc instanceof File && doc.size > 0) {
    if (doc.size > MAX_DOCUMENT_BYTES) throw refuse(413, "FILE_TOO_LARGE", "The document is larger than 10 MB");
    document = new Uint8Array(await doc.arrayBuffer());
  }
  return { text, pdf, document };
}

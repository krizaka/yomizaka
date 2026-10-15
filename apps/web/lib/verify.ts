import { refuse } from "./http";
import { type Verification, verifyReport } from "./report";
import { signingKey } from "./report-signer";

export const MAX_REPORT_BYTES = 2 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** What /verify receives: the report as a file or as pasted text, and optionally the original document's bytes. */
export async function verifyRequest(form: FormData): Promise<Verification> {
  const file = form.get("report");
  const pasted = form.get("reportText");
  let text: string;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_REPORT_BYTES) throw refuse(413, "FILE_TOO_LARGE", "The report is larger than 2 MB");
    text = await file.text();
  } else if (typeof pasted === "string" && pasted.trim()) {
    if (pasted.length > MAX_REPORT_BYTES) throw refuse(413, "FILE_TOO_LARGE", "The report is larger than 2 MB");
    text = pasted;
  } else throw refuse(400, "BAD_REQUEST", "Give a report file or its text");
  const doc = form.get("document");
  let bytes: Uint8Array | null = null;
  if (doc instanceof File && doc.size > 0) {
    if (doc.size > MAX_DOCUMENT_BYTES) throw refuse(413, "FILE_TOO_LARGE", "The document is larger than 10 MB");
    bytes = new Uint8Array(await doc.arrayBuffer());
  }
  return verifyReport(text, signingKey(), bytes);
}

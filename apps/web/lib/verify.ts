import { refuse } from "./http";
import { type Verification, verifyReport } from "./report";
import { signingKey } from "./report-signer";

export const MAX_REPORT_BYTES = 2 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** A visitor's request is the report and nothing else: no original document, and a smaller body. */
export const MAX_VISITOR_BODY_BYTES = MAX_REPORT_BYTES + 64 * 1024;

const isHtmlReport = (file: File) => /\.html?$/i.test(file.name) || file.type === "text/html";

/**
 * What /verify receives: the report as a file or as pasted text, and — for a signed-in account only — the original
 * document's bytes. Everything is read in memory, checked and dropped: nothing is stored, nothing reaches a model
 * (verification is Ed25519 and SHA-256 only). A visitor who sends a document is refused (401), not ignored.
 */
export async function verifyRequest(form: FormData, { signedIn = false }: { signedIn?: boolean } = {}): Promise<Verification> {
  const file = form.get("report");
  const pasted = form.get("reportText");
  let text: string;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_REPORT_BYTES) throw refuse(413, "FILE_TOO_LARGE", "The report is larger than 2 MB");
    if (!isHtmlReport(file)) throw refuse(415, "UNSUPPORTED_TYPE", "An audit report is an .html file");
    text = await file.text();
  } else if (typeof pasted === "string" && pasted.trim()) {
    if (pasted.length > MAX_REPORT_BYTES) throw refuse(413, "FILE_TOO_LARGE", "The report is larger than 2 MB");
    text = pasted;
  } else throw refuse(400, "BAD_REQUEST", "Give a report file or its text");
  const doc = form.get("document");
  let bytes: Uint8Array | null = null;
  if (doc instanceof File && doc.size > 0) {
    if (!signedIn) throw refuse(401, "UNAUTHENTICATED", "Sign in to check the original document");
    if (doc.size > MAX_DOCUMENT_BYTES) throw refuse(413, "FILE_TOO_LARGE", "The document is larger than 10 MB");
    bytes = new Uint8Array(await doc.arrayBuffer());
  }
  return verifyReport(text, signingKey(), bytes);
}

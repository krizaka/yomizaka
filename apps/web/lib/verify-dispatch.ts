import { PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";

import { OWNER_REPORT_SCHEMA, type OwnerVerification, verifyOwnerReportPdf } from "./owner-report-pdf";
import { REPORT_SCHEMA } from "./report";
import type { SigningKey } from "./report-key";
import { ATTESTATION_KEY } from "./report-pdf";

/** The schema id a PDF's attestation declares (read, not trusted), or null when it has none — never throws. */
export async function pdfSchemaId(bytes: Uint8Array): Promise<string | null> {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const raw = doc.context.lookup(doc.context.trailerInfo.Info, PDFDict).get(PDFName.of(ATTESTATION_KEY));
    if (!(raw instanceof PDFString)) return null;
    const schema = (JSON.parse(Buffer.from(raw.asString(), "base64").toString("utf8")) as { schema?: unknown }).schema;
    return typeof schema === "string" ? schema : null;
  } catch {
    return null;
  }
}

export type PdfKind = "compliance" | "owner" | "unknown" | "none";
export const kindOfSchema = (schema: string | null): PdfKind => {
  if (schema === null) return "none";
  if (schema === REPORT_SCHEMA) return "compliance";
  if (schema === OWNER_REPORT_SCHEMA) return "owner";
  return "unknown";
};

/** What the verification page shows of an owner report: only what is public in its schema, never a name, e-mail or quote. */
export type OwnerVerificationView =
  | {
      kind: "owner-report";
      ok: true;
      fileSha256: string;
      keyId: string;
      issuedAt: string;
      expiresAt: string;
      summary: { documents: number; findings: Record<string, number> };
    }
  | {
      kind: "owner-report";
      ok: false;
      reason: Extract<OwnerVerification, { ok: false }>["reason"];
      fileSha256: string;
    };

export async function verifyOwnerPdfView(
  bytes: Uint8Array,
  key: Pick<SigningKey, "keyId" | "publicKey">,
): Promise<OwnerVerificationView> {
  const v = await verifyOwnerReportPdf(bytes, key);
  if (!v.ok) return { kind: "owner-report", ok: false, reason: v.reason, fileSha256: v.fileSha256 };
  const findings: Record<string, number> = {};
  for (const f of v.payload.documents.flatMap((d) => d.findings)) findings[f.verdict] = (findings[f.verdict] ?? 0) + 1;
  return {
    kind: "owner-report",
    ok: true,
    fileSha256: v.fileSha256,
    keyId: v.keyId,
    issuedAt: v.payload.issuedAt,
    expiresAt: v.payload.expiresAt,
    summary: { documents: v.payload.documents.length, findings },
  };
}

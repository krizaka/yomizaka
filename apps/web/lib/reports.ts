import { getAnalysis } from "./analyses";
import { getDocument } from "./documents";
import { refuse } from "./http";
import { type Locale } from "./i18n";
import { buildPayload, type IssuedReport, issueReport, ReportError } from "./report";
import { reportLabels } from "./report-labels";
import { signingKey } from "./report-signer";

/** The signed audit report of one finished compliance check, for the document's owner — or the reason it cannot be made. */
export async function reportFor(ownerId: string, documentId: string, analysisId: string, lang: Locale): Promise<{ issued: IssuedReport; filename: string }> {
  const document = await getDocument(ownerId, documentId);
  const analysis = await getAnalysis(ownerId, documentId, analysisId);
  let payload;
  try {
    payload = buildPayload(document, analysis, lang);
  } catch (error) {
    if (error instanceof ReportError) throw refuse(409, "REPORT_NOT_READY", error.message);
    throw error;
  }
  const issued = issueReport(payload, reportLabels(lang), signingKey());
  const slug = document.title.normalize("NFKD").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "document";
  return { issued, filename: `yomizaka-audit-${slug}-${(analysis.runId ?? analysis.id).slice(0, 8)}.html` };
}

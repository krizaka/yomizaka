import { type Analysis } from "@yomizaka/core";

import { getAnalysis } from "./analyses";
import { getDocument } from "./documents";
import { refuse } from "./http";
import { type Locale } from "./i18n";
import { buildPayload, type IssuedReport, issueReport, ReportError } from "./report";
import { reportLabels } from "./report-labels";
import { type IssuedPdf, issuePdf } from "./report-pdf";
import { signingKey } from "./report-signer";
import { featureOn, settingsFor } from "./settings/guards";
import { ORIGINAL } from "./translation/port";
import { TRANSLATION_STATUS } from "./translation/service";
import { translationFor } from "./translation/wire";


/**
 * The translated texts the report in this language is built from (yomizaka#246), or null when it is read as Orazaka wrote it: the
 * original language, or the translation switched off / the language not offered. A translation not yet back is a 409 the page polls.
 */
async function translationOf(ownerId: string, analysis: Analysis, lang: Locale) {
  if (lang === ORIGINAL || !analysis.report || !("findings" in analysis.report) || !(await featureOn("reportTranslation", ownerId))) return null;
  if (!((await settingsFor(ownerId))["features.reportLanguages"].value as readonly string[]).includes(lang)) return null;
  const view = await translationFor(ownerId, analysis, lang);
  if (view.status === TRANSLATION_STATUS.running) throw refuse(409, "TRANSLATION_PENDING", "The translation of this report is not ready yet");
  if (view.status !== TRANSLATION_STATUS.done || !view.trace || !view.texts) throw refuse(502, "TRANSLATION_FAILED", "The report could not be translated", { reason: view.error });
  return { trace: view.trace, texts: view.texts };
}

/** The signed audit report of one finished compliance check, for the document's owner — or the reason it cannot be made. */
export async function reportFor(ownerId: string, documentId: string, analysisId: string, lang: Locale): Promise<{ issued: IssuedReport; filename: string }> {
  const document = await getDocument(ownerId, documentId);
  const analysis = await getAnalysis(ownerId, documentId, analysisId);
  let payload;
  try {
    payload = buildPayload(document, analysis, lang, (await translationOf(ownerId, analysis, lang)) ?? undefined);
  } catch (error) {
    if (error instanceof ReportError) throw refuse(409, "REPORT_NOT_READY", error.message);
    throw error;
  }
  const issued = issueReport(payload, reportLabels(lang), signingKey());
  const slug = document.title.normalize("NFKD").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "document";
  return { issued, filename: `yomizaka-audit-${slug}-${(analysis.runId ?? analysis.id).slice(0, 8)}.html` };
}

/** The signed PDF of the same check: the report's pages, a visible signature page, the attestation embedded. */
export async function reportPdfFor(ownerId: string, documentId: string, analysisId: string, lang: Locale): Promise<{ issued: IssuedPdf; filename: string }> {
  const document = await getDocument(ownerId, documentId);
  const analysis = await getAnalysis(ownerId, documentId, analysisId);
  let payload;
  try {
    payload = buildPayload(document, analysis, lang, (await translationOf(ownerId, analysis, lang)) ?? undefined);
  } catch (error) {
    if (error instanceof ReportError) throw refuse(409, "REPORT_NOT_READY", error.message);
    throw error;
  }
  const issued = await issuePdf(payload, reportLabels(lang), signingKey());
  const slug = document.title.normalize("NFKD").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "document";
  return { issued, filename: `yomizaka-audit-${slug}-${(analysis.runId ?? analysis.id).slice(0, 8)}.pdf` };
}

import type { AuthenticityReport, ComplianceReport } from "@yomizaka/core";

import { QUOTE_PREFIX } from "./fields";

/** Where a translated report comes from: kept with it, shown by it and signed with it. */
export interface TranslationTrace {
  /** The language the report was written in (Orazaka's rules are French). */
  original: "fr" | "en";
  /** The language of the translation. */
  language: "fr" | "en";
  runId: string;
  studioVersion: string | null;
  glossaryVersion: number;
  sourceVersion: string;
}

export type TranslatedTexts = Readonly<Record<string, string>>;

/**
 * The report in the reader's language: titles, explanations and signal texts replaced by their translation. The quoted passage,
 * the citation, the rule id, the verdict, the dates and the numbers are NOT replaced — a quote's translation travels beside it
 * as `quoteAid`. A text with no translation (refused by `restore`) stays as the Studio's author wrote it.
 */
export type TranslatedCompliance = Omit<ComplianceReport, "findings"> & { findings: (ComplianceReport["findings"][number] & { quoteAid?: string })[] };

export function applyToCompliance(report: ComplianceReport, texts: TranslatedTexts): TranslatedCompliance {
  return {
    ...report,
    ...(texts.reviewNote ? { reviewNote: texts.reviewNote } : {}),
    findings: report.findings.map((f) => ({
      ...f,
      title: texts[`title:${f.ruleId}`] ?? f.title,
      explanation: texts[`explanation:${f.ruleId}`] ?? f.explanation,
      ...(f.evidenceSpan?.quote && texts[`${QUOTE_PREFIX}${f.ruleId}`] ? { quoteAid: texts[`${QUOTE_PREFIX}${f.ruleId}`] } : {}),
    })),
  };
}

export function applyToAuthenticity(report: AuthenticityReport, texts: TranslatedTexts): AuthenticityReport {
  return {
    ...report,
    signals: report.signals.map((s) => ({
      ...s,
      observation: texts[`observation:${s.signalId}`] ?? s.observation,
      ...(s.mayIndicate ? { mayIndicate: texts[`mayIndicate:${s.signalId}`] ?? s.mayIndicate } : {}),
      ...(s.where ? { where: texts[`where:${s.signalId}`] ?? s.where } : {}),
    })),
  };
}

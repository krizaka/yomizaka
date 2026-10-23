import crypto from "node:crypto";

import type { AuthenticityReport, ComplianceReport } from "@yomizaka/core";

/**
 * What of a report may be translated, and nothing else (yomizaka#246). The generated texts: each finding's title and
 * explanation (compliance), each signal's observation, hint and place (authenticity), the review note. The quoted passage is
 * sent too, but only as an *aid* (`quote:` keys), shown beside the untouched original as an « indicative translation».
 * Never sent: the citation, the rule id, the verdict, the severity, the dates, the amounts of the report itself.
 */
export const FIELD_KIND = "finding";
export const QUOTE_PREFIX = "quote:";

export interface TranslationField {
  key: string;
  text: string;
  kind: typeof FIELD_KIND;
  /** What the Studio may produce for this field at most (a translation is a little longer than a French text). */
  maxLength: number;
}

const field = (key: string, text: string | null | undefined): TranslationField[] => (text && text.trim() ? [{ key, text, kind: FIELD_KIND, maxLength: Math.ceil(text.length * 1.6) + 80 }] : []);

export function fieldsOf(report: ComplianceReport | AuthenticityReport): TranslationField[] {
  if ("findings" in report) {
    return [
      ...field("reviewNote", report.reviewNote),
      ...report.findings.flatMap((f) => [...field(`title:${f.ruleId}`, f.title), ...field(`explanation:${f.ruleId}`, f.explanation), ...field(`${QUOTE_PREFIX}${f.ruleId}`, f.evidenceSpan?.quote)]),
    ];
  }
  return report.signals.flatMap((s) => [...field(`observation:${s.signalId}`, s.observation), ...field(`mayIndicate:${s.signalId}`, s.mayIndicate), ...field(`where:${s.signalId}`, s.where)]);
}

/** The version of the source text: change one word of a finding and it changes, so a cached translation is never served for other words. */
export const sourceVersionOf = (fields: readonly TranslationField[]): string =>
  crypto.createHash("sha256").update(JSON.stringify(fields.map((f) => [f.key, f.text]))).digest("hex").slice(0, 16);

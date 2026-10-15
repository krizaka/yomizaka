import { getDictionary, type Locale } from "./i18n";
import type { ReportLabels } from "./report";

/** The report's words in a language, flat (`verdict.PASS`) — the messages' `report.*`. They are printed into the file, so they are signed with it. */
export function reportLabels(locale: Locale): ReportLabels {
  const { verdicts, ...rest } = getDictionary(locale).report;
  return { ...rest, ...Object.fromEntries(Object.entries(verdicts).map(([k, v]) => [`verdict.${k}`, v])) };
}

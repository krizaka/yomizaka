import { getDictionary, type Locale } from "./i18n";
import type { ReportLabels } from "./report";

/** The report's words in a language, flat (`verdict.PASS`, `language.fr`) — the messages' `report.*`. They are printed into the file, so they are signed with it. */
export function reportLabels(locale: Locale): ReportLabels {
  const { verdicts, language, ...rest } = getDictionary(locale).report;
  const flat = (prefix: string, group: Record<string, string>) => Object.entries(group).map(([k, v]) => [`${prefix}.${k}`, v] as const);
  return { ...rest, ...Object.fromEntries([...flat("verdict", verdicts), ...flat("language", language)]) };
}

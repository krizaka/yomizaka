import { KrizakaQueryProvider } from "@krizaka/query";
import { SEEDED_INPUTS } from "@yomizaka/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { FindingList, TechnicalDetails, VerdictBand } from "./ReportFace";

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const readable = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
const finding = (ruleId: string, title: string, verdict: "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE", severity = "BLOCKING", quote?: string) => ({ ruleId, title, severity, verdict, explanation: `Explication ${ruleId}.`, citation: `C.c.Q., art. ${ruleId.length}`, method: "DETERMINISTIC", evidenceSpan: quote ? { quote } : null });
const REPORT = {
  rulesetId: "qc-residential-lease",
  rulesetVersion: "2026-06-20",
  jurisdiction: "QC" as const,
  asOf: "2026-10-23",
  reviewStatus: "TO_REVIEW_BY_LAWYER",
  summary: { byVerdict: { FAIL: 2, PASS: 8 }, blockingFailures: 1, rulesEvaluated: 10 },
  findings: [finding("R1", "Durée du bail", "PASS"), finding("R2", "Dépôt de garantie interdit", "FAIL", "BLOCKING", "dépôt de sécurité de 1 450 $"), finding("R3", "Frais de retard", "FAIL", "MAJOR"), ...[4, 5, 6, 7, 8, 9, 10].map((n) => finding(`R${n}`, `Règle ${n}`, "PASS" as const))],
};
const wrap = (node: React.ReactNode, locale: "en" | "fr" = "fr") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <KrizakaQueryProvider>{node}</KrizakaQueryProvider>
    </I18nProvider>,
  );
const analysis = (inputs: Record<string, string>) => ({ id: "a1", studio: "compliance-check" as const, status: "succeeded" as const, runId: "run_8f3a2c", blueprintVersion: "1.4.0", inputs, report: REPORT, error: null, createdAt: "2026-10-23T12:00:00.000Z", finishedAt: "2026-10-23T12:00:04.000Z" });

describe("the report's face (the UX review's Y5)", () => {
  it("says the verdict first — the points to look at on the rules read, in the report's tone, with one line of context", () => {
    const html = wrap(<VerdictBand report={REPORT as never} />);
    expect(html).toContain('data-tone="danger"');
    const text = readable(html);
    expect(text).toContain("2 points à regarder");
    expect(text).toContain("sur 10 règles");
    expect(text).toContain("Règles du Québec · qc-residential-lease · en vigueur le");
    expect(readable(wrap(<VerdictBand report={{ ...REPORT, findings: REPORT.findings.filter((f) => f.verdict === "PASS"), summary: { blockingFailures: 0, rulesEvaluated: 8 } } as never} />))).toContain(fr.console.reportFace.attentionNone);
    expect(readable(wrap(<VerdictBand report={REPORT as never} />, "en"))).toContain("2 points to look at");
  });

  it("lists what failed first — blocking before major, in words — and folds what passed; no code and no run id on the face", () => {
    const html = wrap(<FindingList report={REPORT as never} />);
    const text = readable(html);
    expect(text.indexOf("Dépôt de garantie interdit")).toBeLessThan(text.indexOf("Frais de retard"));
    expect(text.indexOf("Frais de retard")).toBeLessThan(text.indexOf("Durée du bail"));
    expect(text).toContain("bloquant");
    expect(text).toContain("majeur");
    expect(text).toContain("« dépôt de sécurité de 1 450 $ »");
    expect(html).toContain('data-testid="passed-findings"');
    expect(text).toContain("8 règles respectées");
    expect(text).not.toContain("BLOCKING");
    expect(text).not.toContain("DETERMINISTIC");
    expect(text).not.toContain("run_8f3a2c");
    expect(html).not.toContain(fr.console.reportFace.seeInFile);
    expect(wrap(<FindingList report={REPORT as never} selection={{ activeId: null, onSelect: () => {} }} />)).toContain(fr.console.reportFace.seeInFile);
  });

  it("keeps the engine's facts folded, the run id once, and says a seeded check has no certified report", () => {
    const html = wrap(<TechnicalDetails documentId="d1" analysis={analysis({ jurisdiction: "QC" })} />);
    expect(html).toContain('data-testid="technical-details"');
    expect(html.match(/run_8f3a2c/g)).toHaveLength(1);
    expect(readable(html)).toContain("compliance-check · 1.4.0");
    expect(readable(wrap(<TechnicalDetails documentId="d1" analysis={analysis({ ...SEEDED_INPUTS })} />))).toContain(fr.console.analysis.seededNote);
  });
});

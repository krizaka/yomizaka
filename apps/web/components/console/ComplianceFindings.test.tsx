import { KrizakaQueryProvider } from "@krizaka/query";
import type { ComplianceReport } from "@yomizaka/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "@/lib/i18n-client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { ComplianceFindings } from "./DocumentView";

const MESSAGES = { en: { console: en.console }, fr: { console: fr.console } } as const;
const REPORT: ComplianceReport = {
  rulesetId: "qc-residential-lease",
  rulesetVersion: "2024-02-21",
  jurisdiction: "QC",
  asOf: "2026-10-17",
  reviewStatus: "TO_REVIEW_BY_LAWYER",
  findings: [{ ruleId: "QC-LEASE-004", title: "Dépôt de garantie interdit", severity: "BLOCKING", verdict: "FAIL", citation: "C.c.Q., art. 1904, al. 1", explanation: "Le bail exige un dépôt de 1 450 $.", evidenceSpan: { quote: "dépôt de sécurité de 1 450 $" } }],
};
const done = { status: "done" as const, texts: { "title:QC-LEASE-004": "Security deposit prohibited", "explanation:QC-LEASE-004": "The lease requires a deposit of 1 450 $.", "quote:QC-LEASE-004": "security deposit of $1,450" }, trace: { original: "fr", runId: "run-9", glossaryVersion: 2 } };
const render = (translation?: Parameters<typeof ComplianceFindings>[0]["translation"], locale: "en" | "fr" = "en") =>
  renderToStaticMarkup(
    <I18nProvider locale={locale} messages={MESSAGES[locale] as never}>
      <KrizakaQueryProvider>
        <ComplianceFindings report={REPORT} runId="run-1" translation={translation} />
      </KrizakaQueryProvider>
    </I18nProvider>,
  );
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");

describe("a finding read in the other language (yomizaka#246)", () => {
  it("shows the translated title and explanation, the quote untouched with its indicative translation beside it, the citation untouched, and where it comes from", () => {
    const html = render(done);
    const t = text(html);
    expect(t).toContain("Security deposit prohibited");
    expect(t).toContain("The lease requires a deposit of 1 450 $.");
    expect(t).toContain("« dépôt de sécurité de 1 450 $ »");
    expect(t).toContain("Indicative translation : « security deposit of $1,450 »");
    expect(html).toContain("C.c.Q., art. 1904, al. 1");
    expect(t).toContain("Original language: French");
    expect(t).toContain("run-9");
  });

  it("without a translation (switched off, French, or not back yet) the report is Orazaka's own words, and says when it is translating", () => {
    expect(text(render())).toContain("Dépôt de garantie interdit");
    expect(text(render())).not.toContain("Indicative translation");
    expect(text(render({ status: "running", texts: null, trace: null }))).toContain("Translating this report");
    expect(text(render({ status: "running", texts: null, trace: null }))).toContain("Le bail exige un dépôt de 1 450 $.");
    expect(text(render({ status: "failed", texts: null, trace: null }))).toContain("not available right now");
  });

  it("the notice is worded in French for a French reader of an English original", () => {
    expect(text(render({ ...done, trace: { ...done.trace, original: "en" } }, "fr"))).toContain("Langue d’origine : anglais");
  });
});

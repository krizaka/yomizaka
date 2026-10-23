"use client";

import { krizakaFetch, useQuery } from "@krizaka/query";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { DescriptionList } from "@krizaka/ui/description-list";
import { Stat } from "@krizaka/ui/stat";
import { type Analysis, type ComplianceReport, isSeededCheck, queryKeys } from "@yomizaka/core";
import { z } from "zod";

import { orderFindings, severityOf, verdictOf, type VerdictTone } from "@/lib/document-face";
import { useSay } from "@/lib/i18n-client";
import { pluralKey } from "@/lib/plural";

import { formatDate } from "./format";

type Finding = ComplianceReport["findings"][number];
const BAND: Record<VerdictTone, string> = {
  success: "rounded-lg border border-border-default border-l-4 border-l-success bg-surface-1 p-4",
  warning: "rounded-lg border border-border-default border-l-4 border-l-warning bg-surface-1 p-4",
  danger: "rounded-lg border border-border-default border-l-4 border-l-danger bg-surface-1 p-4",
};
const CHIP: Record<VerdictTone | "neutral", "success" | "warning" | "danger" | "neutral"> = { success: "success", warning: "warning", danger: "danger", neutral: "neutral" };

/** The verdict first (the review's D1): the points to look at on the rules read, in the report's tone, with one line of context — never Yomizaka's own verdict. */
export function VerdictBand({ report }: { report: ComplianceReport }) {
  const { say, locale } = useSay();
  const v = verdictOf(report);
  const value = v.attention ? say(pluralKey("reportFace.attention", v.attention), { count: v.attention }) : say("reportFace.attentionNone");
  const context = say("reportFace.rulesOf", { jurisdiction: say(`analysis.jurisdictionNames.${report.jurisdiction}`), ruleset: report.rulesetId, date: formatDate(report.asOf, locale) });
  return (
    <section aria-label={say("reportFace.label")} className={BAND[v.tone]} data-testid="verdict-band" data-tone={v.tone}>
      <Stat label={say("reportFace.label")} value={value} hint={`${say("reportFace.onRules", { rules: v.rules })} · ${context}`} />
      {report.reviewStatus ? <p className="m-0 mt-2 text-xs text-fg-muted">{say("analysis.toReview")}</p> : null}
    </section>
  );
}

/** What the document page shares with the findings of its latest compliance check: which finding is lit, and where each sits. */
export interface FindingSelection {
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

/** The findings, what failed first (the review's D1, D2): title, severity in words and tone, the quote, the article — the codes stay in the technical details; what passed is folded. */
export function FindingList({ report, selection }: { report: ComplianceReport; selection?: FindingSelection }) {
  const { say } = useSay();
  const { attention, passed } = orderFindings(report.findings);
  const item = (f: Finding) => {
    const s = severityOf(f.severity);
    const active = selection?.activeId === f.ruleId;
    return (
      <li key={f.ruleId} id={`finding-${f.ruleId}`} data-active={active} className="flex flex-col gap-1 rounded-lg border border-border-default bg-surface-1 p-3 text-sm data-[active=true]:border-accent data-[active=true]:bg-surface-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-fg">{f.title ?? f.ruleId}</span>
          <span className="flex items-center gap-2">
            {f.verdict !== "PASS" ? <Badge tone={CHIP[s.tone]}>{say(`analysis.severities.${s.word}`)}</Badge> : null}
            <Badge tone={f.verdict === "PASS" ? "success" : f.verdict === "FAIL" ? "danger" : "warning"}>{say(`analysis.verdicts.${f.verdict}`)}</Badge>
          </span>
        </div>
        {f.evidenceSpan?.quote ? <p className="m-0 italic text-fg-secondary">« {f.evidenceSpan.quote} »</p> : null}
        <p className="m-0 text-fg-secondary">{f.explanation}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-fg-muted">
          {f.citation ? <span data-testid="finding-citation">{f.citation}</span> : null}
          {selection && f.evidenceSpan?.quote ? (
            <Button size="sm" variant={active ? "primary" : "ghost"} aria-pressed={active} onClick={() => selection.onSelect(active ? null : f.ruleId)}>
              {say("reportFace.seeInFile")}
            </Button>
          ) : null}
        </div>
      </li>
    );
  };
  return (
    <div className="flex flex-col gap-3" data-testid="finding-list">
      {attention.length ? <ul className="m-0 flex list-none flex-col gap-2 p-0">{attention.map(item)}</ul> : null}
      {passed.length ? (
        <details className="rounded-lg border border-border-default p-3" data-testid="passed-findings">
          <summary className="cursor-pointer text-sm font-semibold text-fg">{say(pluralKey("reportFace.passed", passed.length), { count: passed.length })}</summary>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">{passed.map(item)}</ul>
        </details>
      ) : null}
    </div>
  );
}

const reportMeta = z.object({ report: z.object({ fileSha256: z.string(), keyId: z.string(), filename: z.string() }) });

/** The report's fingerprint and key, from the server, for a check that can be certified (a seeded demo check cannot). */
export function useReportMeta(documentId: string, analysis: Analysis, locale: string) {
  const certifiable = analysis.studio === "compliance-check" && analysis.status === "succeeded" && !!analysis.report && "findings" in analysis.report && !isSeededCheck(analysis);
  return useQuery({
    queryKey: [...queryKeys.document(documentId), "report", analysis.id, locale],
    queryFn: () => krizakaFetch(`/api/documents/${documentId}/analyses/${analysis.id}/report?lang=${locale}&meta=1`, { schema: reportMeta }).then((r) => r.report),
    staleTime: Infinity,
    retry: false,
    throwOnError: false,
    enabled: certifiable,
  });
}

/** The engine's facts, folded (the review's D1, D2): the run id — once, here —, the Studio version, the rules, the dates, the report's fingerprint and key. */
export function TechnicalDetails({ documentId, analysis }: { documentId: string; analysis: Analysis }) {
  const { say, locale } = useSay();
  const meta = useReportMeta(documentId, analysis, locale);
  const report = analysis.report && "rulesetId" in analysis.report ? analysis.report : null;
  return (
    <details className="rounded-lg border border-border-default p-3" data-testid="technical-details">
      <summary className="cursor-pointer text-sm font-semibold text-fg">{say("reportFace.technical")}</summary>
      <div className="mt-3">
        <DescriptionList
          items={[
            { term: say("analysis.runId"), details: <code className="break-all font-mono text-xs" data-testid="orazaka-run-id">{analysis.runId ?? "—"}</code> },
            ...(analysis.blueprintVersion ? [{ term: say("analysis.blueprint"), details: `${analysis.studio} · ${analysis.blueprintVersion}` }] : []),
            ...(report ? [{ term: say("analysis.ruleset"), details: `${report.rulesetId} · ${report.rulesetVersion}` }] : []),
            { term: say("analysis.started"), details: formatDate(analysis.createdAt, locale, true) },
            ...(analysis.finishedAt ? [{ term: say("analysis.finished"), details: formatDate(analysis.finishedAt, locale, true) }] : []),
            ...(meta.data ? [{ term: say("analysis.exportSha"), details: <code className="break-all font-mono text-xs" data-testid="report-sha256">{meta.data.fileSha256}</code> }, { term: say("analysis.exportKey"), details: <code className="font-mono text-xs">{meta.data.keyId}</code> }] : []),
            ...(isSeededCheck(analysis) ? [{ term: say("analysis.exportReport"), details: say("analysis.seededNote") }] : []),
          ]}
        />
      </div>
    </details>
  );
}

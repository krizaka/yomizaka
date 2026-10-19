import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import { CodeBlock } from "@krizaka/ui/code-block";
import { DescriptionList } from "@krizaka/ui/description-list";
import { passages } from "@yomizaka/core";

import { format, getDictionary, type Locale } from "@/lib/i18n";
import type { Showcase } from "@/lib/showcase";

import { Specimen } from "./Specimen";


const TONE = { PASS: "success", FAIL: "danger", INSUFFICIENT_EVIDENCE: "warning" } as const;
const ORDER: Record<string, number> = { FAIL: 0, INSUFFICIENT_EVIDENCE: 1, PASS: 2 };
const DATE_LOCALE: Record<Locale, string> = { en: "en-CA", fr: "fr-CA" };

/** Non-compliant first, then the insufficient evidence, then what passes — each group in the order Orazaka returned. */
export function sortFindings<T extends { verdict: string }>(findings: readonly T[]): T[] {
  return findings.map((f, i) => ({ f, i })).sort((a, b) => (ORDER[a.f.verdict] ?? 1) - (ORDER[b.f.verdict] ?? 1) || a.i - b.i).map(({ f }) => f);
}

/** « 9 checks · 5 non-compliant · 4 compliant » — counted from the findings, never typed. */
export function summaryLine(findings: readonly { verdict: string }[], t: { summary: string; insufficient: string }): string {
  const n = (v: string) => findings.filter((f) => f.verdict === v).length;
  const insufficient = n("INSUFFICIENT_EVIDENCE");
  return format(t.summary, { total: findings.length, fail: n("FAIL"), pass: n("PASS") }) + (insufficient ? format(t.insufficient, { n: insufficient }) : "");
}

/** A real run: the findings, the lit sample, the Orazaka run id — and an unsigned, watermarked specimen of the report (ADR-0002). */
export function ShowcaseRun({ run, locale }: { run: Showcase; locale: Locale }) {
  const t = getDictionary(locale).run;
  const verdicts = t.verdicts;
  const findings = sortFindings(run.report.findings);
  const quotes = run.report.findings.filter((f) => f.evidenceSpan?.quote).map((f) => ({ id: f.ruleId, quote: f.evidenceSpan!.quote, start: f.evidenceSpan!.start ?? undefined }));
  const parts = passages(run.document.text, quotes);
  return (
    <div className="flex flex-col gap-6">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg" data-testid="showcase-summary">
        {summaryLine(run.report.findings, t)}
      </p>
      {run.report.reviewStatus ? <p className="text-sm text-fg-secondary">{t.review}</p> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <figure className="m-0 flex flex-col gap-2" aria-label={t.viewer}>
            <div className="max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border-default bg-surface-1 p-4 font-mono text-xs leading-relaxed text-fg-secondary">
              {parts.map((p, i) =>
                p.mark ? (
                  <mark key={i} className="ym-passage text-fg" title={p.mark}>
                    {p.text}
                  </mark>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </div>
            <figcaption className="text-xs text-fg-muted">{t.viewerHint}</figcaption>
          </figure>
          <CodeBlock code={run.runId} file={t.run} copyLabel={t.copy} copiedLabel={t.copied} />
          <DescriptionList
            items={[
              { term: t.studio, details: `compliance-check${run.studioVersion ? ` · ${run.studioVersion}` : ""}` },
              { term: t.ruleset, details: `${run.report.rulesetId} · ${run.report.rulesetVersion}` },
              { term: t.when, details: new Date(run.finishedAt).toLocaleString(DATE_LOCALE[locale], { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }) },
              { term: t.docHash, details: <code className="break-all font-mono text-xs">{run.document.sha256}</code> },
            ]}
          />
          <Specimen run={run} locale={locale} />
        </div>
        <ul className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" aria-label={t.findings}>
          {findings.map((f) => (
            <li key={f.ruleId} className="min-w-0">
              <Card.Root className="flex h-full flex-col gap-2 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-semibold text-fg">{f.title ?? f.ruleId}</span>
                  <Badge tone={TONE[f.verdict as keyof typeof TONE] ?? "neutral"}>{verdicts[f.verdict as keyof typeof verdicts] ?? f.verdict}</Badge>
                </div>
                <p className="font-mono text-xs text-fg-muted">
                  {f.ruleId}
                  {f.citation ? ` · ${f.citation}` : ""}
                </p>
                {f.verdict !== "PASS" && f.evidenceSpan?.quote ? <p className="border-l-2 border-accent pl-2 italic text-fg-secondary">« {f.evidenceSpan.quote} »</p> : null}
              </Card.Root>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

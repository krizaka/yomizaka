import { Badge } from "@krizaka/ui/badge";
import { Card } from "@krizaka/ui/card";
import { passages } from "@yomizaka/core";

import { type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n";
import { recordedRun } from "@/lib/recorded-runs";

/** The finding the hero shows: the forbidden deposit (QC-LEASE-004) of the recorded tenant run — a real answer, never typed. */
export const HERO_RULE = "QC-LEASE-004";

/**
 * One clear before/after: the lease with the forbidden clause lit, and the finding card Yomizaka returns for that line, with
 * its article of law. Both halves are read from the recorded run (content/recorded-runs/tenant.json).
 */
export function BeforeAfter({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).landing.proof;
  const run = recordedRun("tenant");
  const finding = run.report.findings.find((f) => f.ruleId === HERO_RULE)!;
  const quote = finding.evidenceSpan?.quote;
  const parts = passages(run.document.text, quote ? [{ id: finding.ruleId, quote, start: finding.evidenceSpan?.start ?? undefined }] : []);
  return (
    <div className="mt-8 grid w-full gap-4 md:grid-cols-[1.1fr_auto_1fr] md:items-center" data-testid="before-after">
      <figure className="m-0 flex min-w-0 flex-col gap-2" aria-label={t.beforeLabel}>
        <figcaption className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{t.before}</figcaption>
        <div className="whitespace-pre-wrap rounded-xl border border-border-default bg-surface-1 p-4 font-mono text-sm leading-relaxed text-fg-secondary">
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
      </figure>
      <span aria-hidden className="mx-auto text-2xl text-fg-accent md:rotate-0 rotate-90">→</span>
      <figure className="m-0 flex min-w-0 flex-col gap-2" aria-label={t.afterLabel}>
        <figcaption className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{t.after}</figcaption>
        <Card.Root className="flex flex-col gap-3 border-danger/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="text-base font-semibold text-fg">{finding.title ?? finding.ruleId}</span>
            <Badge tone="danger">{getDictionary(locale).run.verdicts.FAIL}</Badge>
          </div>
          {quote ? <p className="border-l-2 border-accent pl-3 italic text-fg-secondary">« {quote} »</p> : null}
          <p className="text-sm text-fg-secondary">{finding.explanation}</p>
          <p className="font-mono text-sm font-semibold text-fg-accent" data-testid="hero-article">
            {finding.citation}
          </p>
        </Card.Root>
      </figure>
    </div>
  );
}

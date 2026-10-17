import { CheckIcon, LockIcon, ShieldIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { CardGrid } from "@krizaka/ui/card-grid";
import { DescriptionList } from "@krizaka/ui/description-list";
import { Section } from "@krizaka/ui/page";
import Link from "next/link";

import { HERO_RULE } from "@/components/BeforeAfter";
import { format, getDictionary, type Locale } from "@/lib/i18n";
import { recordedRun } from "@/lib/recorded-runs";
import { pagePath } from "@/lib/site";

const DATE: Record<Locale, string> = { en: "en-CA", fr: "fr-CA" };

/**
 * « Proof »: the real recorded run (rule, line, article, run id, date), the signed report of that check, the verification by
 * grant — and two figures, both counted from the recording, never typed. The run id is an Orazaka run: this section is where
 * the engine is named.
 */
export function ProofSection({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const t = d.landing.proof;
  const run = recordedRun("tenant");
  const finding = run.report.findings.find((f) => f.ruleId === HERO_RULE)!;
  const fail = run.report.findings.filter((f) => f.verdict === "FAIL").length;
  const pass = run.report.findings.filter((f) => f.verdict === "PASS").length;
  const rules = run.report.summary?.rulesEvaluated ?? run.report.findings.length;
  return (
    <Section id="proof" eyebrow={t.eyebrow} title={t.title} lead={t.lead} reveal divider>
      <ul className="mb-6 flex flex-wrap gap-6" aria-label={t.title}>
        <li className="flex flex-col">
          <span className="font-display text-3xl font-bold text-fg-accent" data-testid="figure-rules">{rules}</span>
          <span className="max-w-60 text-sm text-fg-secondary">{t.rules}</span>
        </li>
        <li className="flex flex-col">
          <span className="font-display text-3xl font-bold text-fg-accent" data-testid="figure-found">{fail + pass}</span>
          <span className="max-w-60 text-sm text-fg-secondary">{format(t.found, { fail, pass })}</span>
        </li>
      </ul>
      <CardGrid min={300}>
        <Card.Root className="flex flex-col gap-3 p-5" data-testid="proof-run">
          <span className="flex items-center gap-2 text-fg-accent [&_svg]:h-5 [&_svg]:w-5">
            <ShieldIcon />
            <span className="text-sm font-semibold text-fg">{t.run}</span>
            <Badge tone="danger">{d.run.verdicts.FAIL}</Badge>
          </span>
          <p className="text-sm font-semibold text-fg">{finding.title}</p>
          <DescriptionList
            items={[
              { term: d.run.rule, details: <code className="font-mono text-xs">{finding.ruleId}</code> },
              { term: d.run.article, details: finding.citation },
              { term: d.run.passage, details: finding.evidenceSpan?.quote ? `« ${finding.evidenceSpan.quote} »` : d.run.noPassage },
              { term: t.runLabel, details: <code className="break-all font-mono text-xs">{run.runId}</code> },
              { term: t.dateLabel, details: new Date(run.recordedAt).toLocaleDateString(DATE[locale], { dateStyle: "long", timeZone: "America/Toronto" }) },
              { term: t.rulesetLabel, details: `${run.report.rulesetId} · ${run.report.rulesetVersion}` },
            ]}
          />
          <Button asChild variant="ghost" size="sm">
            <Link href={`${pagePath(locale, "run")}`}>{t.see}</Link>
          </Button>
        </Card.Root>
        <Card.Root className="flex flex-col gap-3 p-5">
          <span className="flex items-center gap-2 text-fg-accent [&_svg]:h-5 [&_svg]:w-5">
            <CheckIcon />
            <span className="text-sm font-semibold text-fg">{t.report.title}</span>
          </span>
          <p className="text-sm text-fg-secondary">{t.report.text}</p>
          <Button asChild variant="secondary" size="md" shape="cut">
            <a href={`/api/recorded-runs/tenant/report?lang=${locale}`} download>
              {t.report.cta}
            </a>
          </Button>
        </Card.Root>
        <Card.Root className="flex flex-col gap-3 p-5">
          <span className="flex items-center gap-2 text-fg-accent [&_svg]:h-5 [&_svg]:w-5">
            <LockIcon />
            <span className="text-sm font-semibold text-fg">{t.access.title}</span>
          </span>
          <p className="text-sm text-fg-secondary">{t.access.text}</p>
          <Button asChild variant="secondary" size="md" shape="cut">
            <Link href={pagePath(locale, "verify")}>{t.access.cta}</Link>
          </Button>
        </Card.Root>
      </CardGrid>
      <p className="mt-6 text-sm text-fg-secondary">{d.landing.trust.powered}</p>
    </Section>
  );
}

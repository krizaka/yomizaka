import { CheckIcon, LockIcon, ShieldIcon } from "@krizaka/icons";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { CardGrid } from "@krizaka/ui/card-grid";
import { DescriptionList } from "@krizaka/ui/description-list";
import { Section } from "@krizaka/ui/page";
import Link from "next/link";

import { Specimen } from "@/components/Specimen";
import { getDictionary, type Locale } from "@/lib/i18n";
import { HERO_RULE } from "@/lib/landing";
import { recordedRun } from "@/lib/recorded-runs";
import { pagePath } from "@/lib/site";


const DATE: Record<Locale, string> = { en: "en-CA", fr: "fr-CA" };

/**
 * « Proof »: the real recorded run (rule, line, article, run id, date), the signed report of that check, the verification by
 * grant. The run id is an Orazaka run: this section is where
 * the engine is named.
 */
export function ProofSection({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const t = d.landing.proof;
  const run = recordedRun("tenant");
  const finding = run.report.findings.find((f) => f.ruleId === HERO_RULE)!;
  return (
    <Section id="proof" eyebrow={t.eyebrow} title={t.title} lead={t.lead} reveal divider>
      <CardGrid min={300}>
        <Card.Root className="flex h-full flex-col gap-3 p-5" data-testid="proof-run">
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
        <Card.Root className="flex h-full flex-col gap-3 p-5" data-testid="proof-specimen">
          <span className="flex items-center gap-2 text-fg-accent [&_svg]:h-5 [&_svg]:w-5">
            <CheckIcon />
            <span className="text-sm font-semibold text-fg">{t.report.title}</span>
          </span>
          <p className="text-sm text-fg-secondary">{t.report.text}</p>
          {/* A thumbnail of the watermarked specimen: decorative (the link says where it leads), faded at the bottom. */}
          <Link href={`${pagePath(locale, "run")}#specimen`} aria-label={t.report.cta} tabIndex={-1} className="block max-h-44 overflow-hidden rounded-xl [mask-image:linear-gradient(#000_55%,transparent)]" data-testid="specimen-thumbnail">
            <span aria-hidden className="pointer-events-none block origin-top-left">
              <Specimen run={run} locale={locale} />
            </span>
          </Link>
          <Button asChild variant="secondary" size="md" shape="cut" className="mt-auto">
            <Link href={`${pagePath(locale, "run")}#specimen`}>{t.report.cta}</Link>
          </Button>
        </Card.Root>
        <Card.Root className="flex h-full flex-col gap-3 p-5" data-testid="proof-access">
          <span className="flex items-center gap-2 text-fg-accent [&_svg]:h-5 [&_svg]:w-5">
            <LockIcon />
            <span className="text-sm font-semibold text-fg">{t.access.title}</span>
          </span>
          <p className="text-sm text-fg-secondary">{t.access.text}</p>
          <ol className="m-0 flex list-none flex-col gap-0 p-0" data-testid="access-steps">
            {(["share", "signin", "verify"] as const).map((id, i) => (
              <li key={id} className="flex items-stretch gap-3">
                <span className="flex flex-col items-center">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent bg-accent-soft font-mono text-xs font-bold text-fg">{i + 1}</span>
                  {i < 2 ? <span aria-hidden className="my-1 w-px flex-1 bg-border-strong" /> : null}
                </span>
                <span className="flex flex-col pb-3">
                  <span className="text-sm font-semibold text-fg">{t.access.steps[id].title}</span>
                  <span className="text-xs leading-snug text-fg-secondary">{t.access.steps[id].text}</span>
                </span>
              </li>
            ))}
          </ol>
          <Button asChild variant="secondary" size="md" shape="cut" className="mt-auto">
            <Link href={pagePath(locale, "verify")}>{t.access.cta}</Link>
          </Button>
        </Card.Root>
      </CardGrid>
      <p className="mt-6 text-sm text-fg-secondary">{d.landing.trust.powered}</p>
    </Section>
  );
}

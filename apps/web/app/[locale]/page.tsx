import { KeepIcon, SearchIcon, ShieldIcon } from "@krizaka/icons";
import { YomizakaLogo } from "@krizaka/ui";
import { Badge } from "@krizaka/ui/badge";
import { Button } from "@krizaka/ui/button";
import { CardGrid } from "@krizaka/ui/card-grid";
import { DescriptionList } from "@krizaka/ui/description-list";
import { LinkCard } from "@krizaka/ui/link-card";
import { Mascot } from "@krizaka/ui/mascots";
import { Section } from "@krizaka/ui/page";
import { ProductPage } from "@krizaka/ui/product-page";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { DEMO_RUN } from "@/lib/demo-run";
import { asLocale, getDictionary, type Locale, translator } from "@/lib/i18n";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { contactHref } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "home");
}

/** A sample lease, written for the page: four clauses the French law deems void — the input of the demo run. */
const SAMPLE = ["CONTRAT DE LOCATION", "Loyer mensuel : 850 € hors charges.", "Dépôt de garantie : 2 550 €.", "La solidarité du colocataire sortant se poursuit après le congé…", "Il est interdit au locataire de recevoir des visites après 22 heures."];

const DATE_LOCALE: Record<Locale, string> = { en: "en-CA", fr: "fr-CA" };
const tone = { PASS: "success", FAIL: "danger", INSUFFICIENT_EVIDENCE: "warning" } as const;

function Visual({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).landing;
  const failed = DEMO_RUN?.report.findings.filter((f) => f.verdict !== "PASS").slice(0, 3);
  return (
    <div className="flex flex-col gap-3 p-5 text-sm">
      <pre className="whitespace-pre-wrap rounded-lg border border-border-default bg-surface-1 p-4 font-mono text-xs leading-relaxed text-fg-secondary">{SAMPLE.join("\n")}</pre>
      {failed?.length ? (
        <ul className="flex flex-col gap-2" aria-label={t.sections.demo.title}>
          {failed.map((f) => (
            <li key={f.ruleId} className="rounded-lg border border-border-default bg-surface-1 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-fg-muted">{f.ruleId}</span>
                <Badge tone={tone[f.verdict as keyof typeof tone] ?? "neutral"}>{t.verdicts[f.verdict as keyof typeof t.verdicts] ?? f.verdict}</Badge>
              </div>
              <p className="mt-1 font-semibold text-fg">{f.title}</p>
              {f.evidenceSpan?.quote ? <p className="mt-1 border-l-2 border-accent pl-2 italic text-fg-secondary">« {f.evidenceSpan.quote} »</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-muted">{t.sections.demo.none}</p>
      )}
    </div>
  );
}

function DemoSection({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).landing.sections.demo;
  const verdicts = getDictionary(locale).landing.verdicts;
  return (
    <Section id="demo" eyebrow={t.eyebrow} title={t.title} lead={t.lead} divider>
      {DEMO_RUN ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <DescriptionList
            items={[
              { term: t.run, details: <code className="break-all font-mono text-xs">{DEMO_RUN.runId}</code> },
              { term: t.studio, details: `${DEMO_RUN.studio}${DEMO_RUN.blueprintVersion ? ` · ${DEMO_RUN.blueprintVersion}` : ""}` },
              { term: t.ruleset, details: `${DEMO_RUN.report.rulesetId} · ${DEMO_RUN.report.rulesetVersion}` },
              { term: t.when, details: new Date(DEMO_RUN.finishedAt).toLocaleString(DATE_LOCALE[locale], { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }) },
            ]}
          />
          <ul className="flex flex-col gap-2">
            {DEMO_RUN.report.findings.map((f) => (
              <li key={f.ruleId} className="rounded-lg border border-border-default bg-surface-1 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-fg">{f.title ?? f.ruleId}</span>
                  <Badge tone={tone[f.verdict as keyof typeof tone] ?? "neutral"}>{verdicts[f.verdict as keyof typeof verdicts] ?? f.verdict}</Badge>
                </div>
                <p className="mt-1 text-fg-secondary">{f.explanation}</p>
                {f.citation ? <p className="mt-1 font-mono text-xs text-fg-muted">{f.citation}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="max-w-2xl text-fg-secondary">{t.none}</p>
      )}
    </Section>
  );
}

/** dev.yomizaka.com: what Yomizaka does, how, a real run — the product page template of @krizaka/ui, in ink indigo. */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = translator(locale);
  const d = getDictionary(locale).landing;
  const signIn = `/${locale}/sign-in`;
  const steps = [
    { id: "keep", href: "#find", icon: <KeepIcon /> },
    { id: "check", href: "#check", icon: <ShieldIcon /> },
    { id: "find", href: "#find", icon: <SearchIcon /> },
  ] as const;
  const details = [
    { id: "check", bird: "owl" as const },
    { id: "tamper", bird: "falcon" as const },
    { id: "find", bird: "pigeon" as const },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="home" />
      <main id="content" className="pt-20">
        <ProductPage
          brand="yomizaka"
          linkAs={Link}
          mark={
            <>
              <YomizakaLogo size={18} animated={false} /> {d.mark}
            </>
          }
          title={d.title}
          lead={d.lead}
          facts={[{ label: d.facts.runs, tone: "ok" }, { label: d.facts.license }, { label: d.facts.closed, tone: "wip" }]}
          actions={
            <>
              <Button asChild variant="primary" size="lg" shape="cut" shimmer magnetic>
                <a href={contactHref("dev-yomizaka-hero")}>{d.talk}</a>
              </Button>
              <Button asChild variant="secondary" size="lg" shape="cut">
                <Link href={signIn}>{d.signIn}</Link>
              </Button>
            </>
          }
          visualLabel={d.visualLabel}
          visual={<Visual locale={locale} />}
          reasonsHeading={{ eyebrow: d.reasonsEyebrow, title: d.reasonsTitle }}
          reasonLabels={{ trap: d.trap, more: d.more }}
          reasons={details.map(({ id, bird }) => ({
            id,
            title: d.reasons[id as keyof typeof d.reasons].title,
            trap: d.reasons[id as keyof typeof d.reasons].trap,
            mark: <Mascot bird={bird} size={40} animated={false} />,
            href: `#${id}`,
          }))}
          decisions={{
            eyebrow: d.decisionsEyebrow,
            title: d.decisionsTitle,
            labels: d.decisionLabels,
            items: (["rules", "signals", "engine"] as const).map((id) => ({ id, ...d.decisions[id] })),
          }}
          promise={{ bird: "owl", label: d.promiseLabel, text: d.promise }}
          closing={{
            title: d.closingTitle,
            body: d.closingBody,
            actions: (
              <Button asChild variant="primary" size="lg" shape="cut">
                <a href={contactHref("dev-yomizaka-closing")}>{d.talk}</a>
              </Button>
            ),
          }}
        >
          <Section id="how" eyebrow={d.sections.how.eyebrow} title={d.sections.how.title} lead={d.sections.how.lead} divider>
            <CardGrid min={240}>
              {steps.map((s) => (
                <LinkCard key={s.id} layout="stack" href={s.href} icon={s.icon} title={t(`landing.sections.how.steps.${s.id}.title`)} description={t(`landing.sections.how.steps.${s.id}.text`)} cta={d.more} />
              ))}
            </CardGrid>
          </Section>
          {details.map(({ id }) => {
            const section = d.sections[id as "check" | "tamper" | "find"];
            return (
              <Section
                key={id}
                id={id}
                eyebrow={section.eyebrow}
                title={section.title}
                lead={section.lead}
                divider
                actions={
                  <Button asChild variant="secondary" size="md" shape="cut">
                    <Link href={signIn}>{section.cta}</Link>
                  </Button>
                }
              />
            );
          })}
          <DemoSection locale={locale} />
        </ProductPage>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

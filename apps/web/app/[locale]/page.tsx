import { Page, Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { BarQueryRoot, HeroActions } from "@/components/BarSession";
import { BeforeAfter } from "@/components/home/BeforeAfter";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { HERO_FIGURES, productStatus } from "@/lib/landing";
import { recordedRun } from "@/lib/recorded-runs";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { pagePath } from "@/lib/site";

import preview from "../../../../dev-preview.json";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "home");
}

const DATE = { en: "en-CA", fr: "fr-CA" } as const;

/**
 * The home is the whole public site (Simplify Yomizaka, krizaka/yomizaka#120): who Yomizaka is for and what it does, one
 * real check recorded as it came back (the lease line, the finding, the run id), one way in (sign-in). Orazaka, the
 * engine, is named once, in a quiet line under the proof. Static: built from the recording.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const d = getDictionary(locale).landing;
  const run = recordedRun("tenant");
  const figures = HERO_FIGURES(run.report);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <BarQueryRoot>
        <SiteHeader locale={locale} current="home" provider={false} />
        <main id="content" className="pt-20">
          <PageHero title={d.title} lead={d.lead} backdrop="plain">
            {/* Signed in, « Ouvrir mes documents »; otherwise « Se connecter » and the status line — the same answer as the bar (F0). */}
            <HeroActions locale={locale} status={d.status[productStatus(preview)]} />
          </PageHero>
        <Page>
          <Section id="what" title={d.what.title} lead={d.what.lead} spacing="sm">
            <ul className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
              {(["line", "file", "find"] as const).map((id) => (
                <li key={id} className="flex flex-col gap-1">
                  <h3 className="m-0 text-base font-semibold text-fg">{d.what.items[id].title}</h3>
                  <p className="m-0 text-sm leading-relaxed text-fg-secondary">{d.what.items[id].text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-[70ch] text-sm text-fg-secondary">{d.what.who}</p>
          </Section>
          <Section id="proof" title={d.proof.title} lead={d.proof.lead} spacing="sm" divider>
            <div className="max-w-3xl rounded-lg border border-border-default" data-testid="proof-run">
              <BeforeAfter locale={locale} />
            </div>
            <p className="mt-4 text-sm text-fg-secondary">{format(d.proof.figures, { rules: figures.rules, found: figures.found })}</p>
            <p className="mt-1 font-mono text-xs text-fg-muted" data-testid="proof-meta">
              {d.proof.runLabel} {run.runId} · {d.proof.dateLabel} {new Date(run.recordedAt).toLocaleDateString(DATE[locale], { dateStyle: "long", timeZone: "America/Toronto" })} · {d.proof.rulesetLabel} {run.report.rulesetId} {run.report.rulesetVersion}
            </p>
            <p className="mt-6 max-w-[70ch] text-sm text-fg-secondary">{d.what.trust}</p>
            <p className="mt-1 text-sm">
              <Link href={pagePath(locale, "privacy")} className="text-fg-accent underline underline-offset-4">
                {d.what.privacy}
              </Link>
            </p>
            <p className="mt-6 text-xs text-fg-muted" data-testid="powered-by">
              {d.proof.powered}
            </p>
          </Section>
        </Page>
        </main>
      </BarQueryRoot>
      <SiteFooter locale={locale} />
    </>
  );
}

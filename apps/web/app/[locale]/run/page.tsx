import { Button } from "@krizaka/ui/button";
import { CtaPanel } from "@krizaka/ui/cta-panel";
import { Page, Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import { PERSPECTIVES } from "@yomizaka/core";
import type { Metadata } from "next";
import Link from "next/link";

import { ShowcaseRun } from "@/components/ShowcaseRun";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, format, getDictionary } from "@/lib/i18n";
import { contractRun, INVOICE_SIDES, invoiceRun, recordedRun } from "@/lib/recorded-runs";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { SIDE_ANCHORS } from "@/lib/sides";
import { contactHref, pagePath } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "run");
}

/**
 * A real run, at its own address, once per side of the lease: the sample lease sent to Orazaka's compliance Studio on dev,
 * and what came back, exactly as recorded (`content/recorded-runs/`, written by `scripts/record-runs.mjs`), with an unsigned
 * specimen of the report. Static: built from the recordings; a missing recording fails the build (lib/recorded-runs.ts).
 */
export default async function RunPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="run" />
      <main id="content" className="pt-20">
        <PageHero back={{ href: pagePath(locale, "home"), label: t.meta.siteName }} linkAs={Link} eyebrow={t.run.eyebrow} title={t.run.title} lead={t.run.lead} />
        <Page>
          {[...PERSPECTIVES, ...INVOICE_SIDES, "contract" as const].map((side) => {
            const run = side === "contract" ? contractRun() : side === "freelancer" || side === "business" ? invoiceRun(side) : recordedRun(side);
            const w = t.run.sides[side];
            return (
              <Section key={side} id={side === "contract" ? "contract" : SIDE_ANCHORS[locale][side]} spacing="sm" title={w.title} lead={w.lead} divider>
                <p className="mb-4 font-mono text-xs text-fg-muted" data-testid={`recorded-${side}`}>
                  {format(t.run.recorded, { date: new Date(run.recordedAt).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long", timeZone: "America/Toronto" }), source: new URL(run.source).host, run: run.runId })}
                </p>
                <ShowcaseRun run={run} locale={locale} />
              </Section>
            );
          })}
          <Section spacing="sm">
            <CtaPanel title={t.landing.closing.title} body={t.landing.closing.body}>
              <Button asChild variant="primary" size="lg">
                <a href={contactHref("dev-yomizaka-run")}>{t.landing.talk}</a>
              </Button>
            </CtaPanel>
          </Section>
        </Page>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

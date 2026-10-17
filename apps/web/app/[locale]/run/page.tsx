import { Button } from "@krizaka/ui/button";
import { CtaPanel } from "@krizaka/ui/cta-panel";
import { Page, Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { ShowcaseRun } from "@/components/ShowcaseRun";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { asLocale, getDictionary, type Locale } from "@/lib/i18n";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { getShowcaseView } from "@/lib/showcase";
import { contactHref, pagePath } from "@/lib/site";

/** The « real run » comes from the platform itself, read at request time and kept five minutes (ISR) — never a copy in the repository. */
export const revalidate = 300;

type Run = Awaited<ReturnType<typeof getShowcaseView>>;

/** The promoted check, or null when nothing is promoted or the platform cannot be reached: the page then says so. */
async function loadRun(locale: Locale): Promise<Run> {
  try {
    return await getShowcaseView(locale);
  } catch (error) {
    console.error("run: the showcase run could not be read", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "run");
}

/** A real run, at its own address: the Québec lease an administrator promoted, as Orazaka returned it, its signed report. */
export default async function RunPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  const run = await loadRun(locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="run" />
      <main id="content" className="pt-20">
        <PageHero back={{ href: pagePath(locale, "home"), label: t.meta.siteName }} linkAs={Link} eyebrow={t.run.eyebrow} title={t.run.title} lead={t.run.lead} />
        <Page>
          <Section spacing="sm">{run ? <ShowcaseRun run={run} locale={locale} /> : <p className="max-w-2xl text-fg-secondary">{t.run.none}</p>}</Section>
          <Section spacing="sm">
            <CtaPanel title={t.landing.closing.title} body={t.landing.closing.body}>
              <Button asChild variant="primary" size="lg" shape="cut">
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

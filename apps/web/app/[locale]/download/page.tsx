import { Badge } from "@krizaka/ui/badge";
import { Page, Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { DOWNLOAD_STATE, DOWNLOADS, downloadState } from "@/lib/downloads";
import { asLocale, getDictionary } from "@/lib/i18n";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { pagePath } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(asLocale((await params).locale), "download");
}

/** Where the apps are: a card per platform, « soon » until its link exists. */
export default async function Download({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="download" />
      <main id="content" className="pt-20">
        <PageHero back={{ href: pagePath(locale, "home"), label: t.meta.siteName }} linkAs={Link} title={t.download.title} backdrop="plain" lead={t.download.lead} />
        <Page>
          <Section>
            <ul className="grid gap-4 sm:grid-cols-3">
              {DOWNLOADS.map((download) => {
                const platform = t.download.platforms[download.id];
                const available = downloadState(download) === DOWNLOAD_STATE.available;
                return (
                  <li key={download.id} className="flex flex-col gap-3 rounded-lg border border-border-default p-5" data-state={downloadState(download)}>
                    <h2 className="text-lg font-semibold">{platform.name}</h2>
                    <p className="text-sm text-fg-secondary">{platform.body}</p>
                    {available && download.href ? (
                      <a className="text-sm font-medium text-accent underline" href={download.href}>
                        {t.download.get}
                      </a>
                    ) : (
                      <Badge>{t.download.soon}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        </Page>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

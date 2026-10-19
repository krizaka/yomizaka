import type { Metadata } from "next";

import { ChangelogBody } from "@/components/ChangelogBody";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { CHANGELOG_REPO, loadReleases } from "@/lib/changelog";
import { asLocale, getDictionary } from "@/lib/i18n";
import { uiVersion } from "@/lib/platform";
import { pageMetadata, siteJsonLd } from "@/lib/seo";
import { APP_VERSION, pagePath } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const meta = pageMetadata(locale, "changelog");
  return { ...meta, alternates: { ...meta.alternates, types: { "application/rss+xml": `${pagePath(locale, "changelog")}/feed.xml` } } };
}

/** `/changelog` (changelog template): the weeks of merged work, read from GitHub (refreshed hourly). */
export default async function Changelog({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(locale)) }} />
      <SiteHeader locale={locale} current="changelog" />
      <main id="content" className="pt-20">
        <ChangelogBody
          c={t.changelog}
          releases={await loadReleases()}
          version={APP_VERSION}
          ui={uiVersion()}
          back={{ href: pagePath(locale, "home"), label: t.meta.siteName }}
          feedHref={`${pagePath(locale, "changelog")}/feed.xml`}
          pullsUrl={`https://github.com/${CHANGELOG_REPO}/pulls?q=is%3Apr+is%3Amerged`}
        />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}

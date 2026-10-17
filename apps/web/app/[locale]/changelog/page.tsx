import type { Metadata } from "next";

import { ChangelogBody } from "@/components/ChangelogBody";
import { SiteHeader } from "@/components/SiteChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { CHANGELOG_REPO, loadReleases } from "@/lib/changelog";
import { asLocale, getDictionary, LOCALES } from "@/lib/i18n";
import { uiVersion } from "@/lib/platform";
import { APP_VERSION, pagePath, SITE_URL } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const c = getDictionary(locale).changelog;
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: {
      canonical: `${SITE_URL}${pagePath(locale, "changelog")}`,
      languages: { ...Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}${pagePath(l, "changelog")}`])), "x-default": `${SITE_URL}${pagePath("en", "changelog")}` },
      types: { "application/rss+xml": `${pagePath(locale, "changelog")}/feed.xml` },
    },
  };
}

/** `/changelog` (changelog template): the weeks of merged work, read from GitHub (refreshed hourly). */
export default async function Changelog({ params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const t = getDictionary(locale);
  return (
    <>
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

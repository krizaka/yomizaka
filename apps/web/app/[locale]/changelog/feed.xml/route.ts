import { changelogRss } from "@krizaka/ui/changelog-page";

import { loadReleases } from "@/lib/changelog";
import { asLocale, getDictionary } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

// RSS 2.0 of the changelog, in the page's language, refreshed hourly from the same pull requests as the page.
export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const locale = asLocale((await params).locale);
  const c = getDictionary(locale).changelog;
  const page = `${SITE_URL}/${locale}/changelog`;
  const xml = changelogRss({
    releases: await loadReleases(),
    title: c.feedTitle,
    description: c.feedDescription,
    siteUrl: SITE_URL,
    pageUrl: page,
    feedUrl: `${page}/feed.xml`,
    language: c.langTag,
    tagLabel: c.tags,
  });
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

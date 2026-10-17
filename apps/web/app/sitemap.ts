import type { MetadataRoute } from "next";

import { LOCALES } from "@/lib/i18n";
import { SIDE_LANDINGS, sideUrl } from "@/lib/sides";
import { pagePath, PAGES, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  // /verify is members-only (ADR-0002): it redirects to sign-in, so it is not a page to index.
  const pages = PAGES.filter((page) => page !== "verify").flatMap((page) => {
    const languages = { ...Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}${pagePath(l, page)}`])), "x-default": `${SITE_URL}${pagePath("en", page)}` };
    return LOCALES.map((l) => ({ url: `${SITE_URL}${pagePath(l, page)}`, lastModified, alternates: { languages } }));
  });
  // The two sides of the lease each have a landing, in both languages, each language alternate of the other.
  const sides = SIDE_LANDINGS.map(({ locale, side }) => ({
    url: sideUrl(locale, side),
    lastModified,
    alternates: { languages: { ...Object.fromEntries(LOCALES.map((l) => [l, sideUrl(l, side)])), "x-default": sideUrl("en", side) } },
  }));
  return [...pages, ...sides];
}

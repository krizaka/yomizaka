import type { MetadataRoute } from "next";

import { downloadsOffered } from "@/lib/downloads";
import { LOCALES } from "@/lib/i18n";
import { pagePath, PAGES, SITE_URL } from "@/lib/site";

/** The public pages, in both languages, each the other's hreflang alternate. /download is listed only once an app can be downloaded (yomizaka#389). */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.filter((page) => page !== "download" || downloadsOffered()).flatMap((page) => {
    const languages = { ...Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}${pagePath(l, page)}`])), "x-default": `${SITE_URL}${pagePath("fr", page)}` };
    return LOCALES.map((l) => ({ url: `${SITE_URL}${pagePath(l, page)}`, lastModified, alternates: { languages } }));
  });
}

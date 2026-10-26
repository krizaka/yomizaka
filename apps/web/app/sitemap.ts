import type { MetadataRoute } from "next";

import { LOCALES } from "@/lib/i18n";
import { isListed } from "@/lib/listed";
import { pagePath, PAGES, SITE_URL } from "@/lib/site";

/** The public pages, in both languages, each the other's hreflang alternate. A parked or held page is listed only once it is public (lib/listed.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.filter(isListed).flatMap((page) => {
    const languages = { ...Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}${pagePath(l, page)}`])), "x-default": `${SITE_URL}${pagePath("fr", page)}` };
    return LOCALES.map((l) => ({ url: `${SITE_URL}${pagePath(l, page)}`, lastModified, alternates: { languages } }));
  });
}

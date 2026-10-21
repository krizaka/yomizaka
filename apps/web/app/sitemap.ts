import type { MetadataRoute } from "next";

import { LOCALES } from "@/lib/i18n";
import { pagePath, PAGES, SITE_URL } from "@/lib/site";

/** The home and the privacy notice, in both languages, each the other's hreflang alternate. /verify is for members (it redirects to sign-in): not listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.filter((page) => page !== "verify").flatMap((page) => {
    const languages = { ...Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}${pagePath(l, page)}`])), "x-default": `${SITE_URL}${pagePath("en", page)}` };
    return LOCALES.map((l) => ({ url: `${SITE_URL}${pagePath(l, page)}`, lastModified, alternates: { languages } }));
  });
}

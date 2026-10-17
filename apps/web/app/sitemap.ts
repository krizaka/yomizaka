import type { MetadataRoute } from "next";

import { appEnvironment } from "@/lib/env";
import { audiencesOf, availableFlows } from "@/lib/flows";
import { LOCALES } from "@/lib/i18n";
import { SIDE_LANDINGS, sideUrl } from "@/lib/sides";
import { pagePath, PAGES, SITE_URL } from "@/lib/site";

// The audience pages listed are the ones an enabled flow offers (ADR-0003); re-read every five minutes.
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const offered = new Set(audiencesOf(await availableFlows(appEnvironment())).map((a) => a.audience));
  const lastModified = new Date();
  // /verify is members-only (ADR-0002): it redirects to sign-in, so it is not a page to index.
  const pages = PAGES.filter((page) => page !== "verify").flatMap((page) => {
    const languages = { ...Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}${pagePath(l, page)}`])), "x-default": `${SITE_URL}${pagePath("en", page)}` };
    return LOCALES.map((l) => ({ url: `${SITE_URL}${pagePath(l, page)}`, lastModified, alternates: { languages } }));
  });
  // The two sides of the lease each have a landing, in both languages, each language alternate of the other.
  const sides = SIDE_LANDINGS.filter(({ side }) => offered.has(side)).map(({ locale, side }) => ({
    url: sideUrl(locale, side),
    lastModified,
    alternates: { languages: { ...Object.fromEntries(LOCALES.map((l) => [l, sideUrl(l, side)])), "x-default": sideUrl("en", side) } },
  }));
  return [...pages, ...sides];
}

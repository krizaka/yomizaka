import { type Audience, AUDIENCES } from "@yomizaka/core";

import { type Locale } from "./i18n";
import { SITE_URL } from "./site";

/**
 * Each audience (tenant, landlord, freelancer, business) gets its own landing, at their own address (static, indexable, one per language):
 * `/fr/locataire` · `/fr/proprietaire` · `/fr/travailleur-autonome` · `/fr/entreprise` · `/en/tenant` · `/en/landlord` · `/en/freelancer` · `/en/business`. The slug is the language's word for the side; the
 * other language's slug redirects to it. Structure only — the words are messages (`sides.*`).
 */
export const SIDE_SLUGS: Record<Locale, Record<Audience, string>> = {
  fr: { tenant: "locataire", landlord: "proprietaire", freelancer: "travailleur-autonome", business: "entreprise" },
  en: { tenant: "tenant", landlord: "landlord", freelancer: "freelancer", business: "business" },
};

export const sidePath = (locale: Locale, side: Audience) => `/${locale}/${SIDE_SLUGS[locale][side]}`;
export const sideUrl = (locale: Locale, side: Audience) => `${SITE_URL}${sidePath(locale, side)}`;

/** The side a path segment names, in any language, and the language it belongs to; null for any other segment. */
export function sideOfSlug(slug: string): { side: Audience; slugLocale: Locale } | null {
  for (const locale of ["fr", "en"] as const) {
    for (const side of AUDIENCES) if (SIDE_SLUGS[locale][side] === slug) return { side, slugLocale: locale };
  }
  return null;
}

/** Every side landing, for the sitemap: both sides in both languages. */
export const SIDE_LANDINGS = (["en", "fr"] as const).flatMap((locale) => AUDIENCES.map((side) => ({ locale, side })));

/** The anchors of the two sides on /run, in the page's language. */
export const SIDE_ANCHORS = SIDE_SLUGS;

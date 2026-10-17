import { type Perspective, PERSPECTIVES } from "@yomizaka/core";

import { type Locale } from "./i18n";
import { SITE_URL } from "./site";

/**
 * The two sides of the lease get their own landing, at their own address (static, indexable, one per language):
 * `/fr/locataire` · `/fr/proprietaire` · `/en/tenant` · `/en/landlord`. The slug is the language's word for the side; the
 * other language's slug redirects to it. Structure only — the words are messages (`sides.*`).
 */
export const SIDE_SLUGS: Record<Locale, Record<Perspective, string>> = {
  fr: { tenant: "locataire", landlord: "proprietaire" },
  en: { tenant: "tenant", landlord: "landlord" },
};

export const sidePath = (locale: Locale, side: Perspective) => `/${locale}/${SIDE_SLUGS[locale][side]}`;
export const sideUrl = (locale: Locale, side: Perspective) => `${SITE_URL}${sidePath(locale, side)}`;

/** The side a path segment names, in any language, and the language it belongs to; null for any other segment. */
export function sideOfSlug(slug: string): { side: Perspective; slugLocale: Locale } | null {
  for (const locale of ["fr", "en"] as const) {
    for (const side of PERSPECTIVES) if (SIDE_SLUGS[locale][side] === slug) return { side, slugLocale: locale };
  }
  return null;
}

/** Every side landing, for the sitemap: both sides in both languages. */
export const SIDE_LANDINGS = (["en", "fr"] as const).flatMap((locale) => PERSPECTIVES.map((side) => ({ locale, side })));

/** The anchors of the two sides on /run, in the page's language. */
export const SIDE_ANCHORS = SIDE_SLUGS;

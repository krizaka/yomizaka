/**
 * The language of a page that does not exist. A global 404 has no route params, so the proxy writes the language of the
 * address into a request header and the not-found page reads it back. Pure and dependency-free, so the proxy can use it.
 */
export const NOT_FOUND_LOCALE_HEADER = "x-yomizaka-locale";

const LOCALES = ["en", "fr"] as const;
export type NotFoundLocale = (typeof LOCALES)[number];

/** The address's language (`/fr/…`), else the visitor's choice (cookie `NEXT_LOCALE`, resolved by the proxy). */
export function localeForAddress(pathname: string, chosen: NotFoundLocale): NotFoundLocale {
  const segment = pathname.split("/")[1] ?? "";
  return (LOCALES as readonly string[]).includes(segment) ? (segment as NotFoundLocale) : chosen;
}

/** The header read back by the not-found page; anything else is English. */
export function localeFromHeader(value: string | null | undefined): NotFoundLocale {
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as NotFoundLocale) : "en";
}

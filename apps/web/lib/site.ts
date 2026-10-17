/** Addresses of the site — structure, not words (the words are in messages/). */
export const SITE_URL = "https://dev.yomizaka.com";
export const REPO_URL = "https://github.com/krizaka/yomizaka";
/** Krizaka, the publisher: named only in the footer and the legal mentions (the products are independent). */
export const KRIZAKA_URL = "https://www.krizaka.com";
export const PRIVACY_UPDATED = "2026-10-14";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

/** The public pages, in both languages (sitemap, hreflang). */
export const PAGES = ["home", "run", "verify", "privacy"] as const;
export type PageId = (typeof PAGES)[number];
export const pagePath = (locale: "en" | "fr", page: PageId) => (page === "home" ? `/${locale}` : `/${locale}/${page}`);

/** Krizaka's contact form, Yomizaka pre-selected. */
export function contactHref(source: string): string {
  return `${KRIZAKA_URL}/contact?topic=yomizaka&source=${encodeURIComponent(source)}`;
}

/** Where sign-in returns to: a path of this site in the page's language, never another address (no open redirect). */
export function safeNext(next: string | undefined, locale: "en" | "fr"): string {
  const home = `/${locale}/app`;
  if (!next || !next.startsWith(`/${locale}/`) || next.startsWith("//") || next.includes("\\") || [...next].some((c) => c.charCodeAt(0) < 32)) return home;
  return next;
}

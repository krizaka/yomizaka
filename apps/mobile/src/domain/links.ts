import { type DocumentTab, movedDocumentTab, parseTagsParam, tagsHref } from "@yomizaka/core";

/**
 * The URL is the state (addendum 2026-10-17): every screen has the path the web has, under the language, so a link to the
 * web opens the app when it is installed (`associatedDomains`, Android `autoVerify`) and a deep link opens the web.
 */
export type Locale = "fr" | "en";
export const LOCALES: readonly Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "fr";

export const asLocale = (value: string | null | undefined): Locale => LOCALES.find((l) => l === value?.slice(0, 2)) ?? DEFAULT_LOCALE;

const app = (locale: Locale, ...parts: string[]) => ["", locale, "app", ...parts].join("/");

export const routes = {
  verify: (locale: Locale) => app(locale, "verifier"),
  library: (locale: Locale, library?: string, collection?: string, tags: readonly string[] = []) =>
    tagsHref(app(locale, "bibliotheque", ...[library, library ? collection : undefined].filter((p): p is string => !!p)), tags),
  document: (locale: Locale, id: string, tab: DocumentTab = "rapport") => app(locale, "documents", id, tab),
  settings: (locale: Locale) => app(locale, "settings"),
} as const;

/** An old document address (`/infos`, `/verifications`…) opens the tab it moved to, the followed run kept (`?analysis=`); an unknown tab opens the report. */
export const legacyDocumentHref = (locale: Locale, id: string, tab: string, analysis?: string | null): string => `${routes.document(locale, id, movedDocumentTab(tab) ?? "rapport")}${analysis ? `?analysis=${encodeURIComponent(analysis)}` : ""}`;

export { parseTagsParam };

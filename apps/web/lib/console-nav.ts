import { DOCUMENT_TABS, type DocumentTab, movedDocumentTab } from "@yomizaka/core";

/**
 * The signed-in space's navigation, as data and pure functions (the active state comes from the route, never from local
 * state). Orazaka's pattern (krizaka/yomizaka#278, the UX review of October 2026): the rail holds destinations only —
 * Bibliothèque · Vérifications · Recherche —, the account owns the settings, and the header owns the one action of every
 * screen, « Vérifier un document », whose task page (`check`) lights Vérifications.
 */
export type NavId = "library" | "checks" | "search" | "account";

export const CONSOLE_ROUTES = { library: "/app", checks: "/app/verifications", check: "/app/verifier", search: "/app/recherche", account: "/app/settings" } as const;

/** The tabs of the Vérifications destination; the second lives in the address: `/app/verifications?tab=lots`. */
export const CHECKS_TABS = ["checks", "lots"] as const;
export type ChecksTab = (typeof CHECKS_TABS)[number];
export const CHECKS_TAB_KEY = "tab";
/** The tab named by the address; an unknown or missing one is the list of checks (a stale link never breaks the page). */
export const checksTabOf = (raw: string | null | undefined): ChecksTab => CHECKS_TABS.find((t) => t === raw) ?? "checks";
/** The address of a tab: the first keeps the address clean, the others name themselves. */
export const checksTabHref = (locale: "en" | "fr", tab: ChecksTab): string => `/${locale}${CONSOLE_ROUTES.checks}${tab === CHECKS_TABS[0] ? "" : `?${CHECKS_TAB_KEY}=${tab}`}`;

/** The path without its language segment: `/fr/app/documents/x` → `/app/documents/x`. */
export const withoutLocale = (path: string) => path.replace(/^\/(en|fr)(?=\/|$)/, "") || "/";

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** Which rail entry a path belongs to. A document and a collection belong to the library, the task page to the checks; an unknown path to none. */
export function activeNav(path: string): NavId | null {
  const p = withoutLocale(path).replace(/\/$/, "") || "/";
  if (under(p, CONSOLE_ROUTES.checks) || under(p, CONSOLE_ROUTES.check)) return "checks";
  if (under(p, CONSOLE_ROUTES.search) || under(p, "/app/search")) return "search";
  if (under(p, CONSOLE_ROUTES.account)) return "account";
  if (p === CONSOLE_ROUTES.library || under(p, "/app/documents") || under(p, "/app/bibliotheque") || under(p, "/app/screening")) return "library";
  return null;
}

/** The tabs of a document, each a route: /documents/[id]/<tab> (the URL is the state). */
export { DOCUMENT_TABS, type DocumentTab };
export const isDocumentTab = (v: string): v is DocumentTab => (DOCUMENT_TABS as readonly string[]).includes(v);

/** The settings' sections, each a route: /app/settings/<section> (the URL is the state). */
export const SETTINGS_SECTIONS = ["profil", "securite", "facturation", "stockage", "donnees"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export const isSettingsSection = (v: string): v is SettingsSection => (SETTINGS_SECTIONS as readonly string[]).includes(v);

/** A page's `searchParams` as `URLSearchParams` (a repeated key kept, an absent one dropped). */
export const searchOf = (params: Record<string, string | string[] | undefined>): URLSearchParams => new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]])));

/** The 308 of an old tab address, its query kept (`/verifications?refused=PAYWALL` → `/rapport?refused=PAYWALL`); null when the tab did not move. */
export function movedDocumentHref(locale: "en" | "fr", id: string, tab: string, search: string | URLSearchParams = ""): string | null {
  const moved = movedDocumentTab(tab);
  if (!moved) return null;
  const qs = new URLSearchParams(search).toString();
  return `/${locale}/app/documents/${id}/${moved}${qs ? `?${qs}` : ""}`;
}

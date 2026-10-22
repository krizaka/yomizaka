/**
 * The signed-in space's navigation, as data and pure functions (the active state comes from the route, never from local
 * state). Rail: Library · Check · Search, then Account (and Administration for an administrator, on its own host).
 */
export type NavId = "library" | "check" | "search" | "account";

export const CONSOLE_ROUTES = { library: "/app", check: "/app/verifier", search: "/app/recherche", account: "/app/settings" } as const;

/** The path without its language segment: `/fr/app/documents/x` → `/app/documents/x`. */
export const withoutLocale = (path: string) => path.replace(/^\/(en|fr)(?=\/|$)/, "") || "/";

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** Which rail entry a path belongs to. A document belongs to the library; an unknown path to none. */
export function activeNav(path: string): NavId | null {
  const p = withoutLocale(path).replace(/\/$/, "") || "/";
  if (under(p, CONSOLE_ROUTES.check)) return "check";
  if (under(p, CONSOLE_ROUTES.search) || under(p, "/app/search")) return "search";
  if (under(p, CONSOLE_ROUTES.account)) return "account";
  if (p === CONSOLE_ROUTES.library || under(p, "/app/documents") || under(p, "/app/screening")) return "library";
  return null;
}

/** The title the top bar shows: the page, never the navigation. */
export type TitleId = "welcome" | "library" | "check" | "search" | "document" | "account" | "screening";
export function titleOf(path: string): TitleId {
  const p = withoutLocale(path);
  if (under(p, "/app/documents")) return "document";
  if (under(p, "/app/screening")) return "screening";
  if (under(p, "/app/bienvenue")) return "welcome";
  return activeNav(path) ?? "library";
}

/** The tabs of a document, each a route: /documents/[id]/<tab> (the URL is the state). */
export const DOCUMENT_TABS = ["infos", "verifications", "fichier", "texte"] as const;
export type DocumentTab = (typeof DOCUMENT_TABS)[number];
export const isDocumentTab = (v: string): v is DocumentTab => (DOCUMENT_TABS as readonly string[]).includes(v);

/** The settings' sections, each a route: /app/settings/<section> (the URL is the state). */
export const SETTINGS_SECTIONS = ["profil", "securite", "facturation", "donnees"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export const isSettingsSection = (v: string): v is SettingsSection => (SETTINGS_SECTIONS as readonly string[]).includes(v);

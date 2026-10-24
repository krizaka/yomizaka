import { type PageId, pagePath } from "./site";

/**
 * The public menu, in one place: structure only (the words are `chrome.nav.<id>`). Every public page of the site is
 * reachable from it, the home through the mark: the home's two sections, the legal page, and sign-in (the bar's action).
 */
export const MENU = [
  { id: "what", page: "home", hash: "#what" },
  { id: "proof", page: "home", hash: "#proof" },
  { id: "pricing", page: "pricing", hash: "" },
  { id: "privacy", page: "privacy", hash: "" },
] as const satisfies readonly { id: string; page: PageId; hash: string }[];

export type MenuId = (typeof MENU)[number]["id"];

/** Where a menu item leads in a language. */
export const menuHref = (locale: "en" | "fr", item: (typeof MENU)[number]): string => `${pagePath(locale, item.page)}${item.hash}`;

/** The sign-in page, the bar's action. */
export const signInPath = (locale: "en" | "fr"): string => `/${locale}/sign-in`;

/** The home's anchors the menu points to: each must be an id on the home page. */
export const HOME_ANCHORS = MENU.filter((m) => m.hash).map((m) => m.hash.slice(1));

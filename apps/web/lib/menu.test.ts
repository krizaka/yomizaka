import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import config from "../next.config.mjs";
import { HOME_ANCHORS, MENU, menuHref, signInPath } from "./nav";
import { OLD_AUDIENCE_SLUGS, redirectRules } from "./removed-urls.mjs";
import { pagePath, PAGES } from "./site";

/**
 * Simplify Yomizaka (krizaka/yomizaka#120): the public site is the home, sign-in and the privacy notice. Every item of the
 * menu resolves to a page or an anchor that exists, and every address that was removed answers 308 to its new home.
 */
const ROOT = join(__dirname, "..");
const pageFile = (page: string) => join(ROOT, "app/[locale]", page === "home" ? "" : page, "page.tsx");

describe("every menu item resolves", () => {
  it("each item leads to a page that exists, in both languages", () => {
    for (const item of MENU) {
      expect(PAGES, item.id).toContain(item.page);
      expect(existsSync(pageFile(item.page)), item.id).toBe(true);
      for (const locale of ["en", "fr"] as const) expect(menuHref(locale, item).startsWith(`/${locale}`)).toBe(true);
    }
  });

  it("each anchor is a section id of the home", () => {
    const home = readFileSync(pageFile("home"), "utf8");
    expect(HOME_ANCHORS.length).toBeGreaterThan(0);
    for (const anchor of HOME_ANCHORS) expect(home, anchor).toContain(`id="${anchor}"`);
  });

  it("sign-in exists and is the bar's action; the menu stays short", () => {
    expect(existsSync(join(ROOT, "app/[locale]/(app)/sign-in/page.tsx"))).toBe(true);
    expect(signInPath("fr")).toBe("/fr/sign-in");
    expect(MENU.length).toBeLessThanOrEqual(4);
  });

  it("every public page is reachable from the bar (the terms and the downloads from the footer): the home by the mark, the others by the menu or the action", () => {
    const reachable = new Set<string>(["home", ...MENU.map((m) => m.page)]);
    for (const page of PAGES.filter((p) => p !== "verify" && p !== "terms" && p !== "download")) expect(reachable.has(page), page).toBe(true);
    expect(pagePath("en", "home")).toBe("/en");
  });

  it("the labels exist in both languages", async () => {
    const en = (await import("@/messages/en.json")).default;
    const fr = (await import("@/messages/fr.json")).default;
    for (const item of MENU) {
      expect(en.chrome.nav[item.id]).toBeTruthy();
      expect(fr.chrome.nav[item.id]).toBeTruthy();
    }
  });
});

describe("every removed address redirects (308) to its new home", () => {
  const rules = redirectRules();
  const redirects = (config as { redirects: () => Promise<{ source: string; destination: string; permanent: boolean }[]> }).redirects;

  it("next.config serves exactly these rules, all permanent (308)", async () => {
    expect(await redirects()).toEqual(rules);
    for (const rule of rules) expect(rule.permanent).toBe(true);
  });

  it("covers the run page, the changelog (and its feed) and the eight audience pages, with and without a language", () => {
    const sources = new Set(rules.map((r) => r.source));
    for (const path of ["/run", "/changelog", "/changelog/feed.xml", ...OLD_AUDIENCE_SLUGS.map((s) => `/${s}`)]) {
      for (const prefix of ["/en", "/fr", ""]) expect(sources.has(`${prefix}${path}`), `${prefix}${path}`).toBe(true);
    }
  });

  it("leads each one to the home of its language, or to the proof for the run page", () => {
    for (const rule of rules) {
      const locale = rule.source.match(/^\/(en|fr)\//)?.[1];
      const target = rule.source.endsWith("/run") ? "#proof" : "";
      expect(rule.destination).toBe(locale ? `/${locale}${target}` : `/${target}`);
    }
  });

  it("no page file is left behind a removed address", () => {
    for (const dir of ["run", "changelog", "[side]", "tenant", "landlord", "locataire"]) expect(existsSync(join(ROOT, "app/[locale]", dir)), dir).toBe(false);
  });

  it("no destination is itself removed (no chain)", () => {
    const sources = new Set(rules.map((r) => r.source));
    for (const rule of rules) expect(sources.has(rule.destination.split("#")[0]), rule.destination).toBe(false);
  });
});

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { activeNav, CONSOLE_ROUTES, DOCUMENT_TABS, isDocumentTab, titleOf, withoutLocale } from "./console-nav";

const ROOT = join(__dirname, "..");
const app = (p: string) => join(ROOT, "app/[locale]/(app)/app", p);

describe("the rail's active entry comes from the route", () => {
  it.each([
    ["/fr/app", "library"],
    ["/en/app/documents/abc/verifications", "library"],
    ["/fr/app/verifier", "check"],
    ["/fr/app/recherche?q=bail".split("?")[0]!, "search"],
    ["/fr/app/search", "search"],
    ["/fr/app/settings", "account"],
    ["/fr/app/settings/profil", "account"],
    ["/fr/app/screening", "library"],
  ])("%s → %s", (path, nav) => expect(activeNav(path)).toBe(nav));
  it("an unknown path belongs to no entry", () => {
    expect(activeNav("/fr/elsewhere")).toBeNull();
  });
  it("the top bar shows the page, not the navigation", () => {
    expect(titleOf("/fr/app/documents/abc/texte")).toBe("document");
    expect(titleOf("/fr/app/recherche")).toBe("search");
    expect(titleOf("/en/app/verifier")).toBe("check");
  });
  it("strips the language segment only", () => {
    expect(withoutLocale("/fr/app/x")).toBe("/app/x");
    expect(withoutLocale("/frog/app")).toBe("/frog/app");
  });
});

describe("tabs are routes: the URL is the state", () => {
  it("each document tab has its own route, and an unknown one is not a tab", () => {
    expect(DOCUMENT_TABS).toEqual(["infos", "verifications", "fichier", "texte"]);
    expect(isDocumentTab("texte")).toBe(true);
    expect(isDocumentTab("nope")).toBe(false);
    expect(existsSync(app("documents/[id]/[tab]/page.tsx"))).toBe(true);
  });
  it("a bare document address opens on its information (a redirect), and an unknown tab is a 404", () => {
    expect(readFileSync(app("documents/[id]/page.tsx"), "utf8")).toContain("/infos");
    expect(readFileSync(app("documents/[id]/[tab]/page.tsx"), "utf8")).toMatch(/isDocumentTab\(tab\)\) notFound\(\)/);
  });
  it("the view takes its tab from the route and a click navigates (no local tab state)", () => {
    const view = readFileSync(join(ROOT, "components/console/DocumentView.tsx"), "utf8");
    expect(view).toContain("value={tab}");
    expect(view).toContain("router.push(`/${locale}/app/documents/${initial.id}/${next}`");
    expect(view).not.toMatch(/useState\([^)]*"(file|text)"/);
  });
  it("search keeps its query in the address, and the old address redirects", () => {
    expect(CONSOLE_ROUTES.search).toBe("/app/recherche");
    expect(existsSync(app("recherche/page.tsx"))).toBe(true);
    expect(readFileSync(app("search/page.tsx"), "utf8")).toContain("redirect(");
    expect(readFileSync(join(ROOT, "components/console/SearchView.tsx"), "utf8")).toContain("router.replace");
  });
  it("the rail has no local active state", () => {
    const shell = readFileSync(join(ROOT, "components/console/ConsoleShell.tsx"), "utf8");
    expect(shell).toContain("activeNav(path)");
    expect(shell).not.toMatch(/useState/);
  });
});

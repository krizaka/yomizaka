import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import sitemap from "../app/sitemap";
import { SideSwitch } from "../components/SideSwitch";
import { llmsText } from "./seo";
import { SIDE_LANDINGS, sideOfSlug, sidePath, sideUrl } from "./sides";

const ROOT = join(__dirname, "..");

describe("the two sides of the lease have their own address", () => {
  it("one per side and language, in each language's word", () => {
    expect(sidePath("fr", "tenant")).toBe("/fr/locataire");
    expect(sidePath("fr", "landlord")).toBe("/fr/proprietaire");
    expect(sidePath("en", "tenant")).toBe("/en/tenant");
    expect(sidePath("en", "landlord")).toBe("/en/landlord");
    expect(SIDE_LANDINGS).toHaveLength(4);
  });

  it("reads a slug in either language (the other language's word redirects), nothing else", () => {
    expect(sideOfSlug("locataire")).toEqual({ side: "tenant", slugLocale: "fr" });
    expect(sideOfSlug("landlord")).toEqual({ side: "landlord", slugLocale: "en" });
    for (const other of ["run", "verify", "privacy", "app", "sign-in", "owner", ""]) expect(sideOfSlug(other)).toBeNull();
  });

  it("is in the sitemap in both languages, each the other's alternate", () => {
    const urls = sitemap().map((e) => e.url);
    for (const { locale, side } of SIDE_LANDINGS) expect(urls).toContain(sideUrl(locale, side));
    const fr = sitemap().find((e) => e.url === sideUrl("fr", "tenant"));
    expect(fr?.alternates?.languages).toMatchObject({ en: sideUrl("en", "tenant"), fr: sideUrl("fr", "tenant") });
  });

  it("is named in llms.txt", () => {
    expect(llmsText()).toMatch(/\/en\/tenant/);
    expect(llmsText()).toMatch(/\/en\/landlord/);
  });

  it("has its own SEO title and description per side and language — four different pairs", () => {
    const pairs = [en, fr].flatMap((d) => [d.sides.tenant, d.sides.landlord].map((s) => `${s.seoTitle}|${s.seoDescription}`));
    expect(new Set(pairs).size).toBe(4);
    for (const d of [en, fr]) for (const s of [d.sides.tenant, d.sides.landlord]) expect(s.seoDescription.length).toBeLessThanOrEqual(220);
  });

  it("pre-renders every address (8: each side's slug in both languages, so the other language's word redirects)", () => {
    const page = readFileSync(join(ROOT, "app/[locale]/[side]/page.tsx"), "utf8");
    expect(page).toContain("export const dynamicParams = false");
    expect(page).toContain("generateStaticParams");
    expect(page).toContain("permanentRedirect");
  });
});

describe("the switch — « Je suis locataire / Je suis propriétaire »", () => {
  const words = { tenant: fr.sides.tenant.switch, landlord: fr.sides.landlord.switch };
  it("is two crawlable links to the two addresses, the current one marked", () => {
    const home = renderToStaticMarkup(createElement(SideSwitch, { locale: "fr", label: fr.sides.switchLabel, hint: fr.landing.switchHint, words }));
    expect(home).toContain('href="/fr/locataire"');
    expect(home).toContain('href="/fr/proprietaire"');
    expect(home).not.toContain("aria-current");
    const tenant = renderToStaticMarkup(createElement(SideSwitch, { locale: "fr", current: "tenant", label: fr.sides.switchLabel, hint: fr.landing.switchHint, words }));
    expect(tenant).toMatch(/aria-current="page"[^>]*>Je suis locataire|Je suis locataire/);
    expect(tenant.match(/aria-current/g)).toHaveLength(1);
  });

  it("is on the home", () => {
    expect(readFileSync(join(ROOT, "app/[locale]/page.tsx"), "utf8")).toContain("<SideSwitch");
  });
});

describe("the words — correct Québec terms, both languages", () => {
  it("French says « locataire », « locateur » for the legal party and « propriétaire » in everyday copy", () => {
    expect(fr.sides.tenant.switch).toBe("Je suis locataire");
    expect(fr.sides.landlord.switch).toBe("Je suis propriétaire");
    expect(JSON.stringify(fr.sides.landlord)).toMatch(/locateur/);
    expect(JSON.stringify(fr.sides.tenant)).toMatch(/locateur/);
  });
  it("English says tenant and landlord", () => {
    expect(en.sides.tenant.switch).toBe("I'm a tenant");
    expect(en.sides.landlord.switch).toBe("I'm a landlord");
  });
  it("French is addressed with « vous »", () => {
    for (const s of [fr.sides.tenant, fr.sides.landlord]) expect(JSON.stringify(s)).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i);
    expect(fr.console.profile.lead).toMatch(/Vous/);
  });
});

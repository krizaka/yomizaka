import { readFileSync } from "node:fs";
import { join } from "node:path";

import { AUDIENCE_STATUS } from "@yomizaka/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import sitemap from "../app/sitemap";
import { AudiencePicker } from "../components/home/AudiencePicker";
import { llmsText } from "./seo";
import { SIDE_LANDINGS, sideOfSlug, sidePath, sideUrl } from "./sides";

const ROOT = join(__dirname, "..");

describe("the two sides of the lease have their own address", () => {
  it("one per side and language, in each language's word", () => {
    expect(sidePath("fr", "tenant")).toBe("/fr/locataire");
    expect(sidePath("fr", "landlord")).toBe("/fr/proprietaire");
    expect(sidePath("en", "tenant")).toBe("/en/tenant");
    expect(sidePath("en", "landlord")).toBe("/en/landlord");
    expect(sidePath("fr", "freelancer")).toBe("/fr/travailleur-autonome");
    expect(sidePath("fr", "business")).toBe("/fr/entreprise");
    expect(sidePath("en", "freelancer")).toBe("/en/freelancer");
    expect(sidePath("en", "business")).toBe("/en/business");
    expect(SIDE_LANDINGS).toHaveLength(8);
  });

  it("reads a slug in either language (the other language's word redirects), nothing else", () => {
    expect(sideOfSlug("locataire")).toEqual({ side: "tenant", slugLocale: "fr" });
    expect(sideOfSlug("landlord")).toEqual({ side: "landlord", slugLocale: "en" });
    for (const other of ["run", "verify", "privacy", "app", "sign-in", "owner", ""]) expect(sideOfSlug(other)).toBeNull();
  });

  it("is in the sitemap in both languages, each the other's alternate", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    for (const { locale, side } of SIDE_LANDINGS) expect(urls).toContain(sideUrl(locale, side));
    const fr = (await sitemap()).find((e) => e.url === sideUrl("fr", "tenant"));
    expect(fr?.alternates?.languages).toMatchObject({ en: sideUrl("en", "tenant"), fr: sideUrl("fr", "tenant") });
  });

  it("is named in llms.txt", () => {
    expect(llmsText()).toMatch(/\/en\/tenant/);
    expect(llmsText()).toMatch(/\/en\/landlord/);
  });

  it("has its own SEO title and description per side and language — four different pairs", () => {
    const pairs = [en, fr].flatMap((d) => [d.sides.tenant, d.sides.landlord, d.sides.freelancer, d.sides.business].map((s) => `${s.seoTitle}|${s.seoDescription}`));
    expect(new Set(pairs).size).toBe(8);
    for (const d of [en, fr]) for (const s of [d.sides.tenant, d.sides.landlord, d.sides.freelancer, d.sides.business]) expect(s.seoDescription.length).toBeLessThanOrEqual(220);
  });

  it("pre-renders every address (16: each audience's slug in both languages, so the other language's word redirects)", () => {
    const page = readFileSync(join(ROOT, "app/[locale]/[side]/page.tsx"), "utf8");
    expect(page).toContain("export const dynamicParams = false");
    expect(page).toContain("generateStaticParams");
    expect(page).toContain("permanentRedirect");
  });
});

describe("« Pour qui ? » — the picker", () => {
  const words = { tenant: fr.sides.tenant.switch, landlord: fr.sides.landlord.switch, freelancer: fr.sides.freelancer.switch, business: fr.sides.business.switch };
  const audiences = [{ audience: "tenant" as const, status: "available" as const }, { audience: "landlord" as const, status: "available" as const }, { audience: "freelancer" as const, status: "soon" as const }, { audience: "business" as const, status: "soon" as const }];
  const props = { locale: "fr" as const, audiences, label: fr.sides.switchLabel, hint: fr.landing.switchHint, words, soon: fr.sides.soon, other: fr.sides.other };

  it("is a link per audience plus « Autre » (the generic home), the current one marked", () => {
    const home = renderToStaticMarkup(createElement(AudiencePicker, props));
    for (const slug of ["locataire", "proprietaire", "travailleur-autonome", "entreprise"]) expect(home).toContain(`href="/fr/${slug}"`);
    expect(home).toContain('data-testid="audience-other"');
    expect(home).toContain('href="/fr"');
    expect(home).not.toContain("aria-current");
    expect(renderToStaticMarkup(createElement(AudiencePicker, { ...props, current: "freelancer" })).match(/aria-current/g)).toHaveLength(1);
  });

  it("marks « bientôt » exactly the audiences whose rules are not built — and says nothing of the others", () => {
    const html = renderToStaticMarkup(createElement(AudiencePicker, props));
    expect(html).toContain('data-testid="soon-freelancer"');
    expect(html).toContain('data-testid="soon-business"');
    expect(html).not.toContain('data-testid="soon-tenant"');
    expect(html).not.toContain('data-testid="soon-landlord"');
    expect(AUDIENCE_STATUS).toEqual({ tenant: "available", landlord: "available", freelancer: "soon", business: "soon" });
  });

  it("never claims a check that does not run: the « soon » audiences' pitch says so in both languages", () => {
    for (const d of [en, fr]) {
      for (const a of ["freelancer", "business"] as const) {
        const w = d.sides[a];
        expect(w.outcomes.a.title.toLowerCase()).toMatch(/bientôt|soon/);
        expect(w.lead.toLowerCase()).toMatch(/bientôt|soon/);
        const planned = a === "freelancer" ? (["a", "b", "c"] as const) : (["a", "b"] as const);
        for (const id of planned) expect(w.examples.items[id]).toMatch(/\((?:bientôt|soon)\)/);
        expect(d.sides.soonInfo[a].title.toLowerCase()).toMatch(/bientôt|soon/);
      }
    }
  });

  it("is on the home, in the hero", () => {
    const home = readFileSync(join(ROOT, "app/[locale]/page.tsx"), "utf8");
    expect(home.indexOf("<AudiencePicker")).toBeGreaterThan(home.indexOf("<LandingPage"));
    expect(home.indexOf("<AudiencePicker")).toBeLessThan(home.indexOf("proofs={["));
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

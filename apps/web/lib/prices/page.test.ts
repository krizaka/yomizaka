import { AVAILABILITY, memoryPriceStore, type PriceCatalogue, priceCatalogue, publicCatalogue } from "@krizaka/settings";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PricingContent } from "@/components/pricing/PricingContent";

import { PRICE, PRICES } from "../pricing";
import { pricingLines } from "./page";

const NOW = new Date("2026-10-26T12:00:00Z");
const ADMIN = { id: null, label: "admin@yomizaka.test" };
const nb = (s: string | null) => s?.replaceAll(/\s/gu, " ") ?? null;
/** The text of an HTML fragment: what sits between a `>` and the next `<`, without entities. No tag is stripped by pattern. */
const textOf = (html: string) => [...`>${html}<`.matchAll(/>([^<>]*)</g)].map((m) => m[1]!.replaceAll(/&#x?[0-9a-f]+;/gi, "")).join("");
const fresh = () => priceCatalogue(PRICES, memoryPriceStore());
const linesOf = async (c: PriceCatalogue, locale: "en" | "fr") => pricingLines(publicCatalogue(await c.catalogue(NOW)), locale);
const render = async (c: PriceCatalogue, locale: "en" | "fr", freeFirst = true) => {
  const { sold, soon } = await linesOf(c, locale);
  return renderToStaticMarkup(PricingContent({ locale, sold, soon, freeFirst, status: "In development" }));
};

describe("the pricing page reads the catalogue (#388)", () => {
  it("shows one document, then the two subscriptions with what they include, then what is soon", async () => {
    const lines = await linesOf(fresh(), "fr");
    expect(lines.sold.map((l) => [l.plan, nb(l.price), l.per, l.included])).toEqual([
      ["document", "0,65 $", "document", null],
      ["agency", "59,00 $", "month", 100],
      ["firm", "279,00 $", "month", 750],
    ]);
    expect(lines.soon).toEqual([{ plan: "fullFile" }, { plan: "backgroundCheck" }, { plan: "screening" }]);
  });

  it("never shows the internal entry", async () => {
    const lines = await linesOf(fresh(), "en");
    expect([...lines.sold, ...lines.soon].map((l) => l.plan)).not.toContain("api");
  });

  it("changing a price in the catalogue changes the page", async () => {
    const c = fresh();
    const before = nb(await render(c, "fr"));
    expect(before).toContain("59,00 $");
    await c.schedule(ADMIN, PRICE.agency, { amountCents: 6900 }, NOW, NOW);
    const after = nb(await render(c, "fr"));
    expect(after).toContain("69,00 $");
    expect(after).not.toContain("59,00 $");
  });

  it("follows an entry the administrator took off sale: it leaves the plans, and appears as soon without a figure", async () => {
    const c = fresh();
    await c.schedule(ADMIN, PRICE.firm, { availability: AVAILABILITY.preparing }, NOW, NOW);
    const lines = await linesOf(c, "fr");
    expect(lines.sold.map((l) => l.plan)).not.toContain("firm");
    expect(lines.soon.map((l) => l.plan)).toContain("firm");
  });

  it("a « soon » line carries no number, in both languages", async () => {
    for (const locale of ["en", "fr"] as const) {
      const html = await render(fresh(), locale);
      const soonLines = [...html.matchAll(/<li[^>]*data-soon="[^"]+"[^>]*>(.*?)<\/li>/g)].map((m) => textOf(m[1]!));
      expect(soonLines).toHaveLength(3);
      for (const line of soonLines) expect(line, line).not.toMatch(/\d/);
    }
  });

  it("the call to action is sign-in, never « Start now »: sign-up is closed while the product is in development", async () => {
    for (const locale of ["en", "fr"] as const) {
      const html = await render(fresh(), locale);
      expect(html).toContain(`href="/${locale}/sign-in"`);
      expect(html).not.toMatch(/Start now|Commencer maintenant|Essai gratuit|Free trial/i);
      expect(html).toContain("In development");
    }
  });

  it("the first verification is free only while the setting says so", async () => {
    expect(await render(fresh(), "en", true)).toContain("first verification is free");
    expect(await render(fresh(), "en", false)).not.toContain("first verification is free");
  });
});

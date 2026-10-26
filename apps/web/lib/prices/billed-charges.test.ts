import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { memoryPriceStore, priceCatalogue, publicCatalogue } from "@krizaka/settings";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PricingContent } from "@/components/pricing/PricingContent";

import { LIMIT, PRICES, SOLD } from "../pricing";
import { money } from "./format";
import { pricingLines } from "./page";

/**
 * yomizaka#373: the page never advertises a charge the code does not make. The code charges exactly what the processor sells
 * (`SOLD`: one document, two monthly subscriptions); a verification beyond the included volume is not billed — the account
 * is held until next month (429 `FAIR_USE`, `lib/billing.ts`). So no public page shows any other amount.
 */
const ROOT = join(import.meta.dirname, "../..");
const NOW = new Date("2026-10-26T12:00:00Z");
const MONEY = /\d[\d\p{Zs},.]*\p{Zs}?\$|\$\p{Zs}?\d[\d,.]*/gu;
const squash = (s: string) => s.replaceAll(/\p{Zs}/gu, "");

describe("no public page advertises a charge the code does not make (#373)", () => {
  it("bills only what the processor sells: a document, a month — never a metered usage", async () => {
    expect(Object.values(SOLD).map((s) => s.mode).sort()).toEqual(["payment", "subscription", "subscription"]);
    expect(Object.keys(LIMIT)).toEqual(["included"]);
    for (const entry of await priceCatalogue(PRICES, memoryPriceStore()).catalogue(NOW)) expect(Object.keys(entry.limits), entry.key).not.toContain("overageCents");
  });

  for (const locale of ["en", "fr"] as const) {
    it(`${locale}: every amount on the pricing page is the price of something sold`, async () => {
      const catalogue = priceCatalogue(PRICES, memoryPriceStore());
      const { sold, soon } = pricingLines(publicCatalogue(await catalogue.catalogue(NOW)), locale);
      const html = renderToStaticMarkup(PricingContent({ locale, sold, soon, freeFirst: true, status: "x" })).replaceAll(/<[^>]+>/g, " ");
      const billed = (await catalogue.catalogue(NOW)).filter((e) => Object.values(SOLD).some((s) => s.key === e.key)).map((e) => squash(money(e.amountCents!, locale)));
      const shown = (html.match(MONEY) ?? []).map(squash);
      expect(shown.length).toBeGreaterThan(0);
      for (const amount of shown) expect(billed, amount).toContain(amount);
    });
  }

  it("no public message promises a price beyond the included volume", async () => {
    for (const locale of ["en", "fr"] as const) {
      const messages = (await import(`@/messages/${locale}.json`)).default as Record<string, unknown>;
      for (const ns of ["pricing", "landing", "chrome", "terms", "privacy", "download", "docs"]) {
        expect(JSON.stringify(messages[ns]), `${locale} ${ns}`).not.toMatch(/overage|per verification beyond|surplus|chaque vérification au-delà|par vérification au-delà|vérification supplémentaire/i);
      }
    }
  });

  it("says what really happens past the included volume, and the code does hold the account there", async () => {
    const en = (await import("@/messages/en.json")).default;
    expect(en.pricing.paused).toBe("Past the included volume, checks wait until next month");
    const billing = readFileSync(join(ROOT, "lib/billing.ts"), "utf8");
    expect(billing).toContain('refuse(429, "FAIR_USE"');
  });

  it("no source reads a per-verification price beyond the volume (`overageCents`)", () => {
    const sources = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === "node_modules" || name.startsWith(".") ? [] : sources(path);
        return /\.(tsx?|json)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
      });
    const offenders = ["app", "components", "lib", "messages"].flatMap((d) => sources(join(ROOT, d))).filter((f) => readFileSync(f, "utf8").includes("overageCents"));
    expect(offenders).toEqual([]);
  });
});

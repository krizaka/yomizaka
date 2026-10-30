import { readFileSync } from "node:fs";

import {
  AVAILABILITY,
  findTypedPrices,
  memoryPriceStore,
  priceCatalogue,
  publicCatalogue,
  seedVersionId,
} from "@krizaka/settings";
import { describe, expect, it } from "vitest";

import { includedFor, onSale, soldEntry, subscriptionEntry } from "./prices/plan";
import { DEFAULT_SUBSCRIPTION, LIMIT, PRICE, PRICES, SOLD, SOLD_KINDS } from "./pricing";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const processor = read("../../../deploy/payments-catalogue.json") as {
  plans: { lookupKey: string; amount: number; currency: string; interval?: string }[];
};
const ADMIN = { id: null, label: "admin@yomizaka.test" };
const NOW = new Date("2026-10-25T12:00:00Z");
const LATER = new Date("2026-12-01T00:00:00Z");
const catalogue = () => priceCatalogue(PRICES, memoryPriceStore());

describe("the seed is the grid of ADR-0013 (yomizaka#367, #388)", () => {
  it("has every entry, at its default, with its availability", async () => {
    const byKey = Object.fromEntries((await catalogue().catalogue(NOW)).map((e) => [e.key, e]));
    expect(byKey[PRICE.document]).toMatchObject({
      unit: "document",
      amountCents: 499,
      availability: AVAILABILITY.public,
      currency: "CAD",
      taxes: "plus-taxes",
    });
    expect(byKey[PRICE.agency]).toMatchObject({
      unit: "month",
      amountCents: 4900,
      availability: AVAILABILITY.public,
      limits: { included: 100 },
    });
    expect(byKey[PRICE.firm]).toMatchObject({
      unit: "month",
      amountCents: 14900,
      availability: AVAILABILITY.public,
      limits: { included: 500 },
    });
    expect(byKey[PRICE.api]).toMatchObject({ unit: "document", amountCents: 22, availability: AVAILABILITY.internal });
    for (const k of [PRICE.fullFile, PRICE.backgroundCheck, PRICE.screening])
      expect(byKey[k]).toMatchObject({ amountCents: null, availability: AVAILABILITY.preparing });
  });
});

describe("the grid keeps the rules of ADR-0013", () => {
  const seed = (key: string) => PRICES.defaultOf(key);
  const amount = (key: string) => seed(key).amountCents!;
  const included = (key: string) => seed(key).limits?.[LIMIT.included] ?? 0;

  it("a landlord can buy one check, with no subscription", () => {
    expect(SOLD.document.mode).toBe("payment");
    expect(seed(PRICE.document)).toMatchObject({ unit: "document", availability: AVAILABILITY.public });
  });

  it("Agency pays for itself from the 10th document of the month (about three applicant files), not before", () => {
    expect(9 * amount(PRICE.document)).toBeLessThan(amount(PRICE.agency));
    expect(amount(PRICE.agency)).toBeLessThanOrEqual(10 * amount(PRICE.document));
  });

  it("each step up includes more and costs less per verification", () => {
    expect(included(PRICE.firm)).toBeGreaterThan(included(PRICE.agency));
    expect(amount(PRICE.firm) / included(PRICE.firm)).toBeLessThan(amount(PRICE.agency) / included(PRICE.agency));
    expect(amount(PRICE.agency) / included(PRICE.agency)).toBeLessThan(amount(PRICE.document));
  });
});

describe("the processor charges what the catalogue says", () => {
  it.each(SOLD_KINDS)("%s: same lookup key, same amount, same interval as deploy/payments-catalogue.json", (kind) => {
    const sold = SOLD[kind];
    const plan = processor.plans.find((p) => p.lookupKey === sold.lookupKey);
    const seed = PRICES.defaultOf(sold.key);
    expect(plan, sold.lookupKey).toBeDefined();
    expect(plan!.amount).toBe(seed.amountCents);
    expect(plan!.currency).toBe("cad");
    expect(plan!.interval).toBe(sold.mode === "subscription" ? seed.unit : undefined);
  });

  it("sells nothing else (no stale processor price left in the file)", () =>
    expect(processor.plans.map((p) => p.lookupKey).sort()).toEqual(SOLD_KINDS.map((k) => SOLD[k].lookupKey).sort()));
});

describe("every price shown comes from the catalogue", () => {
  it.each(["en", "fr"])("no message of %s types an amount", (locale) =>
    expect(findTypedPrices(read(`../messages/${locale}.json`))).toEqual([]),
  );

  it("a public page never shows the internal entry, and an entry in preparation without a figure", async () => {
    const shown = publicCatalogue(await catalogue().catalogue(NOW));
    expect(shown.map((e) => e.key)).not.toContain(PRICE.api);
    expect(JSON.stringify(shown)).not.toContain('"amountCents":22');
    expect(shown.filter((e) => e.availability === AVAILABILITY.internal)).toEqual([]);
    for (const e of shown.filter((p) => p.availability === AVAILABILITY.preparing))
      expect(e).toMatchObject({ amountCents: null, limits: {} });
  });
});

describe("the included volume is the catalogue's, for the version a subscription was sold at", () => {
  it("a subscription keeps its version; a new one gets the price in force", async () => {
    const c = catalogue();
    const sold = await soldEntry(c, "agency", NOW);
    expect(sold.versionId).toBe(seedVersionId(PRICE.agency));
    await c.schedule(ADMIN, PRICE.agency, { limits: { [LIMIT.included]: 120 } }, LATER, NOW);
    const after = new Date("2026-12-02T00:00:00Z");
    expect(await includedFor(c, { planKey: PRICE.agency, priceVersionId: sold.versionId }, after)).toBe(100);
    const fresh = await soldEntry(c, "agency", after);
    expect(await includedFor(c, { planKey: PRICE.agency, priceVersionId: fresh.versionId }, after)).toBe(120);
  });

  it("a subscription that recorded nothing (sold before the catalogue) reads its plan, or the default plan, in force", async () => {
    const c = catalogue();
    expect((await subscriptionEntry(c, { planKey: null, priceVersionId: null }, NOW)).key).toBe(
      SOLD[DEFAULT_SUBSCRIPTION].key,
    );
    expect(await includedFor(c, { planKey: PRICE.firm, priceVersionId: null }, NOW)).toBe(500);
    expect(await includedFor(c, { planKey: null, priceVersionId: "999" }, NOW)).toBe(100);
  });
});

describe("a checkout charges the catalogue's amount, or nothing", () => {
  it("sells an entry whose processor price equals it", async () => {
    const entry = await soldEntry(catalogue(), "firm", NOW);
    expect(onSale(entry, { amount: 14900, currency: "cad" }).versionId).toBe(seedVersionId(PRICE.firm));
  });

  it("refuses while the processor's price differs (a change scheduled without its new processor price)", async () => {
    const c = catalogue();
    await c.schedule(ADMIN, PRICE.document, { amountCents: 599 }, NOW, NOW);
    const entry = await c.entry(PRICE.document, NOW);
    expect(() => onSale(entry, { amount: 499, currency: "cad" })).toThrow(expect.objectContaining({ status: 503 }));
  });

  it("refuses an entry that is not on sale", async () => {
    const c = catalogue();
    await c.schedule(ADMIN, PRICE.agency, { availability: AVAILABILITY.preparing }, NOW, NOW);
    const entry = await c.entry(PRICE.agency, NOW);
    expect(() => onSale(entry, { amount: 4900, currency: "cad" })).toThrow(expect.objectContaining({ status: 409 }));
  });
});

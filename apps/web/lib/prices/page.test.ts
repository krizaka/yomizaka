import { AVAILABILITY, memoryPriceStore, priceCatalogue, publicCatalogue } from "@krizaka/settings";
import { describe, expect, it } from "vitest";

import { PRICE, PRICES } from "../pricing";
import { pricingLines } from "./page";

const NOW = new Date("2026-10-25T12:00:00Z");
const ADMIN = { id: null, label: "admin@yomizaka.test" };
const nb = (s: string | null) => s?.replace(/\s/gu, " ") ?? null;

describe("the Tarifs page reads the catalogue (#300, #367)", () => {
  it("shows the audit grid: one document, the first offered, the two subscriptions with what they include, then what is in preparation", async () => {
    const lines = pricingLines(publicCatalogue(await priceCatalogue(PRICES, memoryPriceStore()).catalogue(NOW)), true, "fr");
    expect(lines.sold.map((l) => (l.kind === "sold" ? [l.plan, nb(l.price), l.included, nb(l.overage)] : [l.plan]))).toEqual([
      ["document", "0,65 $", null, null],
      ["first"],
      ["agency", "59,00 $", 100, "0,45 $"],
      ["firm", "279,00 $", 750, "0,32 $"],
    ]);
    expect(lines.preparing).toEqual([
      { plan: "fullFile", kind: "preparing" },
      { plan: "backgroundCheck", kind: "preparing" },
      { plan: "screening", kind: "preparing" },
    ]);
  });

  it("never shows the internal entry, and no first offer when the setting is off", async () => {
    const lines = pricingLines(publicCatalogue(await priceCatalogue(PRICES, memoryPriceStore()).catalogue(NOW)), false, "en");
    const plans = [...lines.sold, ...lines.preparing].map((l) => l.plan);
    expect(plans).not.toContain("api");
    expect(plans).not.toContain("first");
  });

  it("follows a change the administrator scheduled, from its date", async () => {
    const c = priceCatalogue(PRICES, memoryPriceStore());
    await c.schedule(ADMIN, PRICE.firm, { availability: AVAILABILITY.preparing }, NOW, NOW);
    const lines = pricingLines(publicCatalogue(await c.catalogue(NOW)), true, "fr");
    expect(lines.sold.map((l) => l.plan)).not.toContain("firm");
    expect(lines.preparing.map((l) => l.plan)).toContain("firm");
  });
});

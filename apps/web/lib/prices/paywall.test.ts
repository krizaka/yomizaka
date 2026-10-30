import { memoryPriceStore, priceCatalogue, publicCatalogue } from "@krizaka/settings";
import { describe, expect, it } from "vitest";

import { PRICE, PRICES } from "../pricing";
import { paywallFigures } from "./paywall";

const NOW = new Date("2026-10-25T12:00:00Z");

describe("the paywall says the catalogue's prices", () => {
  it("in French and English, from the entries in force", async () => {
    const prices = publicCatalogue(await priceCatalogue(PRICES, memoryPriceStore()).catalogue(NOW));
    const fr = paywallFigures(prices, "fr")!;
    expect({ ...fr, document: fr.document.replace(/\s/gu, " "), agency: fr.agency.replace(/\s/gu, " ") }).toEqual({
      document: "4,99 $",
      agency: "49,00 $",
      included: 100,
    });
    expect(paywallFigures(prices, "en")).toMatchObject({ document: "$4.99", agency: "$49.00", included: 100 });
  });

  it("says nothing it does not have (an entry withdrawn from sale)", () => {
    expect(paywallFigures([{ key: PRICE.document, amountCents: 65, limits: {} }], "fr")).toBeNull();
  });
});

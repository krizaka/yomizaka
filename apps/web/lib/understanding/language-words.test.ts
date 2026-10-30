import { describe, expect, it } from "vitest";

import { EN_WORDS, FR_WORDS } from "./language-words";

describe("language words", () => {
  it("are the patterns they were written as", () => {
    expect(FR_WORDS.source).toBe(
      /\b(le|la|les|des|du|de|et|est|pour|une|un|dans|sur|avec|par|au|aux|ce|cette|entre|loyer|facture)\b/giu.source,
    );
    expect(FR_WORDS.flags).toBe("giu");
    expect(EN_WORDS.source).toBe(
      /\b(the|of|and|is|for|with|this|that|between|to|in|on|by|an|agreement|invoice|rent|tenant|number|payment|terms|due|subtotal|total)\b/giu
        .source,
    );
    expect(EN_WORDS.flags).toBe("giu");
  });

  it("count whole words only, in any case", () => {
    expect("Le loyer est dû par le locataire. Delay, lease".match(FR_WORDS)).toEqual([
      "Le",
      "loyer",
      "est",
      "par",
      "le",
    ]);
    expect("The Rent is due to the tenant; theory, toast".match(EN_WORDS)).toEqual([
      "The",
      "Rent",
      "is",
      "due",
      "to",
      "the",
      "tenant",
    ]);
  });
});

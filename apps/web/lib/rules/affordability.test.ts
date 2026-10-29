import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { type AffordabilityCode, affordabilityMessageKey, checkAffordability } from "./affordability";

/** TEST FIGURES, invented for these tests. */
const at = (rentCents: number, monthlyIncomeCents?: number, referenceBasisPoints = 3000) => checkAffordability({ rentCents, monthlyIncomeCents, referenceBasisPoints });

describe("affordability share", () => {
  it("is within the reference when the rent takes less of the income", () => {
    expect(at(120_000, 480_000)).toMatchObject({ status: "ok", code: "within-reference", figures: { shareBasisPoints: 2500, referenceBasisPoints: 3000 } });
  });
  it("is within the reference exactly at it", () => {
    expect(at(150_000, 500_000)).toMatchObject({ status: "ok", figures: { shareBasisPoints: 3000 } });
  });
  it("asks for a look above the reference, with the figures", () => {
    expect(at(150_000, 400_000)).toMatchObject({ status: "finding", code: "above-reference", figures: { rentCents: 150_000, monthlyIncomeCents: 400_000, shareBasisPoints: 3750 } });
  });
  it("rounds the share to the basis point", () => {
    expect(at(100_000, 300_000).figures.shareBasisPoints).toBe(3333);
  });
  it("follows the reference it is given", () => {
    expect(at(150_000, 400_000, 4000).status).toBe("ok");
  });
  it("makes no claim without a usable income, rent or reference", () => {
    for (const r of [at(120_000), at(120_000, 0), at(120_000, -5), at(120_000, 4000.5), at(0, 400_000), at(120_000, 400_000, 0), at(120_000, Number.NaN)]) {
      expect(r).toMatchObject({ status: "no-claim", code: "no-claim" });
      expect(r.figures.shareBasisPoints).toBeUndefined();
    }
  });
});

describe("affordability messages", () => {
  const codes: AffordabilityCode[] = ["within-reference", "above-reference", "no-claim"];
  it("has every result in English and French, says the reference is not a legal limit and speaks of no person", () => {
    for (const dict of [en, fr] as const) {
      const a = (dict as unknown as { affordability: Record<string, string> }).affordability;
      for (const code of codes) {
        expect(a[code], code).toBeTruthy();
        expect(affordabilityMessageKey({ code })).toBe(`affordability.${code}`);
      }
      expect(a.note).toBeTruthy();
      expect(a.disclaimer).toBeTruthy();
    }
    expect(en.affordability.note).toContain("not a legal limit");
    expect(fr.affordability.note).toContain("pas une limite légale");
    expect(en.affordability.disclaimer).toContain("not legal advice");
    expect(fr.affordability.disclaimer).toContain("pas un avis juridique");
  });
});

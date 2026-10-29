import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { TAL, type TalTable } from "../brief/tal";
import { checkSectionG, SECTION_G_RULE, type SectionGCode,sectionGMessageKey } from "./section-g";

/** TEST FIGURES — invented for these tests, never shipped: the shipped table has no year until someone enters the TAL's figures. */
const rate = (extra: TalTable["years"][number]["components"] = []): TalTable => ({
  ...TAL,
  years: [{ year: 2027, enteredOn: "2026-10-26", sourceUrl: "https://example.test/tal-2027", components: [{ id: "adjustment", kind: "rate-of-rent", basisPoints: 300 }, ...extra] }],
});
const stated = (cents: number) => ({ kind: "stated", cents }) as const;

describe("Section G check", () => {
  it("flags a blank Section G with the notice and the recourse", () => {
    const r = checkSectionG({ newRentCents: 120_000, previousRent: { kind: "blank" }, year: 2027 }, rate());
    expect(r).toMatchObject({ status: "finding", code: "previous-blank", recourse: { citation: "C.c.Q., art. 1950", authority: "TAL" } });
    expect(r.citations).toEqual([SECTION_G_RULE.citations.notice, SECTION_G_RULE.citations.recourse]);
  });

  it("flags an altered Section G the same way", () => {
    expect(checkSectionG({ newRentCents: 120_000, previousRent: { kind: "altered" }, year: 2027 }, rate())).toMatchObject({ status: "finding", code: "previous-altered" });
  });

  it("is fine when the rent is equal to or below the previous one", () => {
    for (const cents of [100_000, 90_000]) expect(checkSectionG({ newRentCents: cents, previousRent: stated(100_000), year: 2027 }, rate())).toMatchObject({ status: "ok", code: "not-above-previous", recourse: null });
  });

  it("is fine within the table's rate, and says the highest rent it gives", () => {
    const r = checkSectionG({ newRentCents: 103_000, previousRent: stated(100_000), year: 2027 }, rate());
    expect(r).toMatchObject({ status: "ok", code: "within-rate", figures: { maxRentCents: 103_000, increaseBasisPoints: 300 }, source: { url: "https://example.test/tal-2027", year: 2027 } });
  });

  it("flags a rent over the rate with the excess and the recourse", () => {
    const r = checkSectionG({ newRentCents: 110_000, previousRent: stated(100_000), year: 2027 }, rate());
    expect(r).toMatchObject({ status: "finding", code: "over-rate", figures: { maxRentCents: 103_000, excessCents: 7_000 }, recourse: { citation: "C.c.Q., art. 1950" } });
  });

  it("makes no claim when the table has no such year (the shipped table has none)", () => {
    expect(checkSectionG({ newRentCents: 110_000, previousRent: stated(100_000), year: 2027 }, TAL)).toMatchObject({ status: "no-claim", code: "no-rate", recourse: null });
    expect(checkSectionG({ newRentCents: 110_000, previousRent: stated(100_000), year: 2030 }, rate())).toMatchObject({ status: "no-claim" });
  });

  it("makes no claim when the method needs the building's costs that were not given, and uses them when they are", () => {
    const t = rate([{ id: "taxes", kind: "cost-per-door" }]);
    expect(checkSectionG({ newRentCents: 110_000, previousRent: stated(100_000), year: 2027 }, t)).toMatchObject({ status: "no-claim" });
    expect(checkSectionG({ newRentCents: 110_000, previousRent: stated(100_000), year: 2027, costChangeCents: { taxes: 2_000 } }, t)).toMatchObject({ status: "finding", figures: { maxRentCents: 105_000, excessCents: 5_000 } });
  });

  it("makes no claim on figures that are not rents", () => {
    expect(checkSectionG({ newRentCents: 0, previousRent: stated(100_000), year: 2027 }, rate()).status).toBe("no-claim");
    expect(checkSectionG({ newRentCents: 100_000, previousRent: stated(0), year: 2027 }, rate()).status).toBe("no-claim");
  });

  it("never claims a recourse without a finding", () => {
    for (const newRentCents of [90_000, 103_000, 110_000]) {
      const r = checkSectionG({ newRentCents, previousRent: stated(100_000), year: 2027 }, rate());
      expect(r.recourse !== null).toBe(r.status === "finding");
    }
  });
});

describe("Section G messages", () => {
  const codes: SectionGCode[] = ["previous-blank", "previous-altered", "over-rate", "within-rate", "not-above-previous", "no-rate"];
  it("has every result in English and French, citing the articles and not claiming to be legal advice", () => {
    for (const dict of [en, fr] as const) {
      const g = (dict as unknown as { sectionG: Record<string, string> }).sectionG;
      for (const code of codes) {
        expect(g[code], code).toBeTruthy();
        expect(sectionGMessageKey({ code })).toBe(`sectionG.${code}`);
      }
      expect(g.recourse).toContain("1950");
      expect(g.disclaimer).toBeTruthy();
    }
    expect(en.sectionG.disclaimer).toContain("not legal advice");
    expect(fr.sectionG.disclaimer).toContain("pas un avis juridique");
  });
});

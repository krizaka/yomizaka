import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { affordabilityMessageKey, checkAffordability } from "./affordability";

/** TEST FIGURES, invented for these tests. */
const at = (rentCents: number, monthlyIncomeCents?: number) => checkAffordability({ rentCents, monthlyIncomeCents });

describe("affordability share (information only)", () => {
  it("gives the share of the income the rent takes, in basis points", () => {
    expect(at(120_000, 480_000)).toMatchObject({ code: "share", figures: { shareBasisPoints: 2500 } });
    expect(at(150_000, 400_000)).toMatchObject({
      code: "share",
      figures: { rentCents: 150_000, monthlyIncomeCents: 400_000, shareBasisPoints: 3750 },
    });
  });
  it("rounds the share to the basis point", () => {
    expect(at(100_000, 300_000)).toMatchObject({ figures: { shareBasisPoints: 3333 } });
  });
  it("makes no claim without a usable income or rent", () => {
    for (const r of [
      at(120_000),
      at(120_000, 0),
      at(120_000, -5),
      at(120_000, 4000.5),
      at(0, 400_000),
      at(120_000, Number.NaN),
    ]) {
      expect(r.code).toBe("no-claim");
      expect(r.figures).not.toHaveProperty("shareBasisPoints");
    }
  });
  it("never carries a verdict: no status, no score, no threshold, no reference to compare to", () => {
    const keys = Object.keys(at(150_000, 400_000));
    expect(keys.sort()).toEqual(["code", "figures", "ruleId"]);
    expect(JSON.stringify(at(150_000, 200_000))).not.toMatch(
      /finding|ok|score|pass|fail|reject|refus|above|within|reference/i,
    );
    expect(affordabilityMessageKey({ code: "share" })).toBe("affordability.share");
  });
});

/** Words that would turn the share into a verdict on the applicant (CDPDJ: social condition, Charter s. 10 and 12). */
const VERDICT =
  /refus|échec|echec|rejet|rejette|refuse|reject|\bfail|failed|pass\/fail|\bpass\b|insuffisan|insufficient|not enough|disqualif|ineligible|inadmissible|non admissible|trop élevé|too high|exceeds?|dépasse|score|cote\b|rating|approved|approuvé/i;

describe("affordability messages", () => {
  const keys = ["share", "no-claim", "note", "disclaimer"] as const;
  it("exists in English and French, with no verdict wording", () => {
    for (const dict of [en, fr] as const) {
      const a = (dict as unknown as { affordability: Record<string, string> }).affordability;
      expect(Object.keys(a).sort()).toEqual([...keys].sort());
      for (const k of keys) {
        expect(a[k], k).toBeTruthy();
        expect(a[k], k).not.toMatch(VERDICT);
      }
    }
  });
  it("says the share must not be the sole criterion, and why", () => {
    expect(en.affordability.note).toMatch(/sole criterion/);
    expect(en.affordability.note).toMatch(/social condition/);
    expect(fr.affordability.note).toMatch(/seul critère/);
    expect(fr.affordability.note).toMatch(/condition sociale/);
    expect(en.affordability.disclaimer).toContain("not legal advice");
    expect(fr.affordability.disclaimer).toContain("pas un avis juridique");
  });
  it("the guard catches verdict wording", () => {
    for (const w of ["Application rejected", "Refus du dossier", "Échec", "Test failed", "Income insufficient"])
      expect(w).toMatch(VERDICT);
  });
});

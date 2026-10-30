import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { checkPaymentClauses, PAYMENT_CLAUSES_RULE, paymentClauseMessageKey } from "./payment-clauses";

describe("payment clauses (art. 1904 C.c.Q., slice 3 of #104)", () => {
  it("finds nothing in a lease that asks for the first month only", () => {
    expect(checkPaymentClauses({ advanceMonths: 1, depositCents: 0, postdatedCheques: false })).toEqual({
      ruleId: PAYMENT_CLAUSES_RULE.id,
      status: "ok",
      findings: [],
      citations: [],
    });
    expect(checkPaymentClauses({}).status).toBe("ok");
  });

  it("flags an advance of more than one month", () => {
    const r = checkPaymentClauses({ advanceMonths: 2 });
    expect(r).toMatchObject({
      status: "finding",
      findings: [{ code: "advance-over-one-month" }],
      citations: ["C.c.Q., art. 1904"],
    });
  });

  it("flags a deposit or any sum other than the rent", () => {
    expect(checkPaymentClauses({ depositCents: 50_000 }).findings.map((f) => f.code)).toEqual(["deposit"]);
  });

  it("flags postdated cheques demanded", () => {
    expect(checkPaymentClauses({ postdatedCheques: true }).findings.map((f) => f.code)).toEqual(["postdated-cheques"]);
  });

  it("lists every finding, in a stable order", () => {
    expect(
      checkPaymentClauses({ advanceMonths: 3, depositCents: 1, postdatedCheques: true }).findings.map((f) => f.code),
    ).toEqual(["advance-over-one-month", "deposit", "postdated-cheques"]);
  });

  it("makes no claim on figures that are not usable", () => {
    for (const input of [
      { advanceMonths: -1 },
      { advanceMonths: Number.NaN },
      { depositCents: -5 },
      { depositCents: 1.5 },
    ])
      expect(checkPaymentClauses(input).status).toBe("no-claim");
  });

  it("has an EN and FR message for every code, and the disclaimer, without a verdict on the landlord", () => {
    for (const code of ["advance-over-one-month", "deposit", "postdated-cheques", "disclaimer"] as const) {
      const key = code === "disclaimer" ? "paymentClauses.disclaimer" : paymentClauseMessageKey({ code });
      const name = key.split(".")[1] as keyof typeof en.paymentClauses;
      expect(en.paymentClauses[name]).toBeTruthy();
      expect((fr.paymentClauses as Record<string, string>)[name]).toBeTruthy();
      expect(en.paymentClauses[name]).not.toMatch(/illegal landlord|guilty|fraud/i);
    }
  });
});

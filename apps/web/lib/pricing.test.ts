import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { money, PRICING } from "./pricing";

/** The prices the pricing page shows are the processor's: `deploy/payments-catalogue.json` is what `payments:setup` creates. */
const catalogue = JSON.parse(readFileSync(join(__dirname, "../../../deploy/payments-catalogue.json"), "utf8")) as {
  plans: { lookupKey: string; amount: number; currency: string; interval?: string }[];
};
const plan = (key: string) => catalogue.plans.find((p) => p.lookupKey === key);

describe("the prices are the processor's catalogue", () => {
  it("one check is the catalogue's audit plan, in CAD, cents", () => {
    expect(plan(PRICING.check.lookupKey)).toMatchObject({ amount: PRICING.check.cents, currency: "cad" });
  });

  it("Pro is the catalogue's monthly plan, never an annual one", () => {
    expect(plan(PRICING.pro.lookupKey)).toMatchObject({ amount: PRICING.pro.cents, currency: "cad", interval: "month" });
  });

  it("the lookup keys are the ones the app reads (the defaults of lib/env.ts)", () => {
    const env = readFileSync(join(__dirname, "env.ts"), "utf8");
    expect(env).toContain(`PAYMENTS_PRICE_KEY_AUDIT: z.string().default("${PRICING.check.lookupKey}")`);
    expect(env).toContain(`PAYMENTS_PRICE_KEY_PRO: z.string().default("${PRICING.pro.lookupKey}")`);
  });

  it("prices are whole cents, and a check costs less than a month of Pro", () => {
    for (const cents of [PRICING.check.cents, PRICING.pro.cents]) expect(Number.isInteger(cents) && cents > 0).toBe(true);
    expect(PRICING.check.cents).toBeLessThan(PRICING.pro.cents);
  });
});

describe("money", () => {
  it("formats from cents in each language, in Canadian dollars", () => {
    expect(money(999, "fr")).toMatch(/^9,99\s\$$/);
    expect(money(999, "en")).toBe("$9.99");
    expect(money(2900, "fr")).toMatch(/^29,00\s\$$/);
  });
});

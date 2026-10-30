import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { paymentProblemOf } from "./payment-problem";

describe("paymentProblemOf", () => {
  it("is a problem when the processor could not collect a subscription payment", () => {
    expect(paymentProblemOf({ subscriptionStatus: "past_due", hasCustomer: true })).toBe(true);
    expect(paymentProblemOf({ subscriptionStatus: "unpaid", hasCustomer: true })).toBe(true);
  });

  it("is not one for a live, cancelled, absent or still-completing subscription", () => {
    for (const subscriptionStatus of ["active", "trialing", "canceled", "incomplete", "incomplete_expired", "paused", null]) {
      expect(paymentProblemOf({ subscriptionStatus, hasCustomer: true })).toBe(false);
    }
  });

  it("needs a customer at the processor: without one there is no portal to send the card to", () => {
    expect(paymentProblemOf({ subscriptionStatus: "past_due", hasCustomer: false })).toBe(false);
  });

  it("has words in both languages", () => {
    for (const dict of [en, fr]) {
      const band = (dict as unknown as { console: { paymentProblem: Record<string, string> } }).console.paymentProblem;
      expect(Object.keys(band).sort()).toEqual(["fix", "text", "title"]);
      for (const v of Object.values(band)) expect(v.length).toBeGreaterThan(10);
    }
  });
});

import { describe, expect, it } from "vitest";

import { newCoupon } from "./admin-api";
import { basisPoints, couponFormSchema, couponPayload, emptyCouponForm, stateOf } from "./form";

const NOW = new Date("2026-10-27T12:00:00Z");
const base = emptyCouponForm("2026-10-27");

describe("the create form's payload", () => {
  it("turns a percent into basis points without a float", () => {
    expect(basisPoints("20")).toBe(2000);
    expect(basisPoints("12.5")).toBe(1250);
    expect(basisPoints("0.07")).toBe(7);
    expect(basisPoints("")).toBeNull();
  });
  it("makes a discount the API accepts, and leaves the credit fields out", () => {
    const form = { ...base, code: "SUMMER-2026", percent: "20", duration: "repeating" as const, durationMonths: "3", maxRedemptions: "100", endsAt: "2026-12-31", minimumMinor: 1000 };
    expect(couponFormSchema.safeParse(form).success).toBe(true);
    const payload = couponPayload(form);
    expect(payload).toMatchObject({ kind: "discount", percentOffBp: 2000, duration: "repeating", durationMonths: 3, maxRedemptions: 100, minimumMinor: 1000, endsAt: "2027-01-01T04:59:59.000Z", startsAt: "2026-10-27T04:00:00.000Z" });
    expect(payload).not.toHaveProperty("credits");
    expect(newCoupon.safeParse(payload).success).toBe(true);
  });
  it("starts and ends a window on days of the product's calendar, in summer and in winter time", () => {
    const payload = couponPayload({ ...base, code: "WINDOW26", percent: "10", startsAt: "2026-07-01", endsAt: "2026-07-31" });
    expect(payload).toMatchObject({ startsAt: "2026-07-01T04:00:00.000Z", endsAt: "2026-08-01T03:59:59.000Z" });
    expect(couponPayload({ ...base, code: "WINDOW27", percent: "10", startsAt: "2026-12-01" })).toMatchObject({ startsAt: "2026-12-01T05:00:00.000Z", endsAt: null });
  });
  it("makes a fixed-amount discount in the product's currency", () => {
    const payload = couponPayload({ ...base, code: "TENOFF26", discountType: "amount", amountOffMinor: 1000 });
    expect(payload).toMatchObject({ amountOffMinor: 1000, currency: "cad", duration: "once" });
    expect(payload).not.toHaveProperty("percentOffBp");
    expect(newCoupon.safeParse(payload).success).toBe(true);
  });
  it("makes a credit coupon with its cap, its expiry and what happens when it runs out", () => {
    const payload = couponPayload({ ...base, code: "DEMO-AUDITS", kind: "credit", purpose: "demo", credits: "20", capPerDay: "5", creditsValidDays: "30", onExhausted: "fallback_paid" });
    expect(payload).toMatchObject({ kind: "credit", credits: 20, capPerDay: 5, capPerMonth: null, creditsValidDays: 30, onExhausted: "fallback_paid" });
    expect(payload).not.toHaveProperty("percentOffBp");
    expect(newCoupon.safeParse(payload).success).toBe(true);
  });
  it("refuses typed letters where a number goes", () => {
    expect(couponFormSchema.safeParse({ ...base, code: "ABCD1234", maxRedemptions: "ten" }).success).toBe(false);
    expect(couponFormSchema.safeParse({ ...base, code: "ABCD1234", maxPerAccount: "0" }).success).toBe(false);
  });
});

describe("a coupon's state in the list", () => {
  const coupon = { status: "active" as const, startsAt: new Date("2026-10-01T00:00:00Z"), endsAt: new Date("2026-11-01T00:00:00Z") };
  it("is computed from the dates, with no cron", () => {
    expect(stateOf(coupon, NOW)).toBe("active");
    expect(stateOf({ ...coupon, startsAt: new Date("2026-11-01T00:00:00Z"), endsAt: null }, NOW)).toBe("notStarted");
    expect(stateOf({ ...coupon, endsAt: new Date("2026-10-27T12:00:00Z") }, NOW)).toBe("expired");
    expect(stateOf({ ...coupon, endsAt: null }, NOW)).toBe("active");
  });
  it("shows a pause or an archive before the dates", () => {
    expect(stateOf({ ...coupon, status: "paused" }, NOW)).toBe("paused");
    expect(stateOf({ ...coupon, status: "archived", endsAt: new Date("2020-01-01T00:00:00Z") }, NOW)).toBe("archived");
  });
});

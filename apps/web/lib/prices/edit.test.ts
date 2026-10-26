import { describe, expect, it } from "vitest";

import { centsFrom, draftOf, effectiveFromOf, patchOf } from "./edit";

const AGENCY = { amountCents: 5900, availability: "public", limits: { included: 100, overageCents: 45 } };

describe("the admin screen's draft of a price", () => {
  it.each([
    ["0,65", 65],
    ["0.65", 65],
    ["59", 5900],
    ["279.5", 27950],
    ["", null],
    ["12,345", undefined],
    ["-1", undefined],
    ["59 $", undefined],
  ] as const)("« %s » is %s cents", (typed, cents) => expect(centsFrom(typed)).toBe(cents));

  it("starts from the entry as saved, and sends only what changed", () => {
    const draft = draftOf(AGENCY);
    expect(draft).toEqual({ amount: "59.00", availability: "public", limits: { included: "100", overageCents: "45" }, from: null });
    expect(patchOf(AGENCY, draft)).toEqual({});
    expect(patchOf(AGENCY, { ...draft, amount: "69" })).toEqual({ amountCents: 6900 });
    expect(patchOf(AGENCY, { ...draft, limits: { ...draft.limits, included: "120" } })).toEqual({ limits: { included: 120, overageCents: 45 } });
    expect(patchOf(AGENCY, { ...draft, limits: { ...draft.limits, included: "beaucoup" } })).toBeNull();
    expect(patchOf({ amountCents: null, availability: "internal", limits: {} }, { amount: "", availability: "internal", limits: {}, from: null })).toEqual({});
  });

  it("a change from today applies now; from a later day, at its start", () => {
    expect(effectiveFromOf(null, "2026-10-25")).toBeUndefined();
    expect(effectiveFromOf("2026-10-25", "2026-10-25")).toBeUndefined();
    expect(effectiveFromOf("2026-12-01", "2026-10-25")).toBe(new Date("2026-12-01T00:00:00").toISOString());
  });
});

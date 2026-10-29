import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { paymentReturnOf } from "./payment-return";
import { SOLD_KINDS } from "./pricing";

describe("paymentReturnOf", () => {
  it("reads the kind bought", () => {
    expect(paymentReturnOf("document")).toEqual({ state: "paid", kind: "document" });
    expect(paymentReturnOf("agency")).toEqual({ state: "paid", kind: "agency" });
  });
  it("reads a cancelled checkout", () => {
    expect(paymentReturnOf("cancelled")).toEqual({ state: "cancelled" });
  });
  it("takes anything else for no return", () => {
    expect(paymentReturnOf(undefined)).toBeNull();
    expect(paymentReturnOf("")).toBeNull();
    expect(paymentReturnOf("enterprise")).toBeNull();
    expect(paymentReturnOf(["document", "agency"])).toBeNull();
  });
});

describe("the band words", () => {
  it.each([["en", en], ["fr", fr]] as const)("%s: a sentence for every kind that is sold", (_l, dict) => {
    for (const kind of SOLD_KINDS) expect(dict.console.paymentReturn.paid[kind].length).toBeGreaterThan(10);
  });
});

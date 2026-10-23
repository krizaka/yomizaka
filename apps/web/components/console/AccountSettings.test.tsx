import { describe, expect, it } from "vitest";

import fr from "@/messages/fr.json";

import { billingRows, type Entitlement } from "./AccountSettings";

const say = (key: string, vars?: Record<string, string | number>) => {
  const words = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], fr.console) as string;
  return Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), words ?? key);
};
const date = (iso: string) => iso.slice(0, 10);
const FREE: Entitlement = { credits: 0, pro: false, proUntil: null, freeAuditUsed: false, selfServe: true, hasCustomer: false };

describe("billing as flat rows (the review's E3)", () => {
  it("a free self-serve account: the plan, the free audit, the paid audits left — no renewal", () => {
    expect(billingRows(FREE, say, date).map((r) => [r.label, r.value])).toEqual([
      ["Forfait", "Gratuit"],
      ["Audit gratuit", fr.console.settings.billing.freeAvailable],
      ["Audits payés restants", "0"],
    ]);
    expect(billingRows({ ...FREE, freeAuditUsed: true, credits: 3 }, say, date).map((r) => r.value)).toEqual(["Gratuit", fr.console.settings.billing.freeUsed, "3"]);
  });
  it("a Pro account: the plan and its renewal; an account that is not self-serve has no free audit row", () => {
    expect(billingRows({ ...FREE, pro: true, proUntil: "2026-11-23T00:00:00.000Z", selfServe: false }, say, date).map((r) => [r.id, r.value])).toEqual([
      ["plan", "Pro"],
      ["credits", "0"],
      ["until", "2026-11-23"],
    ]);
  });
});

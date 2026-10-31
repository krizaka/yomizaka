import type { QueryResultRow } from "pg";
import { describe, expect, it } from "vitest";

import { chargeOverage, type OverageBiller, refundOverage } from "./overage";

/** The overage rules against a fake database and a fake processor: once per dossier and month, a declined card runs nothing, a refund once. */
const NOW = new Date("2026-10-30T12:00:00Z");
const DOSSIER = "11111111-1111-4111-8111-111111111111";

function fakes() {
  const charges = new Map<string, { ref: string; refunded: boolean }>();
  const calls: string[] = [];
  let declined = false;
  const query = async <T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> => {
    if (text.includes("COALESCE(screening_id, id)")) return [{ dossier: DOSSIER } as unknown as T];
    const id = `${values[0]}/${values[1]}`;
    if (text.startsWith("SELECT refunded_at"))
      return charges.has(id) ? [{ refunded_at: charges.get(id)!.refunded ? NOW : null } as unknown as T] : [];
    if (text.startsWith("SELECT charge_ref")) {
      const c = charges.get(id);
      return c && !c.refunded ? [{ charge_ref: c.ref } as unknown as T] : [];
    }
    if (text.startsWith("INSERT INTO overage_charges")) charges.set(id, { ref: String(values[3]), refunded: false });
    if (text.startsWith("UPDATE overage_charges")) charges.get(id)!.refunded = true;
    return [];
  };
  const biller: OverageBiller = {
    async charge({ key, amountMinor }) {
      calls.push(`charge ${key} ${amountMinor}`);
      if (declined) throw new Error("declined");
      return { ref: `in_${key}` };
    },
    async refund(ref, key) {
      calls.push(`refund ${ref} ${key}`);
    },
    isDeclined: (error) => error instanceof Error && error.message === "declined",
  };
  return { query, biller, calls, decline: () => (declined = true) };
}
const sale = { accountId: "a", customerId: "cus_1", documentId: "d", cents: 300, now: NOW, description: "Dossier" };

describe("an overage is charged once per dossier and month (ADR-0015)", () => {
  it("charges the rate of the plan, before taxes, keyed by the dossier and the month", async () => {
    const { query, biller, calls } = fakes();
    await chargeOverage(query, biller, sale);
    expect(calls).toEqual([`charge overage-${DOSSIER}-2026-10 300`]);
  });

  it("a second check of the same dossier charges nothing more", async () => {
    const { query, biller, calls } = fakes();
    await chargeOverage(query, biller, sale);
    await chargeOverage(query, biller, sale);
    expect(calls).toHaveLength(1);
  });

  it("a declined card is a 402 PAYWALL and records nothing", async () => {
    const { query, biller, decline, calls } = fakes();
    decline();
    await expect(chargeOverage(query, biller, sale)).rejects.toMatchObject({ status: 402, body: { code: "PAYWALL" } });
    expect(await refundOverage(query, biller, "d", NOW)).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("a processor failure other than a refusal is not turned into a paywall", async () => {
    const { query, biller } = fakes();
    biller.charge = async () => {
      throw new TypeError("network");
    };
    await expect(chargeOverage(query, biller, sale)).rejects.toThrow("network");
  });

  it("a refund gives the charge back once, and the dossier can be charged again afterwards", async () => {
    const { query, biller, calls } = fakes();
    await chargeOverage(query, biller, sale);
    expect(await refundOverage(query, biller, "d", NOW)).toBe(true);
    expect(await refundOverage(query, biller, "d", NOW)).toBe(false);
    await chargeOverage(query, biller, sale);
    expect(calls).toEqual([
      `charge overage-${DOSSIER}-2026-10 300`,
      `refund in_overage-${DOSSIER}-2026-10 overage-${DOSSIER}-2026-10-refund`,
      `charge overage-${DOSSIER}-2026-10-again 300`,
    ]);
  });
});

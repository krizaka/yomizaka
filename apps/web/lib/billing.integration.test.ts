import { beforeAll, describe, expect, it } from "vitest";

import { applyPaymentEvent, entitlementOf, releaseAudit, reserveAudit } from "./billing";
import { migrate, query } from "./db";

/** The entitlements against a real PostgreSQL (skipped without YOMIZAKA_DB_IT=1 and DATABASE_URL, like db.integration.test.ts). */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;
const NOW = new Date("2026-10-22T12:00:00Z");

describe.runIf(enabled)("billing", () => {
  beforeAll(async () => {
    await migrate();
  });
  const account = async (selfServe = true) => {
    const [a] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash, email_verified_at, terms_accepted_at) VALUES ($1, 'x', now(), $2) RETURNING id", [`b-${Math.random().toString(36).slice(2)}@yomizaka.test`, selfServe ? NOW : null]);
    return a!.id;
  };
  it("an operator-created account is exempt", async () => {
    expect(await reserveAudit(query, await account(false), NOW, 100)).toBe("exempt");
  });
  it("the first audit is free, the second hits the paywall, a paid credit opens one more", async () => {
    const id = await account();
    expect(await reserveAudit(query, id, NOW, 100)).toBe("free");
    await expect(reserveAudit(query, id, NOW, 100)).rejects.toMatchObject({ status: 402, body: { code: "PAYWALL" } });
    expect(await applyPaymentEvent(query, { id: `evt-${id}`, type: "audit_paid", accountId: id, customerId: `cus-${id}` })).toBe("applied");
    expect(await reserveAudit(query, id, NOW, 100)).toBe("credit");
    await expect(reserveAudit(query, id, NOW, 100)).rejects.toMatchObject({ status: 402 });
  });
  it("a payment notification is idempotent: the same event credits once", async () => {
    const id = await account();
    await reserveAudit(query, id, NOW, 100);
    const event = { id: `evt-dup-${id}`, type: "audit_paid", accountId: id, customerId: null } as const;
    expect(await applyPaymentEvent(query, event)).toBe("applied");
    expect(await applyPaymentEvent(query, event)).toBe("duplicate");
    expect((await entitlementOf(query, id, NOW)).credits).toBe(1);
  });
  it("the free audit is given back when the run cannot start", async () => {
    const id = await account();
    const via = await reserveAudit(query, id, NOW, 100);
    await releaseAudit(query, id, via);
    expect(await reserveAudit(query, id, NOW, 100)).toBe("free");
  });
  it("two simultaneous requests cannot spend the same free audit", async () => {
    const id = await account();
    const results = await Promise.allSettled([reserveAudit(query, id, NOW, 100), reserveAudit(query, id, NOW, 100)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("Pro: unlimited under the cap, then FAIR_USE; cancelled, back to the paywall", async () => {
    const id = await account();
    await reserveAudit(query, id, NOW, 100);
    await applyPaymentEvent(query, { id: `evt-s1-${id}`, type: "subscription_started", accountId: id, customerId: `cus-${id}`, subscriptionId: `sub-${id}` });
    await applyPaymentEvent(query, { id: `evt-s2-${id}`, type: "subscription_changed", accountId: id, customerId: `cus-${id}`, subscriptionId: `sub-${id}`, status: "active", active: true, periodEnd: Math.floor(NOW.getTime() / 1000) + 86_400 * 30 });
    expect((await entitlementOf(query, id, NOW)).pro).toBe(true);
    expect(await reserveAudit(query, id, NOW, 100)).toBe("pro");
    const [doc] = await query<{ id: string }>("INSERT INTO documents (owner_id, title, filename, mime_type, size_bytes, sha256, content, text) VALUES ($1, 't', 'a.txt', 'text/plain', 1, $2, 'x', 'x') RETURNING id", [id, `h-${id}`]);
    await query("INSERT INTO analyses (document_id, studio, status) VALUES ($1, 'compliance-check', 'succeeded')", [doc!.id]);
    await expect(reserveAudit(query, id, NOW, 1)).rejects.toMatchObject({ status: 429, body: { code: "FAIR_USE" } });
    await applyPaymentEvent(query, { id: `evt-s3-${id}`, type: "subscription_changed", accountId: id, customerId: `cus-${id}`, subscriptionId: `sub-${id}`, status: "canceled", active: false, periodEnd: null });
    expect((await entitlementOf(query, id, NOW)).pro).toBe(false);
    await expect(reserveAudit(query, id, NOW, 100)).rejects.toMatchObject({ status: 402 });
  });
});

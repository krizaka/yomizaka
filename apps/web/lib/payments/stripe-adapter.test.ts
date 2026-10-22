import { describe, expect, it } from "vitest";

import { PaymentsError } from "./port";
import { formEncode, signPayload, stripeAdapter, translate, verifySignature } from "./stripe-adapter";

const SIGNING = "signing-material-for-unit-tests";
const NOW = 1_800_000_000;
const adapter = (fetchImpl: typeof fetch) => stripeAdapter({ secretKey: "test-api-key", webhookSecret: SIGNING, priceKeys: { audit: "k_audit", pro: "k_pro" }, fetch: fetchImpl });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("the webhook signature", () => {
  const body = JSON.stringify({ id: "evt_1", type: "x", data: { object: {} } });
  it("accepts a good signature inside the window", () => {
    expect(() => verifySignature(body, signPayload(body, SIGNING, NOW), SIGNING, NOW + 10)).not.toThrow();
  });
  it("refuses a wrong secret, an altered body, a missing header and a replay", () => {
    expect(() => verifySignature(body, signPayload(body, "other", NOW), SIGNING, NOW)).toThrow(PaymentsError);
    expect(() => verifySignature(`${body} `, signPayload(body, SIGNING, NOW), SIGNING, NOW)).toThrow(PaymentsError);
    expect(() => verifySignature(body, null, SIGNING, NOW)).toThrow(PaymentsError);
    expect(() => verifySignature(body, signPayload(body, SIGNING, NOW), SIGNING, NOW + 3600)).toThrow(PaymentsError);
  });
});

describe("the processor's events, in the domain's words", () => {
  const ev = (type: string, object: Record<string, unknown>) => ({ id: "evt_9", type, data: { object } });
  it("a paid audit checkout", () => {
    expect(translate(ev("checkout.session.completed", { mode: "payment", payment_status: "paid", customer: "cus_1", metadata: { account_id: "a1", kind: "audit" } }))).toEqual({ id: "evt_9", type: "audit_paid", accountId: "a1", customerId: "cus_1" });
  });
  it("an unpaid or foreign checkout is ignored", () => {
    expect(translate(ev("checkout.session.completed", { mode: "payment", payment_status: "unpaid", metadata: { account_id: "a1", kind: "audit" } })).type).toBe("ignored");
    expect(translate(ev("checkout.session.completed", { mode: "payment", payment_status: "paid", metadata: {} })).type).toBe("ignored");
    expect(translate(ev("charge.refunded", {})).type).toBe("ignored");
  });
  it("a subscription's life", () => {
    expect(translate(ev("checkout.session.completed", { mode: "subscription", customer: "cus_1", subscription: "sub_1", metadata: { account_id: "a1" } }))).toMatchObject({ type: "subscription_started", subscriptionId: "sub_1" });
    expect(translate(ev("customer.subscription.updated", { id: "sub_1", status: "active", customer: "cus_1", items: { data: [{ current_period_end: 1_900_000_000 }] } }))).toMatchObject({ type: "subscription_changed", active: true, periodEnd: 1_900_000_000 });
    expect(translate(ev("customer.subscription.deleted", { id: "sub_1", status: "active", customer: "cus_1" }))).toMatchObject({ status: "canceled", active: false });
    expect(translate(ev("customer.subscription.updated", { id: "sub_1", status: "past_due", customer: "cus_1" }))).toMatchObject({ active: false });
  });
});

describe("the adapter's calls", () => {
  it("reads the price by lookup key (prices are data) and opens Checkout with automatic tax (GST, QST) and an invoice", async () => {
    const calls: { url: string; body: string }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: String(init?.body ?? "") });
      return url.includes("/v1/prices") ? json({ data: [{ id: "price_audit" }] }) : json({ id: "cs_1", url: "https://checkout.example/pay" });
    }) as unknown as typeof fetch;
    const out = await adapter(fake).checkout({ kind: "audit", customerId: "cus_1", accountId: "a1", successUrl: "https://s", cancelUrl: "https://c", locale: "fr" });
    expect(out.url).toBe("https://checkout.example/pay");
    expect(calls[0]!.url).toContain("lookup_keys%5B0%5D=k_audit");
    const form = new URLSearchParams(calls[1]!.body);
    expect(form.get("mode")).toBe("payment");
    expect(form.get("line_items[0][price]")).toBe("price_audit");
    expect(form.get("automatic_tax[enabled]")).toBe("true");
    expect(form.get("tax_id_collection[enabled]")).toBe("true");
    expect(form.get("invoice_creation[enabled]")).toBe("true");
    expect(form.get("metadata[kind]")).toBe("audit");
    expect(form.get("locale")).toBe("fr");
  });
  it("Pro is a subscription carrying the account on the subscription", async () => {
    const bodies: string[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      bodies.push(String(init?.body ?? ""));
      return url.includes("/v1/prices") ? json({ data: [{ id: "price_pro" }] }) : json({ url: "https://checkout.example/pro" });
    }) as unknown as typeof fetch;
    await adapter(fake).checkout({ kind: "pro", customerId: "cus_1", accountId: "a1", successUrl: "s", cancelUrl: "c", locale: "en" });
    const form = new URLSearchParams(bodies[1]);
    expect(form.get("mode")).toBe("subscription");
    expect(form.get("subscription_data[metadata][account_id]")).toBe("a1");
    expect(form.get("invoice_creation[enabled]")).toBeNull();
  });
  it("a missing price is an error, not a guess", async () => {
    const fake = (async () => json({ data: [] })) as unknown as typeof fetch;
    await expect(adapter(fake).checkout({ kind: "pro", customerId: "c", accountId: "a", successUrl: "s", cancelUrl: "c", locale: "en" })).rejects.toThrow(/lookup key/);
  });
  it("encodes nested forms the way the processor reads them", () => {
    expect(formEncode({ a: { b: [1, { c: 2 }] }, d: true }).toString()).toBe("a%5Bb%5D%5B0%5D=1&a%5Bb%5D%5B1%5D%5Bc%5D=2&d=true");
  });
});

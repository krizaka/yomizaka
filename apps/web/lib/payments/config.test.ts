import { afterEach, describe, expect, it, vi } from "vitest";

import { paymentsFrom } from "./config";

const ON = { PAYMENTS_PROVIDER: "stripe", PAYMENTS_STRIPE_SECRET_KEY: "test-api-key", PAYMENTS_STRIPE_WEBHOOK_SECRET: "signing-material-for-unit-tests", PAYMENTS_PRICE_KEY_AUDIT: "k_audit", PAYMENTS_PRICE_KEY_PRO: "k_pro" };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe("the payments vendor is chosen here, from configuration", () => {
  it("is off without a provider or keys", () => {
    expect(paymentsFrom({ ...ON, PAYMENTS_PROVIDER: undefined })).toBeNull();
    expect(paymentsFrom({ ...ON, PAYMENTS_STRIPE_SECRET_KEY: undefined })).toBeNull();
    expect(paymentsFrom({ ...ON, PAYMENTS_STRIPE_WEBHOOK_SECRET: undefined })).toBeNull();
  });

  it("an audit is a one-off payment and Pro a subscription, each priced by its lookup key (same behaviour as before the shared package)", async () => {
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      return String(url).includes("/v1/prices") ? json({ data: [{ id: "price_x", unit_amount: 999, currency: "cad", recurring: null }] }) : json({ url: "https://checkout.example/pay" });
    });
    const port = paymentsFrom(ON)!;
    await port.checkout({ kind: "audit", customerId: "cus_1", accountId: "a1", successUrl: "https://s", cancelUrl: "https://c", locale: "fr" });
    await port.checkout({ kind: "pro", customerId: "cus_1", accountId: "a1", successUrl: "https://s", cancelUrl: "https://c", locale: "en" });
    expect(calls[0]!.url).toContain("lookup_keys%5B0%5D=k_audit");
    expect(new URLSearchParams(calls[1]!.body).get("mode")).toBe("payment");
    expect(calls[2]!.url).toContain("lookup_keys%5B0%5D=k_pro");
    expect(new URLSearchParams(calls[3]!.body).get("mode")).toBe("subscription");
  });
});

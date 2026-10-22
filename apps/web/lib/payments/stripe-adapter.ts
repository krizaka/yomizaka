import crypto from "node:crypto";

import { type CheckoutRequest, type PaymentEvent, PaymentsError, type PaymentsPort, type PlanKind } from "./port";

/**
 * The Stripe adapter of the payments port: a small client over `fetch` (no SDK: four calls and a signature check), so a
 * test passes a fake `fetch`. Prices are DATA in Stripe, found by lookup key (scripts/stripe-setup.mjs creates them); the
 * keys are configuration. Stripe Tax computes GST 5 % + QST 9.975 % from the buyer's address.
 */
export interface StripeAdapterConfig {
  secretKey: string;
  webhookSecret: string;
  /** Plan → Stripe price lookup key. */
  priceKeys: Record<PlanKind, string>;
  fetch?: typeof fetch;
  apiBase?: string;
}

/** Stripe's form encoding: nested keys as `a[b][0][c]=v`. */
export function formEncode(value: Record<string, unknown>): URLSearchParams {
  const out = new URLSearchParams();
  const walk = (v: unknown, key: string) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((item, i) => walk(item, `${key}[${i}]`));
    else if (typeof v === "object") for (const [k, item] of Object.entries(v)) walk(item, key ? `${key}[${k}]` : k);
    else out.append(key, String(v));
  };
  walk(value, "");
  return out;
}

const AUDIT: PlanKind = "audit";
const CHECKOUT_MODE: Record<PlanKind, string> = { audit: "payment", pro: "subscription" };

// @fixed: Stripe's documented replay tolerance for a webhook timestamp
const TOLERANCE_SECONDS = 300;

/** Checks `Stripe-Signature` (t=…,v1=…) over the raw body, constant-time, inside a replay window. */
export function verifySignature(rawBody: string, header: string | null, secret: string, nowSeconds: number): void {
  const items = (header ?? "").split(",");
  const t = Number(items.find((kv) => kv.startsWith("t="))?.slice(2));
  const signatures = items.filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  if (!Number.isFinite(t) || signatures.length === 0) throw new PaymentsError(400, "Missing signature");
  if (Math.abs(nowSeconds - t) > TOLERANCE_SECONDS) throw new PaymentsError(400, "Timestamp outside the tolerance");
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const ok = signatures.some((s) => {
    const given = Buffer.from(s, "hex");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
  if (!ok) throw new PaymentsError(400, "Bad signature");
}

/** A signed header — for tests and the setup script's self-check. */
export const signPayload = (rawBody: string, secret: string, t: number) => `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex")}`;

type Obj = Record<string, unknown> & { metadata?: Record<string, string>; customer?: string; id?: string };

/** Stripe's event, in the domain's words. Anything it does not need is `ignored`. */
export function translate(event: { id: string; type: string; data: { object: Record<string, unknown> } }): PaymentEvent {
  const o = event.data.object as Obj;
  const customerId = typeof o.customer === "string" ? o.customer : null;
  switch (event.type) {
    case "checkout.session.completed": {
      const accountId = o.metadata?.account_id ?? (typeof o.client_reference_id === "string" ? o.client_reference_id : undefined);
      if (!accountId) return { id: event.id, type: "ignored" };
      if (o.mode === "payment" && o.payment_status === "paid" && o.metadata?.kind === AUDIT) return { id: event.id, type: "audit_paid", accountId, customerId };
      if (o.mode === "subscription") return { id: event.id, type: "subscription_started", accountId, customerId, subscriptionId: typeof o.subscription === "string" ? o.subscription : null };
      return { id: event.id, type: "ignored" };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const status = event.type === "customer.subscription.deleted" ? "canceled" : String(o.status ?? "");
      const item = ((o.items as { data?: { current_period_end?: number }[] } | undefined)?.data ?? [])[0];
      return {
        id: event.id,
        type: "subscription_changed",
        accountId: o.metadata?.account_id ?? null,
        customerId,
        subscriptionId: String(o.id ?? ""),
        status,
        active: status === "active" || status === "trialing",
        periodEnd: item?.current_period_end ?? (typeof o.current_period_end === "number" ? o.current_period_end : null),
      };
    }
    default:
      return { id: event.id, type: "ignored" };
  }
}

export function stripeAdapter(config: StripeAdapterConfig): PaymentsPort & { priceId(kind: PlanKind): Promise<string> } {
  const doFetch = config.fetch ?? fetch;
  const base = (config.apiBase ?? "https://api.stripe.com").replace(/\/$/, "");
  async function call<T>(method: "GET" | "POST", path: string, params: Record<string, unknown> = {}, idempotencyKey?: string): Promise<T> {
    const form = formEncode(params);
    const res = await doFetch(`${base}${path}${method === "GET" && form.size ? `?${form}` : ""}`, {
      method,
      headers: { authorization: `Bearer ${config.secretKey}`, ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) },
      body: method === "POST" ? form : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) throw new PaymentsError(res.status, json.error?.message ?? `Stripe answered ${res.status}`);
    return json;
  }
  const priceId = async (kind: PlanKind) => {
    const list = await call<{ data: { id: string }[] }>("GET", "/v1/prices", { lookup_keys: [config.priceKeys[kind]], active: true, limit: 1 });
    const id = list.data[0]?.id;
    if (!id) throw new PaymentsError(404, `No active price with the lookup key ${config.priceKeys[kind]}`);
    return id;
  };
  return {
    priceId,
    createCustomer: (email, accountId) => call<{ id: string }>("POST", "/v1/customers", { email, metadata: { account_id: accountId } }, `customer-${accountId}`),
    async checkout(p: CheckoutRequest) {
      const session = await call<{ url: string }>("POST", "/v1/checkout/sessions", {
        mode: CHECKOUT_MODE[p.kind],
        customer: p.customerId,
        client_reference_id: p.accountId,
        line_items: [{ price: await priceId(p.kind), quantity: 1 }],
        automatic_tax: { enabled: true },
        customer_update: { address: "auto", name: "auto" },
        billing_address_collection: "required",
        tax_id_collection: { enabled: true },
        ...(p.kind === AUDIT ? { invoice_creation: { enabled: true } } : { subscription_data: { metadata: { account_id: p.accountId } } }),
        metadata: { account_id: p.accountId, kind: p.kind },
        success_url: p.successUrl,
        cancel_url: p.cancelUrl,
        locale: p.locale,
      });
      return { url: session.url };
    },
    portal: (customerId, returnUrl, locale) => call<{ url: string }>("POST", "/v1/billing_portal/sessions", { customer: customerId, return_url: returnUrl, locale }),
    parseWebhook(rawBody, headers, nowSeconds) {
      verifySignature(rawBody, headers.get("stripe-signature"), config.webhookSecret, nowSeconds);
      return translate(JSON.parse(rawBody));
    },
  };
}

#!/usr/bin/env node
// Creates, idempotently, what the payments adapter reads as DATA: the products and prices (found by lookup key) and the
// webhook endpoint. Test or live is decided by the key given. Never prints a key; a NEW webhook's signing secret is written
// to the file named by --secret-out (mode 0600), because the processor shows it once.
//
//   PAYMENTS_STRIPE_SECRET_KEY=… node scripts/payments-setup.mjs --webhook-url https://www.yomizaka.com/api/webhooks/payments --secret-out /path/file
const key = process.env.PAYMENTS_STRIPE_SECRET_KEY;
if (!key) throw new Error("PAYMENTS_STRIPE_SECRET_KEY is not set");
const args = process.argv.slice(2);
const flag = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
import { writeFileSync } from "node:fs";

async function call(method, path, params = {}) {
  const form = new URLSearchParams();
  const walk = (v, k) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${k}[${i}]`));
    else if (typeof v === "object") for (const [a, b] of Object.entries(v)) walk(b, k ? `${k}[${a}]` : a);
    else form.append(k, String(v));
  };
  walk(params, "");
  const res = await fetch(`https://api.stripe.com${path}${method === "GET" && form.size ? `?${form}` : ""}`, { method, headers: { authorization: `Bearer ${key}`, ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}) }, body: method === "POST" ? form : undefined });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${json.error?.message ?? res.status}`);
  return json;
}

const mode = key.startsWith("sk_live_") ? "LIVE" : "test";
console.log(`mode: ${mode}`);
if (mode === "LIVE" && !args.includes("--i-am-the-owner")) throw new Error("Live mode is the owner's: refusing");

// Products and prices, tax exclusive (Stripe Tax adds GST + QST), in Canadian dollars.
const PLANS = [
  { lookup: "yomizaka_audit_cad", name: "Yomizaka — one audit", amount: 999, recurring: undefined },
  { lookup: "yomizaka_pro_monthly_cad", name: "Yomizaka Pro — monthly", amount: 2900, recurring: { interval: "month" } },
];
for (const p of PLANS) {
  const existing = await call("GET", "/v1/prices", { lookup_keys: [p.lookup], active: true, limit: 1 });
  if (existing.data[0]) {
    console.log(`price ${p.lookup}: exists (${existing.data[0].unit_amount} ${existing.data[0].currency})`);
    continue;
  }
  const product = await call("POST", "/v1/products", { name: p.name, tax_code: "txcd_10103001", metadata: { product: "yomizaka" } }); // software as a service, business use
  const price = await call("POST", "/v1/prices", { product: product.id, currency: "cad", unit_amount: p.amount, tax_behavior: "exclusive", lookup_key: p.lookup, ...(p.recurring ? { recurring: p.recurring } : {}) });
  console.log(`price ${p.lookup}: created (${price.unit_amount} ${price.currency})`);
}

// The webhook endpoint.
const url = flag("webhook-url");
if (url) {
  const events = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];
  const list = await call("GET", "/v1/webhook_endpoints", { limit: 100 });
  const found = list.data.find((w) => w.url === url);
  if (found) console.log(`webhook ${url}: exists (${found.status}) — its signing secret is not shown again`);
  else {
    const created = await call("POST", "/v1/webhook_endpoints", { url, enabled_events: events, description: "Yomizaka payments" });
    const out = flag("secret-out");
    if (!out) throw new Error("A new webhook was created: pass --secret-out to keep its signing secret");
    writeFileSync(out, created.secret, { mode: 0o600 });
    console.log(`webhook ${url}: created, signing secret written to ${out}`);
  }
}

// Stripe Tax readiness (informative).
try {
  const settings = await call("GET", "/v1/tax/settings");
  const regs = await call("GET", "/v1/tax/registrations", { status: "all", limit: 20 });
  console.log(`tax: status ${settings.status}; head office ${settings.head_office?.address?.country ?? "missing"}; registrations: ${regs.data.map((r) => `${r.country}${r.country_options?.ca?.province_standard?.province ? "-" + r.country_options.ca.province_standard.province : ""}:${r.status}`).join(", ") || "none"}`);
} catch (e) {
  console.log(`tax: not readable (${e.message})`);
}

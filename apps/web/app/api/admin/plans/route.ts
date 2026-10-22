import { formatPrice } from "@krizaka/payments";

import { requireAdmin } from "@/lib/access";
import { env } from "@/lib/env";
import { handle } from "@/lib/http";
import { paymentsFrom } from "@/lib/payments/config";

export const dynamic = "force-dynamic";

const PLANS = [
  { kind: "audit", lookupKey: "PAYMENTS_PRICE_KEY_AUDIT" },
  { kind: "pro", lookupKey: "PAYMENTS_PRICE_KEY_PRO" },
] as const;

/** The prices, read from Stripe (they stay there: nothing here edits a price). What each plan includes is the settings' `plans.*`. */
export const GET = (req: Request) =>
  handle(async () => {
    await requireAdmin(req);
    const e = env();
    const port = paymentsFrom(e);
    if (!port) return Response.json({ stripe: null, prices: [] });
    const prices = await Promise.all(
      PLANS.map(async ({ kind, lookupKey }) => {
        try {
          const price = await port.price(kind);
          return { kind, lookupKey: e[lookupKey], fr: formatPrice(price, "fr"), en: formatPrice(price, "en"), interval: price.interval, currency: price.currency, error: null };
        } catch {
          return { kind, lookupKey: e[lookupKey], fr: null, en: null, interval: null, currency: null, error: "PRICE_NOT_FOUND" };
        }
      }),
    );
    return Response.json({ stripe: { mode: e.PAYMENTS_STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : "test" }, prices }, { headers: { "Cache-Control": "private, no-store" } });
  });

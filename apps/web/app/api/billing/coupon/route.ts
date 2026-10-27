import { z } from "zod";

import { requireSession } from "@/lib/access";
import { clientAddress } from "@/lib/client-address";
import { hasPaidBefore } from "@/lib/coupons/checkout";
import { coupons,guarded } from "@/lib/coupons/instance";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, readJson, refuse } from "@/lib/http";
import { paymentsFrom } from "@/lib/payments/config";
import { appPrices } from "@/lib/prices/catalogue";
import { soldEntry } from "@/lib/prices/plan";
import { SOLD_KINDS, type SoldKind } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const body = z.object({ code: z.string().trim().min(1).max(80), kind: z.enum(SOLD_KINDS as [SoldKind, ...SoldKind[]]) });

/**
 * « Apply » on the promo code field: what a discount code would take off this purchase, or why not (a typed refusal the page words). Read-only, it reserves nothing;
 * each try counts on the attempt limits (per address and per account) before any lookup. Credit codes are redeemed at `/api/billing/coupon/redeem`.
 */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const { code, kind } = await readJson(req, body);
    if (!paymentsFrom(env())) throw refuse(503, "PAYMENTS_OFF", "Payment is not available yet");
    const sold = await soldEntry(appPrices(), kind, new Date());
    if (sold.amountCents === null) throw refuse(409, "NOT_ON_SALE", "This price is not on sale");
    const paid = await hasPaidBefore(query, session.account.id);
    const result = await guarded(() =>
      coupons.validate(query, code, { mode: "checkout", accountId: session.account.id, plan: kind, amountMinor: sold.amountCents!, currency: sold.currency.toLowerCase(), hasPaidBefore: paid, ip: clientAddress(req.headers) }),
    );
    if (!result.ok) throw refuse(422, result.code, "This code cannot be used", result.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: result.retryAfterSeconds });
    return Response.json({ coupon: { code: result.coupon.code, kind: result.coupon.kind, endsAt: result.coupon.endsAt?.toISOString() ?? null }, effect: result.effect }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

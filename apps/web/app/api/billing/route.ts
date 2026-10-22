import { requireSession } from "@/lib/access";
import { entitlementOf } from "@/lib/billing";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { handle } from "@/lib/http";
import { paymentsFrom } from "@/lib/payments/config";

export const dynamic = "force-dynamic";

/** What the account may do: the free audit, credits, Pro — and whether payment is switched on (the paywall's button depends on it). */
export function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const entitlement = await entitlementOf(query, session.account.id, new Date());
    return Response.json({ entitlement, paymentsOn: paymentsFrom(env()) !== null, fairUsePerMonth: env().APP_FAIR_USE_AUDITS_PER_MONTH }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

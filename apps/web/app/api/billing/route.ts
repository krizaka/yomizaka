import { requireSession } from "@/lib/access";
import { entitlementOf } from "@/lib/billing";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { handle } from "@/lib/http";
import { paymentsFrom } from "@/lib/payments/config";
import { auditCapsOf } from "@/lib/settings/boundary";
import { settingsFor } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

/** What the account may do: the free audit, credits, Pro — and whether payment is switched on (the paywall's button depends on it). */
export function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const entitlement = await entitlementOf(query, session.account.id, new Date());
    const settings = await settingsFor(session.account.id);
    const caps = auditCapsOf(settings, "pro");
    return Response.json({ entitlement, paymentsOn: paymentsFrom(env()) !== null && settings["payments.enabled"].value === true, paymentsDisplay: settings["payments.display"].value, fairUsePerMonth: caps.perMonth }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

import { publicCatalogue } from "@krizaka/settings";

import { requireSession } from "@/lib/access";
import { entitlementOf } from "@/lib/billing";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { handle } from "@/lib/http";
import { paymentsFrom } from "@/lib/payments/config";
import { capsFor } from "@/lib/prices/caps";
import { appPrices } from "@/lib/prices/catalogue";
import { SOLD, SOLD_KINDS } from "@/lib/pricing";
import { settingsFor } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

const SOLD_KEYS = new Set<string>(SOLD_KINDS.map((k) => SOLD[k].key));

/**
 * What the account may do: the free audit, credits, a subscription — whether payment is switched on (the paywall's buttons
 * depend on it), the verifications its subscription includes, and the prices on sale, read from the catalogue (never internal).
 */
export function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const now = new Date();
    const entitlement = await entitlementOf(query, session.account.id, now);
    const settings = await settingsFor(session.account.id);
    const caps = await capsFor(settings, now)("pro", entitlement);
    const prices = publicCatalogue(await appPrices().catalogue(now)).filter((p) => SOLD_KEYS.has(p.key));
    return Response.json(
      { entitlement, paymentsOn: paymentsFrom(env()) !== null && settings["payments.enabled"].value === true, paymentsDisplay: settings["payments.display"].value, fairUsePerMonth: caps.perMonth, prices },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  });
}

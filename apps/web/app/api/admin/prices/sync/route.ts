import { describePrices } from "@krizaka/settings";

import { requireAdmin } from "@/lib/access";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { handle, refuse } from "@/lib/http";
import { processorSync } from "@/lib/payments/processor-sync";
import { appPrices } from "@/lib/prices/catalogue";

export const dynamic = "force-dynamic";

/** Brings the processor's prices to the catalogue in force (test mode only; a live key is the owner's). Idempotent, audited. */
export const POST = (req: Request) =>
  handle(async () => {
    const session = await requireAdmin(req);
    const { entries } = await describePrices(appPrices(), new Date());
    const result = await processorSync(env(), entries);
    if (result === "off") throw refuse(409, "PAYMENTS_OFF", "Payments are not configured on this installation");
    if (result === "live") throw refuse(409, "LIVE_PRICES_ARE_THE_OWNERS", "The processor is in live mode: its prices are changed by the owner");
    await audit({ action: "prices.synced", actorId: session.account.id, actorLabel: session.account.email, targetId: null, detail: { prices: result.prices.map((p) => `${p.lookupKey}:${p.status}`) }, headers: req.headers });
    return Response.json({ sync: result });
  });

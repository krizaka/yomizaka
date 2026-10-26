import { z } from "zod";

import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { recordCheckout } from "@/lib/billing";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, readJson, refuse } from "@/lib/http";
import { paymentsFrom } from "@/lib/payments/config";
import { appPrices } from "@/lib/prices/catalogue";
import { onSale, soldEntry } from "@/lib/prices/plan";
import { SOLD_KINDS, type SoldKind } from "@/lib/pricing";
import { limit } from "@/lib/rate-limit";
import { appSettings } from "@/lib/settings/instance";

export const dynamic = "force-dynamic";

const body = z.object({ kind: z.enum(SOLD_KINDS as [SoldKind, ...SoldKind[]]) });

/**
 * A hosted payment page for one document or a subscription (Agencies, Law firms). The amount is the price catalogue's in force:
 * the processor's price must equal it (503 PRICE_MISMATCH otherwise), and the account records the version it is sold at.
 * 503 PAYMENTS_OFF while the keys are not configured.
 */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("checkout", req, session.account.id, [30, 3600], [10, 3600]);
    const port = paymentsFrom(env());
    if (!port || !(await appSettings().get("payments.enabled", { userId: session.account.id }))) throw refuse(503, "PAYMENTS_OFF", "Payment is not available yet");
    const { kind } = await readJson(req, body);
    const sold = onSale(await soldEntry(appPrices(), kind, new Date()), await port.price(kind));
    const [row] = await query<{ payment_customer_id: string | null }>("SELECT payment_customer_id FROM accounts WHERE id = $1", [session.account.id]);
    let customerId = row?.payment_customer_id ?? null;
    if (!customerId) {
      customerId = (await port.createCustomer(session.account.email, session.account.id)).id;
      await query("UPDATE accounts SET payment_customer_id = COALESCE(payment_customer_id, $2) WHERE id = $1", [session.account.id, customerId]);
    }
    await recordCheckout(query, session.account.id, sold);
    const home = `${env().APP_PUBLIC_URL}/${session.account.locale}/app`;
    const { url } = await port.checkout({ kind, customerId, accountId: session.account.id, successUrl: `${home}?paid=${kind}`, cancelUrl: `${home}?paid=cancelled`, locale: session.account.locale });
    await audit({ action: "billing.checkout_started", actorId: session.account.id, actorLabel: session.account.email, detail: { kind, price: sold.key, versionId: sold.versionId, amountCents: sold.amountCents }, headers: req.headers });
    return Response.json({ url });
  });
}

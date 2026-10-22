import { z } from "zod";

import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, readJson, refuse } from "@/lib/http";
import { paymentsFrom } from "@/lib/payments/config";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const body = z.object({ kind: z.enum(["audit", "pro"]) });

/** A hosted payment page for one audit or the Pro plan. 503 PAYMENTS_OFF while the keys are not configured. */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("checkout", req, session.account.id, [30, 3600], [10, 3600]);
    const port = paymentsFrom(env());
    if (!port) throw refuse(503, "PAYMENTS_OFF", "Payment is not available yet");
    const { kind } = await readJson(req, body);
    const [row] = await query<{ payment_customer_id: string | null }>("SELECT payment_customer_id FROM accounts WHERE id = $1", [session.account.id]);
    let customerId = row?.payment_customer_id ?? null;
    if (!customerId) {
      customerId = (await port.createCustomer(session.account.email, session.account.id)).id;
      await query("UPDATE accounts SET payment_customer_id = COALESCE(payment_customer_id, $2) WHERE id = $1", [session.account.id, customerId]);
    }
    const home = `${env().APP_PUBLIC_URL}/${session.account.locale}/app`;
    const { url } = await port.checkout({ kind, customerId, accountId: session.account.id, successUrl: `${home}?paid=${kind}`, cancelUrl: `${home}?paid=cancelled`, locale: session.account.locale });
    await audit({ action: "billing.checkout_started", actorId: session.account.id, actorLabel: session.account.email, detail: { kind }, headers: req.headers });
    return Response.json({ url });
  });
}

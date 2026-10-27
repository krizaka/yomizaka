import { PaymentsError } from "@krizaka/payments";

import { applyPaymentEvent } from "@/lib/billing";
import { transaction } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, refuse } from "@/lib/http";
import { paymentsFrom } from "@/lib/payments/config";

export const dynamic = "force-dynamic";

/** The processor's notifications: verified over the raw body, each event applied once (idempotent), 200 on replay. */
export function POST(req: Request) {
  return handle(async () => {
    const port = paymentsFrom(env());
    if (!port) throw refuse(503, "PAYMENTS_OFF", "Payment is not available yet");
    const raw = await req.text();
    let outcome: Awaited<ReturnType<typeof applyPaymentEvent>>;
    try {
      outcome = await applyPaymentEvent(transaction, port.parseWebhook(raw, req.headers, Math.floor(Date.now() / 1000)));
    } catch (error) {
      if (error instanceof PaymentsError) throw refuse(400, "BAD_NOTIFICATION", "Notification not accepted");
      throw error;
    }
    return Response.json({ received: true, outcome });
  });
}

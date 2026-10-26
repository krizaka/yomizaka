import { requireSession } from "@/lib/access";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { handle, refuse } from "@/lib/http";
import { limit } from "@/lib/limits";
import { paymentsFrom } from "@/lib/payments/config";

export const dynamic = "force-dynamic";

/** The customer portal: subscription, payment method, invoices (with GST and QST numbers). */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    await limit("portal", req, session.account.id);
    const port = paymentsFrom(env());
    if (!port) throw refuse(503, "PAYMENTS_OFF", "Payment is not available yet");
    const [row] = await query<{ payment_customer_id: string | null }>("SELECT payment_customer_id FROM accounts WHERE id = $1", [session.account.id]);
    if (!row?.payment_customer_id) throw refuse(409, "NO_CUSTOMER", "Nothing has been bought yet");
    const { url } = await port.portal(row.payment_customer_id, `${env().APP_PUBLIC_URL}/${session.account.locale}/app/settings`, session.account.locale);
    return Response.json({ url });
  });
}

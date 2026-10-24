import { z } from "zod";

import { storesOf } from "@/app/active-store";
import { activeConsents, APPLICATION_ERASED, CONSENT_MEANS, CONSENT_PURPOSE, type ConsentPurpose, eraseApplication, grantConsent, NOTICE_VERSION, withdrawConsent } from "@/lib/applicant-consent";
import { handle, readJson, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { byToken } from "@/lib/screening";

export const dynamic = "force-dynamic";

const token = z.string().min(20).max(80);
const purpose = z.enum([CONSENT_PURPOSE.DOCUMENT_CHECK, CONSENT_PURPOSE.COURT_RECORDS, CONSENT_PURPOSE.CREDIT]);
const body = z.discriminatedUnion("action", [
  z.object({ token, action: z.literal("view") }),
  z.object({ token, action: z.literal("grant"), purpose, noticeVersion: z.string().min(1).max(40) }),
  z.object({ token, action: z.literal("withdraw"), purpose }),
  z.object({ token, action: z.literal("erase") }),
]);

/**
 * The applicant's side of yomizaka#131, reached by the link the landlord handed over (the same token as a screening): read the
 * notice state, consent or withdraw per purpose, or ask for the deletion of the application's documents and result. No account
 * is needed; rate-limited by address; every change is audit-logged without personal data.
 */
export function POST(req: Request) {
  return handle(async () => {
    limit("applicant", req, null, [60, 600]);
    const input = await readJson(req, body);
    const now = new Date();
    const app = await byToken(input.token);
    if (app.status === APPLICATION_ERASED) throw refuse(410, "APPLICATION_ERASED", "This application was erased");
    if (input.action === "grant") await grantConsent(app.id, input.purpose, { noticeVersion: input.noticeVersion, means: CONSENT_MEANS.WEB_FORM }, now, req.headers);
    if (input.action === "withdraw") await withdrawConsent(app.id, input.purpose, now, req.headers);
    if (input.action === "erase") {
      await eraseApplication(app.id, app.landlord_id, (await storesOf(app.landlord_id)).write, now, req.headers);
      return Response.json({ erased: true }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const active = await activeConsents(app.id);
    const purposes = Object.values(CONSENT_PURPOSE) as ConsentPurpose[];
    return Response.json({ noticeVersion: NOTICE_VERSION, purposes: purposes.map((p) => ({ purpose: p, granted: active.includes(p) })) }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

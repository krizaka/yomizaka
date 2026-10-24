import { z } from "zod";

import { mailConfigured, resetAccountService } from "@/app/accounts-edge";
import { audit } from "@/lib/audit";
import { handle, readJson, refuse } from "@/lib/http";
import { requestReset } from "@/lib/password-reset";
import { assertOpen } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().email().max(320) });

/**
 * « Forgot your password? »: mails a link to choose a new one. 202 whether or not the address has an account (nothing is
 * disclosed); 503 for everyone while e-mail cannot be sent. 3 requests an hour per address, 10 per client.
 */
export function POST(req: Request) {
  return handle(async () => {
    await assertOpen({ role: "USER" });
    if (!mailConfigured()) throw refuse(503, "MAIL_OFF", "E-mail sending is not available");
    const input = await readJson(req, body);
    await requestReset({ accounts: await resetAccountService(), audit }, input, req, new Date());
    return Response.json({ ok: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
  });
}

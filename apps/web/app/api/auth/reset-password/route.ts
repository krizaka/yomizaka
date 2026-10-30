import { isLinkToken } from "@krizaka/auth";
import { z } from "zod";

import { resetAccountService } from "@/app/accounts-edge";
import { audit } from "@/lib/audit";
import { handle, readJson } from "@/lib/http";
import { applyReset } from "@/lib/password-reset";
import { assertOpen } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

const body = z.object({
  token: z.string().refine((value) => isLinkToken("ye", value)),
  password: z.string().min(1).max(1024),
});

/** The new password, from the mailed link: single use, time-limited, every session signed out. Then the person signs in. */
export function POST(req: Request) {
  return handle(async () => {
    await assertOpen({ role: "USER" });
    const input = await readJson(req, body);
    await applyReset({ accounts: await resetAccountService(), audit }, input, req, new Date());
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  });
}

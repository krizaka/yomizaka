import { z } from "zod";

import { accountService, mailConfigured } from "@/app/accounts-edge";
import { accountAct } from "@/lib/account/act";
import { audit } from "@/lib/audit";
import { readJson, refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Asks to change the address: the password is checked, a link goes to the NEW address. 503 MAIL_OFF while mail is not configured. */
export const POST = (req: Request) => accountAct(req, "email-change", async (s) => {
  if (!mailConfigured()) throw refuse(503, "MAIL_OFF", "E-mail is not available yet");
  const input = await readJson(req, z.object({ newEmail: z.string().trim().max(320), password: z.string().min(1).max(256) }));
  await accountService().requestEmailChange(s.account.id, input, new Date());
  await audit({ action: "profile.email_change_requested", actorId: s.account.id, actorLabel: s.account.email, targetId: s.account.id, headers: req.headers });
  return { ok: true };
});

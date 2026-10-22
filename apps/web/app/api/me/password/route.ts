import { z } from "zod";

import { accountService } from "@/app/accounts-edge";
import { accountAct } from "@/lib/account/act";
import { audit } from "@/lib/audit";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Changes the password (the current one is checked); every other session is signed out. */
export const PUT = (req: Request) => accountAct(req, "password", async (s) => {
  const input = await readJson(req, z.object({ current: z.string().min(1).max(256), next: z.string().min(1).max(256) }));
  await accountService().changePassword(s.account.id, input, s.id);
  await audit({ action: "profile.password_changed", actorId: s.account.id, actorLabel: s.account.email, targetId: s.account.id, headers: req.headers });
  return { ok: true };
});

import { systemClock } from "@/app/system-clock";
import { accountAct } from "@/lib/account/act";
import { apiKeys, keyAct } from "@/lib/api-access";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Revokes a key: it stops working at once. Revoking twice is fine. */
export const DELETE = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  accountAct(req, "api-keys", async (s) => {
    const { id } = await params;
    await keyAct(() => apiKeys(systemClock).revoke(s.account.id, id));
    await audit({
      action: "apikey.revoked",
      actorId: s.account.id,
      actorLabel: s.account.email,
      targetId: id,
      headers: req.headers,
    });
    return { ok: true };
  });

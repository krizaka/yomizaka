import { systemClock } from "@/app/system-clock";
import { accountAct } from "@/lib/account/act";
import { apiKeys, assertKeysAllowed, keyAct } from "@/lib/api-access";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Replaces a key by a new one (same name, scopes and length of life). The old key keeps working for the grace period; the new key is in this answer only. */
export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  accountAct(req, "api-keys", async (s) => {
    const { id } = await params;
    const maxActive = await assertKeysAllowed(s.account.id, systemClock.now());
    const keys = apiKeys(systemClock);
    const { key, record } = await keyAct(() => keys.rotate(s.account.id, id, { maxActive }));
    await audit({ action: "apikey.rotated", actorId: s.account.id, actorLabel: s.account.email, targetId: record.id, detail: { replaced: id, name: record.name }, headers: req.headers });
    return new Response(JSON.stringify({ key, apiKey: keys.publicView(record) }), { status: 201, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
  });

import { systemClock } from "@/app/system-clock";
import { apiCaller } from "@/lib/api-v1/caller";
import { audit } from "@/lib/audit";
import { advanceBatch } from "@/lib/batch/run";
import { isUuid } from "@/lib/documents";
import { appEnvironment } from "@/lib/env";
import { handle, refuse } from "@/lib/http";
import { settingsFor } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

/** A batch, read back with a key (`reports:read`) and advanced as it is read: each row's state, document and reason. */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const caller = await apiCaller(req, "reports:read", systemClock);
    const id = (await params).id;
    if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such batch");
    const batch = await advanceBatch(caller.account, id, { settings: await settingsFor(caller.account.id), now: systemClock.now(), environment: appEnvironment() });
    await audit({ action: "api.batch.read", actorId: caller.account.id, actorLabel: `api-key:${caller.keyId}`, targetId: batch.id, detail: { counts: batch.counts }, headers: req.headers });
    return Response.json({ batch });
  });
}

import { systemClock } from "@/app/system-clock";
import { getAnalysis } from "@/lib/analyses";
import { apiCaller } from "@/lib/api-v1/caller";
import { checkView, hasReport } from "@/lib/api-v1/checks";
import { audit } from "@/lib/audit";
import { advanceBatch } from "@/lib/batch/run";
import { isUuid } from "@/lib/documents";
import { appEnvironment } from "@/lib/env";
import { handle, refuse } from "@/lib/http";
import { settingsFor } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

/** A check, read back with a key (`reports:read`) and advanced as it is read, like the web page does. */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const caller = await apiCaller(req, "reports:read", systemClock);
    const id = (await params).id;
    if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such check");
    const batch = await advanceBatch(caller.account, id, { settings: await settingsFor(caller.account.id), now: systemClock.now(), environment: appEnvironment() });
    if (batch.items.length !== 1) throw refuse(404, "NOT_FOUND", "No such check");
    const [item] = batch.items;
    const finished = item?.documentId && item.analysisId && hasReport(item.state);
    const report = finished ? (await getAnalysis(caller.account.id, item.documentId!, item.analysisId!)).report : null;
    const check = checkView(batch, report);
    await audit({ action: "api.check.read", actorId: caller.account.id, actorLabel: `api-key:${caller.keyId}`, targetId: check.id, detail: { state: check.state }, headers: req.headers });
    return Response.json({ check });
  });
}

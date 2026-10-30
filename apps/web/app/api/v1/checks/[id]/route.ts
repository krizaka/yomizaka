import { getAnalysis } from "@/lib/analyses";
import { checkView, hasReport } from "@/lib/api-v1/checks";
import { readAdvanced } from "@/lib/api-v1/read";
import { audit } from "@/lib/audit";
import { appEnvironment } from "@/lib/env";
import { handle, refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** A check, read back with a key (`reports:read`), advanced as it is read, with its report once it is done. */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { caller, batch } = await readAdvanced(req, params, "check", appEnvironment());
    if (batch.items.length !== 1) throw refuse(404, "NOT_FOUND", "No such check");
    const [item] = batch.items;
    const finished = item?.documentId && item.analysisId && hasReport(item.state);
    const report = finished ? (await getAnalysis(caller.account.id, item.documentId!, item.analysisId!)).report : null;
    const check = checkView(batch, report);
    await audit({
      action: "api.check.read",
      actorId: caller.account.id,
      actorLabel: `api-key:${caller.keyId}`,
      targetId: check.id,
      detail: { state: check.state },
      headers: req.headers,
    });
    return Response.json({ check });
  });
}

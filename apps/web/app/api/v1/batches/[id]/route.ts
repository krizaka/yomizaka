import { readAdvanced } from "@/lib/api-v1/read";
import { audit } from "@/lib/audit";
import { appEnvironment } from "@/lib/env";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

/** A batch, read back with a key (`reports:read`) and advanced as it is read: each row's state, document and reason. */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { caller, batch } = await readAdvanced(req, params, "batch", appEnvironment());
    await audit({ action: "api.batch.read", actorId: caller.account.id, actorLabel: `api-key:${caller.keyId}`, targetId: batch.id, detail: { counts: batch.counts }, headers: req.headers });
    return Response.json({ batch });
  });
}

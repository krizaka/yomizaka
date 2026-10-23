import { requireSession } from "@/lib/access";
import { advanceBatch } from "@/lib/batch/run";
import { isUuid } from "@/lib/documents";
import { appEnvironment } from "@/lib/env";
import { handle } from "@/lib/http";
import { refuse } from "@/lib/http";
import { settingsFor } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

/** A batch, advanced as it is read (the page asks again while rows run): running rows read back, pending ones started. */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    const id = (await params).id;
    if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such batch");
    return Response.json({ batch: await advanceBatch(session.account, id, { settings: await settingsFor(session.account.id), now: new Date(), environment: appEnvironment() }) });
  });
}

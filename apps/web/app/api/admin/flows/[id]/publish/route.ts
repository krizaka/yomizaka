import { z } from "zod";

import { requireAdmin } from "@/lib/access";
import { isUuid } from "@/lib/documents";
import { publish } from "@/lib/flows";
import { handle, readJson, refuse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Publishes a draft: it becomes immutable and the flow's current version (the previous one is retired; its analyses keep their id). */
export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin(req);
    const { id } = await params;
    if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such flow");
    const input = await readJson(req, z.object({ versionId: z.string().uuid() }));
    return Response.json(
      await publish({ id: session.account.id, email: session.account.email }, id, input.versionId, req.headers),
    );
  });
}

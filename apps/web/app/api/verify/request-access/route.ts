import { z } from "zod";

import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { loadTarget, requestAccess } from "@/lib/report-access";

export const dynamic = "force-dynamic";

const body = z.object({ runId: z.string().min(1).max(200), documentSha256: z.string().regex(/^[0-9a-f]{64}$/) });

/**
 * « Demander l'accès »: a signed-in member asks the owner of a report to share it. The owner sees the request beside the
 * report's grants. The answer is the same 202 whether the report exists or not (a stranger learns nothing), and a request
 * is rate-limited per account.
 */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    const who = { id: session.account.id, email: session.account.email };
    limit("verify-request", req, who.id, [30, 3600], [10, 3600]);
    const input = await readJson(req, body);
    const target = await loadTarget(input.runId, input.documentSha256);
    const { recorded } = await requestAccess(who, target);
    if (recorded) await audit({ action: "report.access_requested", actorId: who.id, actorLabel: who.email, targetId: target?.analysisId ?? null, detail: { runId: input.runId }, headers: req.headers });
    return Response.json({ requested: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
  });
}

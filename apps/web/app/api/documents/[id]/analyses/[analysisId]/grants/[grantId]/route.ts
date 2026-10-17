import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle } from "@/lib/http";
import { revokeGrant } from "@/lib/report-access";

export const dynamic = "force-dynamic";

/** Withdraws a grant: from this moment the person can no longer verify the report. Owner only. */
export function DELETE(req: Request, { params }: { params: Promise<{ id: string; analysisId: string; grantId: string }> }) {
  return handle(async () => {
    const session = await requireSession(req);
    const { id, analysisId, grantId } = await params;
    const revoked = await revokeGrant(session.account.id, id, analysisId, grantId);
    await audit({ action: "report.access_revoked", actorId: session.account.id, actorLabel: session.account.email, targetId: analysisId, detail: { grantId, grantee: revoked.email, runId: revoked.runId }, headers: req.headers });
    return new Response(null, { status: 204 });
  });
}

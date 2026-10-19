import { z } from "zod";

import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { createGrant, listSharing } from "@/lib/report-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; analysisId: string }> };

/** Who may verify this report: the grants (member / invited / expired / revoked) and the open requests. Owner only. */
export function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession(req);
    const { id, analysisId } = await params;
    return Response.json(await listSharing(session.account.id, id, analysisId, new Date()), { headers: { "Cache-Control": "private, no-store" } });
  });
}

const body = z.object({ email: z.string().trim().toLowerCase().email().max(254), expiresAt: z.iso.datetime({ offset: true }).nullable().optional() });

/** Shares the report with an e-mail. A member has access at once; an address with no account is an invitation, honoured when the account exists. */
export function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("report-grant", req, session.account.id, [60, 3600], [30, 3600]);
    const { id, analysisId } = await params;
    const input = await readJson(req, body);
    const made = await createGrant({ id: session.account.id, email: session.account.email }, id, analysisId, { email: input.email, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }, new Date());
    await audit({ action: "report.access_granted", actorId: session.account.id, actorLabel: session.account.email, targetId: analysisId, detail: { grantId: made.grantId, grantee: input.email, member: made.member, runId: made.runId, expiresAt: input.expiresAt ?? null }, headers: req.headers });
    return Response.json({ grantId: made.grantId, status: made.member ? "member" : "invited" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}

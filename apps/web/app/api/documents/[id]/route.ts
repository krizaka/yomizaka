import { startAnalysis as startAnalysisBody } from "@yomizaka/core";

import { requireSession } from "@/lib/access";
import { startAnalysis } from "@/lib/analyses";
import { audit } from "@/lib/audit";
import { deleteDocument, getDocument } from "@/lib/documents";
import { appEnvironment } from "@/lib/env";
import { resolveStart } from "@/lib/flows";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export function GET(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(req);
    return Response.json({ document: await getDocument(session.account.id, (await params).id) });
  });
}

/** Starts an Orazaka run on the document: `{ studio: "compliance-check", jurisdiction, asOf? }` or `{ studio: "document-authenticity", expectedIssuer? }`. */
export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("analysis", req, session.account.id, [60, 3600], [30, 3600]);
    const id = (await params).id;
    const request = await readJson(req, startAnalysisBody);
    // The flow decides: enabled, offered to this person, and every consent it requires granted (403 otherwise).
    const { flowVersionId } = await resolveStart(session.account, request.studio, appEnvironment());
    const analysis = await startAnalysis(session.account.id, id, request, flowVersionId);
    await audit({ action: "analysis.started", actorId: session.account.id, actorLabel: session.account.email, targetId: id, detail: { studio: request.studio, runId: analysis.runId }, headers: req.headers });
    return Response.json({ analysis }, { status: 202 });
  });
}

export function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(req);
    const id = (await params).id;
    await deleteDocument(session.account.id, id);
    await audit({ action: "document.deleted", actorId: session.account.id, actorLabel: session.account.email, targetId: id, headers: req.headers });
    return new Response(null, { status: 204 });
  });
}

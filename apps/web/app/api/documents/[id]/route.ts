import { startAnalysis as startAnalysisBody } from "@yomizaka/core";

import { storeForDocument, storesOf } from "@/app/active-store";
import { requireSession } from "@/lib/access";
import { getAnalysis, startAnalysis } from "@/lib/analyses";
import { audit } from "@/lib/audit";
import { releaseAudit, reserveAudit } from "@/lib/billing";
import { query } from "@/lib/db";
import { deleteDocument, documentStorage, getDocument, isPhotoDocument } from "@/lib/documents";
import { appEnvironment } from "@/lib/env";
import { resolveStart } from "@/lib/flows";
import { handle, readJson, refuse } from "@/lib/http";
import { findReusableAnalysis, recordPreflight } from "@/lib/preflight-events";
import { limit } from "@/lib/rate-limit";
import { auditCapsOf, withFeatures } from "@/lib/settings/boundary";
import { insightFeatures, settingsFor } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export function GET(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(req);
    const id = (await params).id;
    const features = await insightFeatures(session.account.id);
    return Response.json({ document: { ...withFeatures(await getDocument(session.account.id, id), features), ...(await documentStorage(session.account.id, id, (await storesOf(session.account.id)).describe)) } });
  });
}

/** Starts an Orazaka run on the document: `{ studio: "compliance-check", jurisdiction, asOf? }` or `{ studio: "document-authenticity", expectedIssuer? }`. */
export function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("analysis", req, session.account.id, [60, 3600], [30, 3600]);
    const id = (await params).id;
    const request = await readJson(req, startAnalysisBody);
    if (request.studio === "document-authenticity" && (await isPhotoDocument(session.account.id, id))) throw refuse(422, "PHOTO_AUTHENTICITY", "A document made from photos has no file of its own to examine");
    // The flow decides: enabled, offered to this person, and every consent it requires granted (403 otherwise).
    const { flowVersionId } = await resolveStart(session.account, request.studio, appEnvironment(), request.studio === "compliance-check" ? request.ruleset : undefined);
    const settings = await settingsFor(session.account.id);
    // Reuse: the same document, Studio and rules under the same Studio version already have a result — no new run, no audit spent.
    const reusable = await findReusableAnalysis(query, { reuseDays: settings["limits.reuseDays"].value as number, now: new Date(), ownerId: session.account.id, documentId: id, studio: request.studio, jurisdiction: request.studio === "compliance-check" ? request.jurisdiction : null, ruleset: request.studio === "compliance-check" ? (request.ruleset ?? null) : null, expectedIssuer: request.studio === "document-authenticity" ? (request.expectedIssuer ?? null) : null });
    if (reusable) {
      await recordPreflight(query, session.account.id, "reused");
      return Response.json({ analysis: await getAnalysis(session.account.id, id, reusable), reused: true });
    }
    // Entitlement: the free audit, a credit or Pro (402 PAYWALL otherwise); given back if the run cannot start.
    const via = await reserveAudit(query, session.account.id, new Date(), (plan) => auditCapsOf(settings, plan));
    let analysis;
    try {
      analysis = await startAnalysis(session.account.id, id, request, flowVersionId, via, await storeForDocument(session.account.id, id));
    } catch (error) {
      await releaseAudit(query, session.account.id, via);
      throw error;
    }
    await audit({ action: "analysis.started", actorId: session.account.id, actorLabel: session.account.email, targetId: id, detail: { studio: request.studio, runId: analysis.runId, via }, headers: req.headers });
    return Response.json({ analysis }, { status: 202 });
  });
}

export function DELETE(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(req);
    const id = (await params).id;
    await deleteDocument(session.account.id, id, await storeForDocument(session.account.id, id));
    await audit({ action: "document.deleted", actorId: session.account.id, actorLabel: session.account.email, targetId: id, headers: req.headers });
    return new Response(null, { status: 204 });
  });
}

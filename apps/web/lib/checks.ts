import type { Analysis, Audience, FlowEnvironment, StartAnalysis } from "@yomizaka/core";

import { storeForDocument } from "@/app/active-store";

import { getAnalysis, startAnalysis } from "./analyses";
import { type AuditVia, releaseAudit, reserveAudit } from "./billing";
import { query } from "./db";
import { isPhotoDocument } from "./documents";
import { resolveStart } from "./flows";
import { refuse } from "./http";
import { findReusableAnalysis, recordPreflight } from "./preflight-events";
import { auditCapsOf } from "./settings/boundary";
import { settingsFor } from "./settings/guards";

/**
 * One check started on one document, the single path every entry takes — the document page and a batch's rows
 * (yomizaka#232): the photo guard, the flow's decision (offered, consents), reuse of an identical result (no run, no audit),
 * the entitlement (free audit, credit or Pro; 402 PAYWALL otherwise), the run, and the audit given back if it cannot start.
 */
export type StartedCheck = { analysis: Analysis; reused: true } | { analysis: Analysis; reused: false; via: AuditVia };

export async function startCheck(account: { id: string; perspective: Audience | null }, documentId: string, request: StartAnalysis, now: Date, environment: FlowEnvironment): Promise<StartedCheck> {
  if (request.studio === "document-authenticity" && (await isPhotoDocument(account.id, documentId))) throw refuse(422, "PHOTO_AUTHENTICITY", "A document made from photos has no file of its own to examine");
  const { flowVersionId } = await resolveStart(account, request.studio, environment, request.studio === "compliance-check" ? request.ruleset : undefined);
  const settings = await settingsFor(account.id);
  const reusable = await findReusableAnalysis(query, {
    reuseDays: settings["limits.reuseDays"].value as number,
    now,
    ownerId: account.id,
    documentId,
    studio: request.studio,
    jurisdiction: request.studio === "compliance-check" ? request.jurisdiction : null,
    ruleset: request.studio === "compliance-check" ? (request.ruleset ?? null) : null,
    expectedIssuer: request.studio === "document-authenticity" ? (request.expectedIssuer ?? null) : null,
  });
  if (reusable) {
    await recordPreflight(query, account.id, "reused");
    return { analysis: await getAnalysis(account.id, documentId, reusable), reused: true };
  }
  const via = await reserveAudit(query, account.id, now, (plan) => auditCapsOf(settings, plan));
  try {
    return { analysis: await startAnalysis(account.id, documentId, request, flowVersionId, via, await storeForDocument(account.id, documentId)), reused: false, via };
  } catch (error) {
    await releaseAudit(query, account.id, via);
    throw error;
  }
}

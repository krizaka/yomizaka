import { documentKind, STORAGE_MODE } from "@yomizaka/core";
import { z } from "zod";

import { storeForDocument, storesOf } from "@/app/active-store";
import { requireSession } from "@/lib/access";
import { assertUploadForApplication, attachToApplication } from "@/lib/applicant-consent";
import { audit } from "@/lib/audit";
import { query } from "@/lib/db";
import { listDocuments, storeDocument } from "@/lib/documents";
import { handle, HttpError, refuse } from "@/lib/http";
import { isId } from "@/lib/organisation/rules";
import { placeDocument } from "@/lib/organisation/store";
import { isPhoto, storePhotos } from "@/lib/photos";
import { YOMIZAKA_RULES } from "@/lib/preflight/rules";
import { recordPreflight } from "@/lib/preflight-events";
import { limit } from "@/lib/rate-limit";
import { preflightRulesFrom } from "@/lib/settings/boundary";
import { assertFeature, settingsFor } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    return Response.json({ documents: await listDocuments(session.account.id) });
  });
}

/** One file per request (multipart, field `file`; `kind` optional). 60 uploads per account per hour. */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    limit("upload", req, session.account.id, [120, 3600], [60, 3600]);
    const form = await req.formData().catch(() => null);
    const files = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
    const file = files[0];
    if (!file) throw refuse(400, "BAD_REQUEST", "A file is expected in the field `file`");
    const kind = documentKind.or(z.literal("auto")).catch("auto").parse(form?.get("kind") ?? "auto");
    // A document for an application (« screeningId ») is accepted only with the applicant's consent to the document check (yomizaka#131), before any byte is stored.
    const screeningId = form?.get("screeningId");
    if (typeof screeningId === "string") await assertUploadForApplication(session.account.id, screeningId);
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Photos (by their bytes, not their names) are cleaned and read locally, and several make ONE document (ADR-0010).
    const photos = isPhoto(bytes);
    if (files.length > 1 && !photos) throw refuse(400, "BAD_REQUEST", "One PDF or text file per request; several photos make one document");
    // Where it may be kept is the owner's setting: « conserver » is refused while keeping is switched off (ADR-0007).
    const stores = await storesOf(session.account.id);
    const keep = form?.get("keep") === "true";
    if (keep) await assertFeature("keepDocuments", session.account.id);
    if (keep && stores.settings.mode === STORAGE_MODE.none) throw refuse(409, "KEEP_DISABLED", "Keeping documents is switched off for this account");
    const settings = await settingsFor(session.account.id);
    let stored;
    try {
      const policy = { keep, store: stores.write, now: new Date(), purgeAfterHours: settings["limits.purgeAfterHours"].value as number, rules: preflightRulesFrom(YOMIZAKA_RULES, settings) };
      stored = photos
        ? await storePhotos(session.account.id, await Promise.all(files.map(async (f, i) => ({ name: f.name, type: f.type, bytes: i === 0 ? bytes : new Uint8Array(await f.arrayBuffer()) }))), kind, { policy })
        : await storeDocument(session.account.id, { name: file.name, type: file.type, size: file.size }, bytes, kind, policy);
    } catch (error) {
      // A file the pre-flight refused: an engine run that did not happen (counted per tenant).
      const reason = error instanceof HttpError ? error.body.reason : undefined;
      if (typeof reason === "string") await recordPreflight(query, session.account.id, "rejected", reason);
      throw error;
    }
    const { summary, duplicate } = stored;
    if (typeof screeningId === "string") await attachToApplication(session.account.id, summary.id, screeningId, await storeForDocument(session.account.id, summary.id));
    // Uploaded from a collection or a folder: it lands there (ADR-0007).
    const collectionId = form?.get("collectionId");
    const folderId = form?.get("folderId");
    if (!duplicate && typeof collectionId === "string" && isId(collectionId)) {
      await placeDocument(query, session.account.id, summary.id, { collectionId, folderId: typeof folderId === "string" && isId(folderId) ? folderId : null });
    }
    if (!duplicate) await recordPreflight(query, session.account.id, "accepted");
    if (!duplicate) await audit({ action: "document.uploaded", actorId: session.account.id, actorLabel: session.account.email, targetId: summary.id, detail: { size: summary.sizeBytes, mime: summary.mimeType }, headers: req.headers });
    return Response.json({ document: summary, duplicate }, { status: duplicate ? 200 : 201 });
  });
}

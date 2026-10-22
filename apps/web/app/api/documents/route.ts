import { documentKind } from "@yomizaka/core";
import { z } from "zod";

import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { query } from "@/lib/db";
import { listDocuments, storeDocument } from "@/lib/documents";
import { handle, HttpError, refuse } from "@/lib/http";
import { recordPreflight } from "@/lib/preflight-events";
import { limit } from "@/lib/rate-limit";

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
    const file = form?.get("file");
    if (!(file instanceof File)) throw refuse(400, "BAD_REQUEST", "A file is expected in the field `file`");
    const kind = documentKind.or(z.literal("auto")).catch("auto").parse(form?.get("kind") ?? "auto");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let stored;
    try {
      stored = await storeDocument(session.account.id, { name: file.name, type: file.type, size: file.size }, bytes, kind);
    } catch (error) {
      // A file the pre-flight refused: an engine run that did not happen (counted per tenant).
      const reason = error instanceof HttpError ? error.body.reason : undefined;
      if (typeof reason === "string") await recordPreflight(query, session.account.id, "rejected", reason);
      throw error;
    }
    const { summary, duplicate } = stored;
    if (!duplicate) await recordPreflight(query, session.account.id, "accepted");
    if (!duplicate) await audit({ action: "document.uploaded", actorId: session.account.id, actorLabel: session.account.email, targetId: summary.id, detail: { size: summary.sizeBytes, mime: summary.mimeType }, headers: req.headers });
    return Response.json({ document: summary, duplicate }, { status: duplicate ? 200 : 201 });
  });
}

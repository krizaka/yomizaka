import { documentKind } from "@yomizaka/core";

import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { listDocuments, storeDocument } from "@/lib/documents";
import { handle, refuse } from "@/lib/http";
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
    const kind = documentKind.catch("other").parse(form?.get("kind") ?? "other");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { summary, duplicate } = await storeDocument(session.account.id, { name: file.name, type: file.type, size: file.size }, bytes, kind);
    if (!duplicate) await audit({ action: "document.uploaded", actorId: session.account.id, actorLabel: session.account.email, targetId: summary.id, detail: { size: summary.sizeBytes, mime: summary.mimeType }, headers: req.headers });
    return Response.json({ document: summary, duplicate }, { status: duplicate ? 200 : 201 });
  });
}

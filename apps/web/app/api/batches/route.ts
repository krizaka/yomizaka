import { requireSession } from "@/lib/access";
import { audit } from "@/lib/audit";
import { createBatch, listBatches } from "@/lib/batch/run";
import { appEnvironment } from "@/lib/env";
import { handle, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { assertFeature, settingsFor } from "@/lib/settings/guards";

export const dynamic = "force-dynamic";

/** The account's batches, newest first (yomizaka#232). */
export function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    return Response.json({ batches: await listBatches(session.account.id) });
  });
}

/** Creates a batch from `manifest` (the CSV) and `files` (multipart), stores its documents and starts the first rows. */
export function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession(req);
    await assertFeature("batches", session.account.id);
    limit("batch-create", req, session.account.id, [20, 3600], [10, 3600]);
    const form = await req.formData().catch(() => null);
    const manifest = form?.get("manifest");
    if (!(manifest instanceof File) && typeof manifest !== "string") throw refuse(400, "BAD_REQUEST", "A CSV is expected in the field `manifest`");
    const text = typeof manifest === "string" ? manifest : await manifest.text();
    const name = String(form?.get("name") ?? (manifest instanceof File ? manifest.name.replace(/\.[^.]+$/, "") : ""));
    const files = await Promise.all(
      (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File).map(async (f) => ({ name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) })),
    );
    const batch = await createBatch(session.account, name, text, files, { settings: await settingsFor(session.account.id), now: new Date(), environment: appEnvironment() });
    await audit({ action: "batch.created", actorId: session.account.id, actorLabel: session.account.email, targetId: batch.id, detail: { rows: batch.items.length, refused: batch.counts.refused }, headers: req.headers });
    return Response.json({ batch }, { status: 201 });
  });
}

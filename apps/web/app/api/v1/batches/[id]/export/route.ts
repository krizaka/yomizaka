import { systemClock } from "@/app/system-clock";
import { apiCaller } from "@/lib/api-v1/caller";
import { audit } from "@/lib/audit";
import { batchZipFor } from "@/lib/batch/export-for";
import { isUuid } from "@/lib/documents";
import { handle, refuse } from "@/lib/http";
import { asLocale } from "@/lib/i18n";
import { limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** The reports of a batch in one ZIP with a key (`reports:read`): `lot.csv`, the signed PDFs in `?lang=fr|en` (default French), the authenticity signals. */
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const caller = await apiCaller(req, "reports:read", systemClock);
    const id = (await params).id;
    if (!isUuid(id)) throw refuse(404, "NOT_FOUND", "No such batch");
    limit("batch-export", req, caller.account.id, [20, 3600], [10, 3600]);
    const zip = await batchZipFor(caller.account.id, id, asLocale(new URL(req.url).searchParams.get("lang") ?? undefined));
    await audit({ action: "api.batch.exported", actorId: caller.account.id, actorLabel: `api-key:${caller.keyId}`, targetId: id, detail: { files: zip.files.length, bytes: zip.bytes.length }, headers: req.headers });
    return new Response(new Uint8Array(zip.bytes), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="lot-${id.slice(0, 8)}-rapports.zip"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  });
}

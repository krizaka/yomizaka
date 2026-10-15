import { handle, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { MAX_DOCUMENT_BYTES, MAX_REPORT_BYTES, verifyRequest } from "@/lib/verify";

export const dynamic = "force-dynamic";

/**
 * Public, no account: checks a Yomizaka audit report (multipart: `report` file or `reportText`, optional `document`).
 * Nothing is kept — the files are read, checked and dropped. Rate-limited by address.
 */
export function POST(req: Request) {
  return handle(async () => {
    limit("verify", req, null, [30, 600]);
    const length = Number(req.headers.get("content-length") ?? "0");
    if (length > MAX_REPORT_BYTES + MAX_DOCUMENT_BYTES + 64 * 1024) throw refuse(413, "FILE_TOO_LARGE", "Too large");
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw refuse(400, "BAD_REQUEST", "Expected a multipart form");
    }
    return Response.json({ result: await verifyRequest(form) }, { headers: { "Cache-Control": "no-store" } });
  });
}

import { cookies } from "next/headers";

import { readEnv } from "@/lib/env";
import { handle, refuse } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { resolveSession, SESSION_COOKIE } from "@/lib/session";
import { MAX_DOCUMENT_BYTES, MAX_REPORT_BYTES, MAX_VISITOR_BODY_BYTES, verifyRequest } from "@/lib/verify";

export const dynamic = "force-dynamic";

/**
 * Checks a Yomizaka audit report (multipart: `report` file or `reportText`). Open to anyone for the report alone;
 * the optional original `document` needs a signed-in account (a visitor sending one gets 401). Nothing is kept — files are
 * read in memory, checked and dropped — and nothing is analysed by a model. Rate-limited by address (stricter for visitors).
 */
export function POST(req: Request) {
  return handle(async () => {
    const session = await resolveSession((await cookies()).get(SESSION_COOKIE)?.value);
    const signedIn = session !== null;
    if (!signedIn && readEnv().APP_PUBLIC_ACTIONS !== "on") throw refuse(401, "UNAUTHENTICATED", "Sign in first");
    limit("verify", req, session?.account.id ?? null, signedIn ? [60, 600] : [20, 600]);
    const length = Number(req.headers.get("content-length") ?? "0");
    const cap = signedIn ? MAX_REPORT_BYTES + MAX_DOCUMENT_BYTES + 64 * 1024 : MAX_VISITOR_BODY_BYTES;
    if (length > cap) throw refuse(413, "FILE_TOO_LARGE", "Too large");
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw refuse(400, "BAD_REQUEST", "Expected a multipart form");
    }
    return Response.json({ result: await verifyRequest(form, { signedIn }) }, { headers: { "Cache-Control": "no-store" } });
  });
}

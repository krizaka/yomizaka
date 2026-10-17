import { z } from "zod";

import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { consent, contest, decline, share, viewForTenant } from "@/lib/screening";

export const dynamic = "force-dynamic";

const body = z.discriminatedUnion("action", [
  z.object({ token: z.string().min(20).max(80), action: z.literal("view") }),
  z.object({ token: z.string().min(20).max(80), action: z.literal("consent") }),
  z.object({ token: z.string().min(20).max(80), action: z.literal("decline") }),
  z.object({ token: z.string().min(20).max(80), action: z.literal("share") }),
  z.object({ token: z.string().min(20).max(80), action: z.literal("contest"), comment: z.string().trim().max(500).default("") }),
]);

/**
 * The tenant's side, reached by the link the landlord handed over (an unguessable token whose hash is all that is kept): view
 * the request, consent or decline, see the result, share it with the landlord or contest it. No account is needed. Rate-limited
 * by address; every action is audit-logged.
 */
export function POST(req: Request) {
  return handle(async () => {
    limit("screening-respond", req, null, [60, 600]);
    const input = await readJson(req, body);
    const now = new Date();
    const view =
      input.action === "view" ? await viewForTenant(input.token, now) : input.action === "consent" ? await consent(input.token, now, req.headers) : input.action === "decline" ? await decline(input.token, now, req.headers) : input.action === "share" ? await share(input.token, now, req.headers) : await contest(input.token, input.comment, now, req.headers);
    return Response.json({ screening: view }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

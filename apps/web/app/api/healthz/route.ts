import { APP_VERSION } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Liveness for App Platform: the process answers, with its version. No database round trip, no secret. */
export function GET() {
  return Response.json({ status: "ok", version: APP_VERSION });
}

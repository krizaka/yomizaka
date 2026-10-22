import { cookies } from "next/headers";

import { sessionTokenOf } from "@/lib/access";
import { handle } from "@/lib/http";
import { revokeSession, SESSION_COOKIE } from "@/lib/session";

export function POST(req: Request) {
  return handle(async () => {
    await revokeSession(sessionTokenOf(req.headers));
    (await cookies()).delete(SESSION_COOKIE);
    return new Response(null, { status: 204 });
  });
}

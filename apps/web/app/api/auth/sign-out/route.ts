import { cookies } from "next/headers";

import { handle } from "@/lib/http";
import { revokeSession, SESSION_COOKIE } from "@/lib/session";

export function POST() {
  return handle(async () => {
    const jar = await cookies();
    await revokeSession(jar.get(SESSION_COOKIE)?.value);
    jar.delete(SESSION_COOKIE);
    return new Response(null, { status: 204 });
  });
}

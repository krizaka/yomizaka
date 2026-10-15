import { cookies } from "next/headers";
import { z } from "zod";

import { checkPassword } from "@/lib/accounts";
import { clientIp } from "@/lib/client-ip";
import { handle, readJson } from "@/lib/http";
import { limit } from "@/lib/rate-limit";
import { createSession, sessionCookie } from "@/lib/session";

const body = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(256) });

/** E-mail and password → a session cookie. 10 tries per address and 30 per IP every 15 minutes. */
export function POST(req: Request) {
  return handle(async () => {
    const { email, password } = await readJson(req, body);
    limit("sign-in", req, email, [30, 900], [10, 900]);
    const account = await checkPassword(email, password, req.headers);
    const { token, expires } = await createSession(account.id, { ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
    (await cookies()).set(sessionCookie(token, expires));
    return Response.json({ account: { email: account.email, locale: account.locale } });
  });
}

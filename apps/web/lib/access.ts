import { cookies, headers } from "next/headers";

import { clientIp } from "./client-ip";
import { consoleAllowedIps } from "./env";
import { refuse } from "./http";
import { resolveSession, type Session, SESSION_COOKIE } from "./session";

/**
 * Who may do what. Pages and API share the rules: a session for the library; for the administration three locks — a
 * session, the ADMIN role, and an address on AUTH_ALLOWED_IPS (empty in production = nobody). A failed lock answers 404
 * on pages (the administration does not announce itself) and 403 on the API.
 */
export function ipAllowed(requestHeaders: Headers, env: Record<string, string | undefined> = process.env): boolean {
  const allowed = consoleAllowedIps(env);
  if (allowed === null) return true;
  const ip = clientIp(requestHeaders, env);
  return !!ip && allowed.includes(ip);
}

const cookieToken = (header: string | null) =>
  header
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

/** The API's caller, from the session cookie — or 401. */
export async function requireSession(req: Request): Promise<Session> {
  const session = await resolveSession(cookieToken(req.headers.get("cookie")));
  if (!session) throw refuse(401, "UNAUTHENTICATED", "Sign in first");
  return session;
}

export async function requireAdmin(req: Request): Promise<Session> {
  const session = await requireSession(req);
  if (session.account.role !== "ADMIN") throw refuse(403, "FORBIDDEN", "Administrators only");
  if (!ipAllowed(req.headers)) throw refuse(403, "IP_NOT_ALLOWED", "This address may not use the administration");
  return session;
}

/** The session of the page being rendered (a Server Component), or null. */
export async function pageSession(): Promise<Session | null> {
  return resolveSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** The page's administrator — session, role and address — or null (the page answers 404). */
export async function pageAdmin(): Promise<Session | null> {
  const session = await pageSession();
  if (!session || session.account.role !== "ADMIN") return null;
  return ipAllowed(await headers()) ? session : null;
}

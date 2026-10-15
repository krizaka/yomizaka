import crypto from "node:crypto";

import { query } from "./db";
import { sessionSecret } from "./env";

/**
 * Web sessions. The cookie holds a random token (`ys1.` + 32 bytes); the table keeps only its keyed hash, so a leaked
 * table opens nothing. The account is re-read on every request (a suspension applies at once). 14 days, HttpOnly,
 * Secure in production, SameSite=Lax.
 */
export const SESSION_COOKIE = "yomizaka_session";
export const SESSION_TTL_DAYS = 14;
const TOKEN = /^ys1\.[A-Za-z0-9_-]{43}$/;

export const newToken = () => `ys1.${crypto.randomBytes(32).toString("base64url")}`;
export const isToken = (value: string | undefined): value is string => !!value && TOKEN.test(value);
export const tokenHash = (token: string, secret = sessionSecret()) => crypto.createHmac("sha256", `session:${secret}`).update(token).digest("hex");

export interface SessionAccount {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  locale: "en" | "fr";
}

export interface Session {
  id: string;
  account: SessionAccount;
}

export async function createSession(accountId: string, meta: { ip: string | null; userAgent: string | null }): Promise<{ token: string; expires: Date }> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await query("INSERT INTO sessions (account_id, token_hash, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5)", [accountId, tokenHash(token), expires, meta.ip, meta.userAgent?.slice(0, 300) ?? null]);
  return { token, expires };
}

export async function resolveSession(token: string | undefined): Promise<Session | null> {
  if (!isToken(token)) return null;
  const [row] = await query<{ session_id: string; id: string; email: string; role: "USER" | "ADMIN"; locale: "en" | "fr" }>(
    `SELECT s.id AS session_id, a.id, a.email, a.role, a.locale
       FROM sessions s JOIN accounts a ON a.id = s.account_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND a.status = 'ACTIVE'`,
    [tokenHash(token)],
  );
  if (!row) return null;
  return { id: row.session_id, account: { id: row.id, email: row.email, role: row.role, locale: row.locale } };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!isToken(token)) return;
  await query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
}

export function sessionCookie(token: string, expires: Date) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires };
}

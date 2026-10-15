import { clientIp } from "./client-ip";
import { HttpError } from "./http";

/**
 * Fixed-window limits kept in this process (one instance in dev: enough; a second instance needs a shared store
 * first). Keys never hold a password; an address is the client's as `client-ip.ts` trusts it.
 */
const windows = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 10_000;

export function hit(key: string, limit: number, windowSeconds: number, now = Date.now()): { allowed: boolean; retryAfter: number } {
  let entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    if (windows.size >= MAX_KEYS) windows.clear();
    entry = { count: 0, resetAt: now + windowSeconds * 1000 };
    windows.set(key, entry);
  }
  entry.count += 1;
  return { allowed: entry.count <= limit, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
}

export function resetRateLimits() {
  windows.clear();
}

/** Limits an action per IP and per subject (an address, an account): a refusal is 429 with Retry-After. */
export function limit(action: string, req: { headers: Headers }, subject: string | null, perIp: [number, number], perSubject?: [number, number]) {
  const checks: [string, [number, number]][] = [[`${action}:ip:${clientIp(req.headers) ?? "unknown"}`, perIp]];
  if (perSubject && subject) checks.push([`${action}:s:${subject.toLowerCase()}`, perSubject]);
  for (const [key, [max, seconds]] of checks) {
    const result = hit(key, max, seconds);
    if (!result.allowed) throw new HttpError(429, "Too many requests", { code: "RATE_LIMITED", retryAfterSeconds: result.retryAfter }, { "Retry-After": String(result.retryAfter) });
  }
}

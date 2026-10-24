import { AccountError, type AccountService } from "@krizaka/auth";

import type { audit } from "./audit";
import { refuse } from "./http";
import { limit } from "./rate-limit";
import { appSettings } from "./settings/instance";

/** What the forgot-password flow needs from the edge: the account service (the package's) and the audit trail. */
export interface ResetDeps {
  accounts: Pick<AccountService, "requestPasswordReset" | "resetPassword">;
  audit: typeof audit;
}

/** How long a reset link works, in minutes: the `auth.passwordResetMinutes` setting (5 to 1440), read at each request so a change applies at once. */
export const resetLinkMinutes = (): Promise<number> => appSettings().get("auth.passwordResetMinutes");

/**
 * « Forgot your password? ». The answer is the same whether or not the address has an account — and so is every side
 * effect a stranger can see: the audit line, the limit (counted for any address), a failing mail (swallowed: a 500 only
 * for known addresses would tell). The line names no address and no token. 3 requests an hour per address, 10 per client.
 */
export async function requestReset(deps: ResetDeps, input: { email: string }, req: { headers: Headers }, now: Date): Promise<{ ok: true }> {
  limit("forgot-password", req, input.email, [10, 3600], [3, 3600]);
  try {
    await deps.accounts.requestPasswordReset(input.email, now);
  } catch (error) {
    console.error("password reset: the link could not be issued or mailed", error instanceof Error ? error.message : "unknown");
  }
  await deps.audit({ action: "auth.password_reset_requested", actorId: null, actorLabel: "password reset form", headers: req.headers });
  return { ok: true };
}

/**
 * The mailed link's page sets the new password. The package checks the password before using the link up, ends every
 * session, and answers INVALID for an expired, used or unknown link alike. The audit line says only the result.
 */
export async function applyReset(deps: ResetDeps, input: { token: string; password: string }, req: { headers: Headers }, now: Date): Promise<{ ok: true }> {
  limit("reset-password", req, null, [20, 3600]);
  let result: "CHANGED" | "INVALID";
  try {
    result = await deps.accounts.resetPassword(input.token, input.password, now);
  } catch (error) {
    if (error instanceof AccountError) throw refuse(error.status, error.code, error.message);
    throw error;
  }
  await deps.audit({ action: "auth.password_reset", actorId: null, actorLabel: "password reset link", detail: { result: result.toLowerCase() }, headers: req.headers });
  if (result === "INVALID") throw refuse(400, "RESET_INVALID", "This link is invalid or has expired");
  return { ok: true };
}

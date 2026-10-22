import crypto from "node:crypto";

import type { QueryResultRow } from "pg";

import type { Mailer } from "../mailer";
import { tokenHash } from "../session";
import { AccountError, type AccountProfile, type AccountService, type ProfilePatch } from "./port";

/**
 * Yomizaka's adapter of the account port (ADR-0008): its OWN PostgreSQL (`accounts`, `sessions`, `email_changes`), the mailer
 * and the password hashing passed in. Nothing here is Yomizaka's product logic — it moves to `@krizaka/auth` unchanged.
 */
type Query = <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<T[]>;

export interface AccountDeps {
  query: Query;
  mail: Mailer;
  baseUrl: string;
  passwords: { hash: (password: string) => Promise<string>; verify: (password: string, stored: string) => Promise<boolean> };
  token?: () => string;
}

// @fixed: the lifetime of an e-mail change link, a security parameter
export const EMAIL_CHANGE_TTL_HOURS = 24;
const NAME_MAX = 80;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 256;

const newToken = () => `ye1.${crypto.randomBytes(32).toString("base64url")}`;
export const isEmailChangeToken = (v: string | undefined | null): v is string => !!v && /^ye1\.[A-Za-z0-9_-]{43}$/.test(v);

export function emailChangeMail(locale: "en" | "fr", url: string) {
  return locale === "fr"
    ? { subject: "Confirmez votre nouvelle adresse — Yomizaka", text: `Bonjour,\n\nPour utiliser cette adresse avec votre compte Yomizaka, confirmez-la en ouvrant ce lien (valide ${EMAIL_CHANGE_TTL_HOURS} h) :\n${url}\n\nSi vous n'avez rien demandé, ignorez ce message : rien ne change.\n` }
    : { subject: "Confirm your new address — Yomizaka", text: `Hello,\n\nTo use this address with your Yomizaka account, confirm it by opening this link (valid ${EMAIL_CHANGE_TTL_HOURS} h):\n${url}\n\nIf you did not ask for this, ignore this message: nothing changes.\n` };
}

const cleanName = (raw: string): string => {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length > NAME_MAX) throw new AccountError(400, "BAD_REQUEST", `A name is at most ${NAME_MAX} characters`);
  return name;
};

export function postgresAccounts(deps: AccountDeps): AccountService {
  const { query } = deps;
  const wrong = () => new AccountError(403, "WRONG_PASSWORD", "The password is not right");

  async function profileOf(id: string): Promise<AccountProfile> {
    const [row] = await query<{ id: string; email: string; name: string | null; locale: "en" | "fr"; avatar_seed: string | null; email_verified_at: Date | null; pending: string | null }>(
      `SELECT a.id, a.email, a.name, a.locale, a.avatar_seed, a.email_verified_at,
              (SELECT c.new_email FROM email_changes c WHERE c.account_id = a.id AND c.used_at IS NULL AND c.expires_at > now() ORDER BY c.created_at DESC LIMIT 1) AS pending
         FROM accounts a WHERE a.id = $1`,
      [id],
    );
    if (!row) throw new AccountError(404, "NOT_FOUND", "No such account");
    return { id: row.id, email: row.email, name: row.name, locale: row.locale, avatarSeed: row.avatar_seed, emailVerified: !!row.email_verified_at, pendingEmail: row.pending };
  }

  async function confirmPassword(id: string, password: string): Promise<void> {
    const [row] = await query<{ password_hash: string | null }>("SELECT password_hash FROM accounts WHERE id = $1", [id]);
    if (!row?.password_hash || password.length > PASSWORD_MAX || !(await deps.passwords.verify(password, row.password_hash))) throw wrong();
  }

  return {
    profile: profileOf,

    async updateProfile(id, patch: ProfilePatch) {
      const name = patch.name === undefined ? undefined : patch.name === null ? null : cleanName(patch.name);
      if (patch.avatarSeed && !/^[a-z0-9-]{1,40}$/.test(patch.avatarSeed)) throw new AccountError(400, "BAD_REQUEST", "Not an avatar");
      await query(
        `UPDATE accounts SET name = CASE WHEN $2::boolean THEN $3 ELSE name END, locale = COALESCE($4, locale),
                avatar_seed = CASE WHEN $5::boolean THEN $6 ELSE avatar_seed END WHERE id = $1`,
        [id, name !== undefined, name === "" ? null : (name ?? null), patch.locale ?? null, patch.avatarSeed !== undefined, patch.avatarSeed ?? null],
      );
      return profileOf(id);
    },

    async requestEmailChange(id, input, now) {
      await confirmPassword(id, input.password);
      const address = input.newEmail.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address) || address.length > 320) throw new AccountError(400, "BAD_REQUEST", "Not an e-mail address");
      const [taken] = await query("SELECT 1 FROM accounts WHERE email = $1", [address]);
      if (taken) return; // the same answer, no mail: the address is not disclosed
      const profile = await profileOf(id);
      await query("UPDATE email_changes SET used_at = $2 WHERE account_id = $1 AND used_at IS NULL", [id, now]);
      const token = (deps.token ?? newToken)();
      await query("INSERT INTO email_changes (account_id, new_email, token_hash, expires_at) VALUES ($1, $2, $3, $4::timestamptz + make_interval(hours => $5))", [id, address, tokenHash(token), now, EMAIL_CHANGE_TTL_HOURS]);
      const url = `${deps.baseUrl.replace(/\/$/, "")}/${profile.locale}/confirm-email?token=${encodeURIComponent(token)}`;
      await deps.mail({ to: address, ...emailChangeMail(profile.locale, url) });
    },

    async confirmEmailChange(token, now) {
      if (!isEmailChangeToken(token)) return "INVALID";
      const [row] = await query<{ account_id: string; new_email: string }>("UPDATE email_changes SET used_at = $2 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2 RETURNING account_id, new_email", [tokenHash(token), now]);
      if (!row) return "INVALID";
      try {
        await query("UPDATE accounts SET email = $2, email_verified_at = $3 WHERE id = $1", [row.account_id, row.new_email, now]);
      } catch {
        return "INVALID"; // taken in the meantime
      }
      return "CHANGED";
    },

    async changePassword(id, input, keepSessionId) {
      await confirmPassword(id, input.current);
      if (input.next.length < PASSWORD_MIN) throw new AccountError(400, "PASSWORD_TOO_SHORT", `At least ${PASSWORD_MIN} characters`);
      if (input.next.length > PASSWORD_MAX) throw new AccountError(400, "PASSWORD_TOO_LONG", `At most ${PASSWORD_MAX} characters`);
      await query("UPDATE accounts SET password_hash = $2 WHERE id = $1", [id, await deps.passwords.hash(input.next)]);
      await query("DELETE FROM sessions WHERE account_id = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)", [id, keepSessionId ?? null]);
    },

    confirmPassword,

    async deleteAccount(id) {
      const rows = await query("DELETE FROM accounts WHERE id = $1 RETURNING id", [id]);
      if (!rows.length) throw new AccountError(404, "NOT_FOUND", "No such account");
    },
  };
}

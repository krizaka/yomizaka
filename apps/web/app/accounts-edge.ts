import { postgresAccounts } from "@krizaka/auth";

import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { mailerFor } from "@/lib/mailer";
import { hashPassword, verifyPassword } from "@/lib/password";
import { tokenHash } from "@/lib/session";

/** The account service of this deployment (the edge wires the adapter: its data store, the mailer, the password hashing). */
export const accountService = () => {
  const e = env();
  return postgresAccounts({ query: async (sql, params) => query(sql, params) as never, mail: mailerFor(e), baseUrl: e.APP_PUBLIC_URL, product: "Yomizaka", tokenPrefix: "ye", tokenHash: (token) => tokenHash(token), passwords: { hash: hashPassword, verify: verifyPassword } });
};

/** Whether e-mails can be sent (no key, no e-mail change: it fails closed, like sign-up). */
export const mailConfigured = () => {
  const e = env();
  return e.MAIL_PROVIDER === "mailgun" && !!e.MAIL_API_KEY && !!e.MAIL_DOMAIN;
};

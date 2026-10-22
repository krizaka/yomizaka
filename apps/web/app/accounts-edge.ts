import { postgresAccounts } from "@/lib/account/postgres";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { mailerFor } from "@/lib/mailer";
import { hashPassword, verifyPassword } from "@/lib/password";

/** The account service of this deployment (the edge wires the adapter: its data store, the mailer, the password hashing). */
export const accountService = () => {
  const e = env();
  return postgresAccounts({ query, mail: mailerFor(e), baseUrl: e.APP_PUBLIC_URL, passwords: { hash: hashPassword, verify: verifyPassword } });
};

/** Whether e-mails can be sent (no key, no e-mail change: it fails closed, like sign-up). */
export const mailConfigured = () => {
  const e = env();
  return e.MAIL_PROVIDER === "mailgun" && !!e.MAIL_API_KEY && !!e.MAIL_DOMAIN;
};

#!/usr/bin/env node
// The test accounts of a deployment (sign-up is closed: nobody else can sign in) — one member, one administrator.
// Passwords come from the environment (QA_USER_PASSWORD, QA_ADMIN_PASSWORD) and are never printed; the maintainer keeps
// them in company/QA.md. Idempotent: a re-run sets the passwords again.
//
//   DATABASE_URL=… DATABASE_CA_CERT=… QA_USER_EMAIL=… QA_USER_PASSWORD=… QA_ADMIN_EMAIL=… QA_ADMIN_PASSWORD=… \
//     node scripts/qa-accounts.mjs
import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

/** The same scheme as lib/password.ts: scrypt N=2^15 r=8 p=1, 16-byte salt, `scrypt$N$r$p$salt$hash`. */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function accountsFromEnv(env) {
  const accounts = [
    { email: env.QA_USER_EMAIL, password: env.QA_USER_PASSWORD, role: "USER" },
    { email: env.QA_ADMIN_EMAIL, password: env.QA_ADMIN_PASSWORD, role: "ADMIN" },
  ];
  for (const a of accounts) {
    if (!a.email || !/^[^@\s]+@[^@\s]+$/.test(a.email)) throw new Error(`a QA e-mail is missing or invalid (${a.role})`);
    if (!a.password || a.password.length < 12) throw new Error(`the ${a.role} password is missing or shorter than 12 characters`);
  }
  return accounts.map((a) => ({ ...a, email: a.email.trim().toLowerCase() }));
}

async function main() {
  const { default: pg } = await import("pg");
  const url = new URL(process.env.DATABASE_URL ?? "");
  const tls = ["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "");
  url.searchParams.delete("sslmode");
  const client = new pg.Client({ connectionString: url.toString(), ...(tls ? { ssl: { ca: process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n"), rejectUnauthorized: true } } : {}) });
  await client.connect();
  try {
    for (const a of accountsFromEnv(process.env)) {
      await client.query(
        `INSERT INTO accounts (email, role, password_hash) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, password_hash = EXCLUDED.password_hash, status = 'ACTIVE'`,
        [a.email, a.role, await hashPassword(a.password)],
      );
      console.log(`qa-accounts: ${a.role} ${a.email} ready (password from the environment, not printed)`);
    }
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`qa-accounts: ${error.message}`);
    process.exit(1);
  });
}

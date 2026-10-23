#!/usr/bin/env node
// The demo data set of a persona, on dev and local only.
//   DATABASE_URL=… [DATABASE_CA_CERT=…] [APP_DEMO_ACCOUNT_EMAIL=…] [APP_DEMO_ACCOUNT_PASSWORD=…] \
//     node scripts/demo-seed/cli.mjs --persona eric [--locale fr|en] [--reset]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { assertNotProduction, PERSONAS, seedPersona } from "./seed.mjs";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  assertNotProduction(process.env);
  const persona = arg("persona") ?? "";
  if (!PERSONAS[persona]) throw new Error(`--persona is required (known: ${Object.keys(PERSONAS).join(", ")})`);
  const locale = arg("locale") ?? "fr";
  if (!["fr", "en"].includes(locale)) throw new Error("--locale must be fr or en");
  const web = createRequire(new URL("../../apps/web/package.json", import.meta.url));
  const pg = web("pg");
  const url = new URL(process.env.DATABASE_URL ?? "");
  const tls = ["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "");
  url.searchParams.delete("sslmode");
  const client = new pg.Client({ connectionString: url.toString(), ...(tls ? { ssl: { ca: process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n"), rejectUnauthorized: true } } : {}) });
  const messagesByLocale = Object.fromEntries(["fr", "en"].map((l) => [l, JSON.parse(readFileSync(new URL(`../../apps/web/messages/${l}.json`, import.meta.url), "utf8"))]));
  let passwordHash = null;
  if (process.env.APP_DEMO_ACCOUNT_PASSWORD) {
    if (process.env.APP_DEMO_ACCOUNT_PASSWORD.length < 12) throw new Error("APP_DEMO_ACCOUNT_PASSWORD must have at least 12 characters");
    passwordHash = await (await import("../../apps/web/scripts/qa-accounts.mjs")).hashPassword(process.env.APP_DEMO_ACCOUNT_PASSWORD);
  }
  await client.connect();
  try {
    const result = await seedPersona((sql, values) => client.query(sql, values).then((r) => r.rows), {
      persona,
      email: process.env.APP_DEMO_ACCOUNT_EMAIL,
      locale,
      messagesByLocale,
      reset: process.argv.includes("--reset"),
      passwordHash,
    });
    console.log(`demo:seed (${persona}): ${result.email} — ${result.name ?? "(no name)"}`);
    for (const [name, n] of Object.entries(result.collections)) console.log(`  ${name}: ${n} documents`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`demo:seed: ${error.message}`);
  process.exit(1);
});

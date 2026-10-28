// The demo data set of a persona (krizaka/yomizaka#274): an account, its collections, its fictitious documents and a few finished checks.
// Idempotent (a re-run changes nothing; `reset` starts over) and refused on production. The checks are SEEDED, not run: their run id
// starts with `seeded-` and their inputs say so — no paid run, no call to the engine.
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { generateDocument, PERSONA_ERIC, AS_OF, DEFAULT_SEED } from "../demo-documents/index.mjs";
import { CAST_MEMBER, castAccounts, fingerprintOf } from "./cast.mjs";

/**
 * Where the seeded bytes go: the working store the app is configured with (`APP_DOCUMENTS_STORE`, apps/web/lib/env.ts; ADR-0012). `database`
 * (the dev deployment, CI) writes the `document_blobs` table like the app's database adapter (apps/web/lib/storage/database.ts: the seed
 * cannot import TypeScript, the guard names both); `folder` (a laptop, the default) writes the folder of apps/web/lib/storage/local.ts.
 * A bucket (`spaces`) is not seeded from here.
 */
const workingFolder = () => join(tmpdir(), "yomizaka-documents");
export function bytesWriter(env, q) {
  const mode = env.APP_DOCUMENTS_STORE ?? "folder";
  if (mode === "database") {
    return (key, bytes) =>
      q("INSERT INTO document_blobs (object_key, content_type, bytes) VALUES ($1, 'application/pdf', $2) ON CONFLICT (object_key) DO UPDATE SET content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes", [key, Buffer.from(bytes)]);
  }
  if (mode !== "folder") throw new Error(`the demo seed writes APP_DOCUMENTS_STORE=database or folder, not ${mode}`);
  return async (key, bytes) => {
    const path = join(workingFolder(), key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  };
}

/** The persona's name comes from the cast; this file adds what the cast does not hold: the collections and documents. */
export const PERSONAS = { [CAST_MEMBER.id]: { ...PERSONA_ERIC, key: CAST_MEMBER.id, name: CAST_MEMBER.displayName } };
export const DEFAULT_EMAILS = { [CAST_MEMBER.id]: `${CAST_MEMBER.id}@demo.yomizaka.test` };
export const SEEDED_RUN_PREFIX = "seeded-";
/** What a seeded check carries in its inputs — the same marker `@yomizaka/core` reads (`isSeededCheck`). */
export const SEEDED_INPUTS = { seeded: "true" };

/** The demo tokens of the owner link of a persona's seeded file (yomizaka#128): one that opens, one that was revoked. Demo values, never a real link. */
export const demoOwnerTokens = (persona) => ({ live: `demo-owner-live-${persona}-0123456789abcdef`, revoked: `demo-owner-revoked-${persona}-0123456789abcdef` });
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

/** A fictitious applicant file with its two owner links, so the public report page can be audited (idempotent: the links are renewed). The tokens are fixed, so the seed that ran last owns them: two seeds in one database (tests, the cast) never leave the file with the wrong landlord. */
async function seedOwnerFile(q, owner, persona) {
  const [file] = await q(
    `INSERT INTO screenings (landlord_id, tenant_name, tenant_email, scope, provider, token_hash, expires_at, flow, requested_types)
     VALUES ($1, 'Camille Fictif', 'camille@demo.yomizaka.test', '{}', 'applicant-file', $2, now() + interval '30 days', 'file', '{}')
     ON CONFLICT (token_hash) DO UPDATE SET landlord_id = EXCLUDED.landlord_id, expires_at = EXCLUDED.expires_at RETURNING id`,
    [owner, sha256(`demo-file-${persona}`)],
  );
  const tokens = demoOwnerTokens(persona);
  for (const [name, revoked] of [["live", false], ["revoked", true]]) {
    await q(
      `INSERT INTO file_report_shares (screening_id, landlord_id, recipient, token_hash, expires_at, revoked_at)
       VALUES ($1, $2, 'Demo', $3, now() + interval '30 days', ${revoked ? "now()" : "NULL"})
       ON CONFLICT (token_hash) DO UPDATE SET screening_id = EXCLUDED.screening_id, landlord_id = EXCLUDED.landlord_id, expires_at = EXCLUDED.expires_at, revoked_at = ${revoked ? "coalesce(file_report_shares.revoked_at, now())" : "NULL"}`,
      [file.id, owner, sha256(tokens[name])],
    );
  }
}

/** The seed works on dev and local only: anything that says it is production is refused, and so is a value it does not know. */
export function assertNotProduction(env) {
  const environment = env.APP_ENVIRONMENT ?? "dev";
  if (environment !== "dev") throw new Error(`demo:seed works only on dev and local, and APP_ENVIRONMENT is "${environment}" — refused`);
}

/** The words of the persona (collection names and descriptions) in a language, from the app's messages. */
export function collectionWords(messages, personaKey, collectionKey) {
  const entry = messages?.demo?.[personaKey]?.collections?.[collectionKey];
  if (!entry?.name) throw new Error(`messages: demo.${personaKey}.collections.${collectionKey}.name is missing`);
  return { name: entry.name, description: entry.description ?? null };
}

const COMPLIANCE_SOURCE = "Jeu de données de démonstration — résultat marqué comme semé, aucun appel au moteur";

/** A finished check's report, in the shape the two Studios return, built from the findings recorded next to the document. */
export function seededReport(doc) {
  if (doc.family === "lease") {
    const failed = doc.findings.map((f) => ({ ruleId: f.code, title: f.title, severity: f.severity, verdict: "FAIL", explanation: f.explanation, method: "SEEDED", ...(f.present?.[0] ? { evidenceSpan: { quote: f.present[0] } } : {}) }));
    const passed = failed.length === 0 ? [{ ruleId: "DEMO-LEASE-OK", title: "Aucun écart relevé", severity: "INFO", verdict: "PASS", explanation: "Le bail du jeu de données ne présente aucun des écarts recherchés.", method: "SEEDED" }] : [];
    return { rulesetId: "demo-seeded", rulesetVersion: "1", jurisdiction: "QC", asOf: AS_OF, source: COMPLIANCE_SOURCE, reviewStatus: "TO_REVIEW_BY_LAWYER", summary: { byVerdict: failed.length ? { FAIL: failed.length } : { PASS: 1 }, blockingFailures: failed.length, rulesEvaluated: failed.length || 1 }, findings: [...failed, ...passed] };
  }
  return {
    header: COMPLIANCE_SOURCE,
    pages: doc.pages,
    signals: doc.findings.map((f) => ({ signalId: f.code, level: "incohérent", observation: f.explanation, where: f.present?.[0] })),
    notExamined: ["Authenticité de l'émetteur (jeu de données fictif)"],
  };
}

const searchTextOf = (report) =>
  "findings" in report ? report.findings.flatMap((f) => [f.ruleId, f.title, f.explanation, f.evidenceSpan?.quote ?? ""]).join("\n") : report.signals.flatMap((s) => [s.signalId, s.observation, s.where ?? ""]).join("\n");
const needsAttention = (report) => ("findings" in report ? report.findings.some((f) => f.verdict === "FAIL" && f.severity === "BLOCKING") : report.signals.some((s) => s.level === "incohérent"));

/**
 * Seeds the persona into the database behind `q` (`(sql, values) => Promise<rows>`, ONE connection: the seed is one transaction).
 * `messagesByLocale` holds the app's catalogues: the collections take the account's language. One seed at a time per account:
 * a second process waits on the account's advisory lock, then finds everything already there (idempotent). Returns what is
 * there after the run.
 */
export async function seedPersona(q, { persona = "eric", email, locale = "fr", messagesByLocale, reset = false, passwordHash = null, seed = DEFAULT_SEED }) {
  const def = PERSONAS[persona];
  if (!def) throw new Error(`unknown persona "${persona}" (known: ${Object.keys(PERSONAS).join(", ")})`);
  const address = (email ?? DEFAULT_EMAILS[persona]).trim().toLowerCase();
  await q("BEGIN");
  try {
    await q("SELECT pg_advisory_xact_lock(hashtext($1))", [`demo-seed:${address}`]);
    const result = await seedInTransaction(q, def, { persona, address, locale, messagesByLocale, reset, passwordHash, seed });
    await q("COMMIT");
    return result;
  } catch (error) {
    // The rollback never masks what went wrong.
    await q("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function seedInTransaction(q, def, { persona, address, locale, messagesByLocale, reset, passwordHash, seed }) {
  // An existing account keeps what the person chose (language, password, perspective, name); the seed only fills what is missing.
  const [account] = await q(
    `INSERT INTO accounts (email, locale, email_verified_at, password_hash, perspective, name) VALUES ($1, $2, now(), $3, 'landlord', $4)
     ON CONFLICT (email) DO UPDATE SET locale = accounts.locale, password_hash = coalesce(EXCLUDED.password_hash, accounts.password_hash),
       perspective = coalesce(accounts.perspective, EXCLUDED.perspective), name = coalesce(accounts.name, EXCLUDED.name)
     RETURNING id, locale, name`,
    [address, locale, passwordHash, def.name],
  );
  const owner = account.id;
  const words = (key) => collectionWords(messagesByLocale[account.locale] ?? messagesByLocale.fr, persona, key);

  if (reset) {
    await q("DELETE FROM documents WHERE owner_id = $1", [owner]);
    const names = def.collections.flatMap((c) => Object.values(messagesByLocale).map((m) => collectionWords(m, persona, c.key).name));
    await q("DELETE FROM collections WHERE owner_id = $1 AND NOT is_default AND name = ANY($2)", [owner, names]);
  }

  const [library] = await q("SELECT id FROM libraries WHERE owner_id = $1 ORDER BY created_at, id LIMIT 1", [owner]);
  const counts = {};
  for (const collection of def.collections) {
    const { name, description } = words(collection.key);
    const [row] = await q(
      `INSERT INTO collections (library_id, owner_id, name, description) VALUES ($1, $2, $3, $4)
       ON CONFLICT (library_id, name) DO UPDATE SET description = EXCLUDED.description RETURNING id`,
      [library.id, owner, name, description],
    );
    for (const id of collection.documents) {
      const doc = await generateDocument(id, seed);
      // The bytes go to the working store (a folder here), the row only names them (ADR-0012): the same shape the upload writes.
      const docId = randomUUID();
      const key = `${owner}/${docId}/original.pdf`;
      const inserted = await q(
        `INSERT INTO documents (id, owner_id, title, filename, mime_type, kind, size_bytes, sha256, pages, content, object_key, text, collection_id)
         VALUES ($1, $2, $3, $4, 'application/pdf', $5, $6, $7, $8, ''::bytea, $9, $10, $11) ON CONFLICT (owner_id, sha256) DO NOTHING RETURNING id`,
        [docId, owner, doc.title, doc.filename, doc.kind, doc.bytes.length, doc.sha256, doc.pages, key, doc.text, row.id],
      );
      const [stored] = await q("SELECT id, object_key FROM documents WHERE owner_id = $1 AND sha256 = $2", [owner, doc.sha256]);
      // Written again on a re-run (same bytes, same key): a store that lost its files (a folder after a redeploy) heals.
      if (stored.object_key || inserted.length > 0) await bytesWriter(process.env, q)(stored.object_key ?? key, doc.bytes);
      if (def.checked.includes(id)) {
        const report = seededReport(doc);
        const studio = doc.family === "lease" ? "compliance-check" : "document-authenticity";
        const runId = `${SEEDED_RUN_PREFIX}${id}`;
        await q(
          `INSERT INTO analyses (document_id, studio, status, run_id, blueprint_version, inputs, report, search_text, finished_at)
           SELECT $1, $2, 'succeeded', $3, NULL, $4, $5, $6, now()
            WHERE NOT EXISTS (SELECT 1 FROM analyses WHERE document_id = $1 AND run_id = $3)`,
          [stored.id, studio, runId, JSON.stringify(SEEDED_INPUTS), JSON.stringify({ ...report, attention: needsAttention(report) }), searchTextOf(report)],
        );
      }
    }
    const [count] = await q("SELECT count(*)::int AS n FROM documents WHERE collection_id = $1", [row.id]);
    counts[name] = count.n;
  }
  await seedOwnerFile(q, owner, persona);
  return { owner, email: address, name: account.name, collections: counts };
}

/**
 * `seed --cast`: the whole Yomizaka cast, the same on a laptop, a CI runner and the dev deployment. The member gets the demo data
 * set of `seedPersona`; the administrator gets an account named after its persona. Idempotent; the caller refuses production
 * (`assertNotProduction`) before it connects. Returns the fingerprint of what is there for the cast's accounts.
 */
export async function seedCast(q, { env, hashPassword, locale = undefined, messagesByLocale, reset = false }) {
  const [member, admin, camille] = castAccounts(env);
  const result = await seedPersona(q, { persona: member.persona.id, email: member.email, locale: locale ?? member.persona.locale, messagesByLocale, reset, passwordHash: await hashPassword(member.password) });
  // The other accounts keep the name the person chose; the role and the credentials follow the environment.
  const upsert = async (a) =>
    (
      await q(
        `INSERT INTO accounts (email, locale, email_verified_at, password_hash, perspective, name, role) VALUES ($1, $2, now(), $3, 'landlord', $4, $5)
         ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE', password_hash = EXCLUDED.password_hash, name = coalesce(accounts.name, EXCLUDED.name)
         RETURNING id`,
        [a.email, a.persona.locale, await hashPassword(a.password), a.persona.displayName, a.role],
      )
    )[0].id;
  const others = [await upsert(admin), await upsert(camille)];
  const print = await fingerprintOf(q, [result.owner, ...others]);
  return { ...print, member: result, admin: { email: admin.email, name: admin.persona.displayName }, camille: { email: camille.email, name: camille.persona.displayName } };
}

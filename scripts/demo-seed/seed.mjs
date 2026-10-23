// The demo data set of a persona (krizaka/yomizaka#274): an account, its collections, its fictitious documents and a few finished checks.
// Idempotent (a re-run changes nothing; `reset` starts over) and refused on production. The checks are SEEDED, not run: their run id
// starts with `seeded-` and their inputs say so — no paid run, no call to the engine.
import { generateDocument, PERSONA_ERIC, AS_OF, DEFAULT_SEED } from "../demo-documents/index.mjs";

export const PERSONAS = { eric: PERSONA_ERIC };
export const DEFAULT_EMAILS = { eric: "eric@demo.yomizaka.test" };
export const SEEDED_RUN_PREFIX = "seeded-";

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
 * Seeds the persona into the database behind `q` (`(sql, values) => Promise<rows>`). `messagesByLocale` holds the app's catalogues:
 * the collections take the account's language. Returns what is there after the run.
 */
export async function seedPersona(q, { persona = "eric", email, locale = "fr", messagesByLocale, reset = false, passwordHash = null, seed = DEFAULT_SEED }) {
  const def = PERSONAS[persona];
  if (!def) throw new Error(`unknown persona "${persona}" (known: ${Object.keys(PERSONAS).join(", ")})`);
  const address = (email ?? DEFAULT_EMAILS[persona]).trim().toLowerCase();
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
      await q(
        `INSERT INTO documents (owner_id, title, filename, mime_type, kind, size_bytes, sha256, pages, content, text, collection_id)
         VALUES ($1, $2, $3, 'application/pdf', $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (owner_id, sha256) DO NOTHING`,
        [owner, doc.title, doc.filename, doc.kind, doc.bytes.length, doc.sha256, doc.pages, Buffer.from(doc.bytes), doc.text, row.id],
      );
      const [stored] = await q("SELECT id FROM documents WHERE owner_id = $1 AND sha256 = $2", [owner, doc.sha256]);
      if (def.checked.includes(id)) {
        const report = seededReport(doc);
        const studio = doc.family === "lease" ? "compliance-check" : "document-authenticity";
        const runId = `${SEEDED_RUN_PREFIX}${id}`;
        await q(
          `INSERT INTO analyses (document_id, studio, status, run_id, blueprint_version, inputs, report, search_text, finished_at)
           SELECT $1, $2, 'succeeded', $3, NULL, $4, $5, $6, now()
            WHERE NOT EXISTS (SELECT 1 FROM analyses WHERE document_id = $1 AND run_id = $3)`,
          [stored.id, studio, runId, JSON.stringify({ seeded: "true" }), JSON.stringify({ ...report, attention: needsAttention(report) }), searchTextOf(report)],
        );
      }
    }
    const [count] = await q("SELECT count(*)::int AS n FROM documents WHERE collection_id = $1", [row.id]);
    counts[name] = count.n;
  }
  return { owner, email: address, name: account.name, collections: counts };
}

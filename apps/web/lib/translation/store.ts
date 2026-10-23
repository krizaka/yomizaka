import { pool, query } from "../db";
import type { GlossaryTerm } from "./port";
import type { StoredTranslation, TranslationKey, TranslationStore } from "./service";

/**
 * Translations and the legal glossary in PostgreSQL (migration 0030). Every transition is one statement: the unique index on the
 * key (for a translation that is not failed) is what lets only one request start a run, and `finish` moves a run out of `running`
 * once (review of #247).
 */
interface Row {
  status: StoredTranslation["status"];
  run_id: string;
  studio_version: string | null;
  glossary_version: number;
  source_version: string;
  spans: Record<string, string[]>;
  texts: Record<string, string> | null;
  error: string | null;
  charged: number;
}

const KEY = "analysis_id = $1 AND language = $2 AND source_version = $3 AND glossary_version = $4";
const keyParams = (k: TranslationKey) => [k.analysisId, k.language, k.sourceVersion, k.glossaryVersion];

const toStored = (r: Row): StoredTranslation => ({ status: r.status, runId: r.run_id, studioVersion: r.studio_version, glossaryVersion: r.glossary_version, sourceVersion: r.source_version, spans: r.spans, texts: r.texts, sent: Object.keys(r.spans).length, error: r.error, charged: r.charged });

export const pgTranslationStore: TranslationStore = {
  async find(key) {
    const [r] = await query<Row>(`SELECT status, run_id, studio_version, glossary_version, source_version, spans, texts, error, charged FROM report_translations WHERE ${KEY} ORDER BY (status <> 'failed') DESC, created_at DESC LIMIT 1`, keyParams(key));
    return r ? toStored(r) : null;
  },
  async claim(key, spans) {
    // A claim whose request died before it could start a run frees itself after two minutes.
    await query(`DELETE FROM report_translations WHERE ${KEY} AND status = 'running' AND run_id = '' AND created_at < now() - interval '2 minutes'`, keyParams(key));
    const rows = await query(
      `INSERT INTO report_translations (analysis_id, language, source_version, glossary_version, status, run_id, spans, charged) VALUES ($1, $2, $3, $4, 'running', '', $5, 0)
       ON CONFLICT (analysis_id, language, source_version, glossary_version) WHERE status <> 'failed' DO NOTHING RETURNING id`,
      [...keyParams(key), JSON.stringify(spans)],
    );
    return rows.length > 0;
  },
  async attach(key, runId, charged) {
    await query(`UPDATE report_translations SET run_id = $5, charged = $6 WHERE ${KEY} AND status = 'running' AND run_id = ''`, [...keyParams(key), runId, charged]);
  },
  async release(key) {
    await query(`DELETE FROM report_translations WHERE ${KEY} AND status = 'running' AND run_id = ''`, keyParams(key));
  },
  async finish(key, runId, patch) {
    const [r] = await query<{ charged: number }>(
      `UPDATE report_translations SET status = $6, studio_version = coalesce($7, studio_version), texts = $8, error = $9, finished_at = now()
        WHERE ${KEY} AND run_id = $5 AND status = 'running' RETURNING charged`,
      [...keyParams(key), runId, patch.status, patch.studioVersion ?? null, patch.texts ? JSON.stringify(patch.texts) : null, patch.error ?? null],
    );
    return r ? { charged: r.charged } : null;
  },
};

/** The glossary in force and its version, read in ONE statement so a run never uses the new terms under the old version. */
export async function readGlossary(): Promise<{ version: number; terms: GlossaryTerm[] }> {
  const [r] = await query<{ version: number; terms: GlossaryTerm[] }>(
    `SELECT v.version, coalesce((SELECT json_agg(json_build_object('source', g.source, 'target', g.target) ORDER BY lower(g.source)) FROM translation_glossary g), '[]'::json) AS terms
       FROM translation_glossary_version v`,
  );
  return { version: r?.version ?? 1, terms: r?.terms ?? [] };
}

/**
 * The administrator replaces the glossary: one transaction, serialised by a lock on the version row (two simultaneous saves never mix
 * their terms), and the version goes up by one with the terms — readers see the old glossary and version, or the new ones.
 */
export async function saveGlossary(terms: readonly GlossaryTerm[]): Promise<number> {
  const conn = await pool().connect();
  try {
    await conn.query("BEGIN");
    await conn.query("SELECT version FROM translation_glossary_version FOR UPDATE");
    await conn.query("DELETE FROM translation_glossary");
    for (const t of terms) await conn.query("INSERT INTO translation_glossary (source, target) VALUES ($1, $2) ON CONFLICT (source) DO UPDATE SET target = EXCLUDED.target", [t.source.trim(), t.target.trim()]);
    const { rows } = await conn.query<{ version: number }>("UPDATE translation_glossary_version SET version = version + 1, updated_at = now() RETURNING version");
    await conn.query("COMMIT");
    return rows[0]!.version;
  } catch (error) {
    await conn.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
}

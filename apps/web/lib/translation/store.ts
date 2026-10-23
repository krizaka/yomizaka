import { query } from "../db";
import type { GlossaryTerm, Lang } from "./port";
import type { StoredTranslation, TranslationStore } from "./service";

/** Translations and the legal glossary in PostgreSQL (migration 0027). */
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

export const pgTranslationStore: TranslationStore = {
  async find(analysisId, language, sourceVersion, glossaryVersion) {
    const [r] = await query<Row>(
      `SELECT status, run_id, studio_version, glossary_version, source_version, spans, texts, error, charged FROM report_translations
        WHERE analysis_id = $1 AND language = $2 AND source_version = $3 AND glossary_version = $4 ORDER BY created_at DESC LIMIT 1`,
      [analysisId, language, sourceVersion, glossaryVersion],
    );
    return r ? { status: r.status, runId: r.run_id, studioVersion: r.studio_version, glossaryVersion: r.glossary_version, sourceVersion: r.source_version, spans: r.spans, texts: r.texts, sent: Object.keys(r.spans).length, error: r.error, charged: r.charged } : null;
  },
  async save(analysisId, language, s) {
    await query("INSERT INTO report_translations (analysis_id, language, source_version, glossary_version, status, run_id, spans, charged) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [analysisId, language, s.sourceVersion, s.glossaryVersion, s.status, s.runId, JSON.stringify(s.spans), s.charged]);
  },
  async update(analysisId, language, runId, patch) {
    await query(
      "UPDATE report_translations SET status = coalesce($4, status), studio_version = coalesce($5, studio_version), texts = coalesce($6, texts), error = $7, charged = coalesce($8, charged), finished_at = CASE WHEN $4 IN ('done', 'failed') THEN now() ELSE finished_at END WHERE analysis_id = $1 AND language = $2 AND run_id = $3",
      [analysisId, language, runId, patch.status ?? null, patch.studioVersion ?? null, patch.texts ? JSON.stringify(patch.texts) : null, patch.error ?? null, patch.charged ?? null],
    );
  },
};

/** The glossary in force and its version — what a run is given and what a translation keeps. */
export async function readGlossary(): Promise<{ version: number; terms: GlossaryTerm[] }> {
  const [v] = await query<{ version: number }>("SELECT version FROM translation_glossary_version");
  const terms = await query<GlossaryTerm>("SELECT source, target FROM translation_glossary ORDER BY lower(source)");
  return { version: v?.version ?? 1, terms };
}

/** The administrator replaces the glossary: the version goes up by one, so earlier translations are not served for the new terms. */
export async function saveGlossary(terms: readonly GlossaryTerm[]): Promise<number> {
  await query("DELETE FROM translation_glossary");
  for (const t of terms) await query("INSERT INTO translation_glossary (source, target) VALUES ($1, $2) ON CONFLICT (source) DO UPDATE SET target = EXCLUDED.target", [t.source.trim(), t.target.trim()]);
  const [v] = await query<{ version: number }>("UPDATE translation_glossary_version SET version = version + 1, updated_at = now() RETURNING version");
  return v!.version;
}

export type { Lang };

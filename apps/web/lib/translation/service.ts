import type { Analysis } from "@yomizaka/core";

import type { TranslationTrace } from "./apply";
import { fieldsOf, sourceVersionOf } from "./fields";
import { type GlossaryTerm, type Lang, ORIGINAL, OUTCOME, type TranslationPort } from "./port";
import { protect, restore } from "./protect";

/**
 * A report's translation, started once and cached (yomizaka#246). `translate()` is the whole story: the report's generated
 * texts are masked (references, amounts, dates, quoted passages), sent through the port with the glossary, read back, unmasked —
 * a text whose protected spans did not come back identical is dropped and the original stays. A translation keeps its run id,
 * the glossary version and the version of the source text; a report already translated is never translated again.
 */

export const TRANSLATION_STATUS = { original: "original", running: "running", done: "done", failed: "failed" } as const;
export type TranslationStatus = (typeof TRANSLATION_STATUS)[keyof typeof TRANSLATION_STATUS];
export interface TranslationView {
  status: TranslationStatus;
  language: Lang;
  original: Lang;
  texts: Record<string, string> | null;
  trace: TranslationTrace | null;
  /** How many texts the Studio gave back and `restore` accepted, out of how many were sent. */
  accepted: { texts: number; of: number } | null;
  error: string | null;
}

export interface StoredTranslation {
  status: Exclude<TranslationStatus, "original">;
  runId: string;
  studioVersion: string | null;
  glossaryVersion: number;
  sourceVersion: string;
  spans: Record<string, string[]>;
  texts: Record<string, string> | null;
  sent: number;
  error: string | null;
  charged: number;
}

/** Where translations are kept; PostgreSQL in the app, a map in a unit test. */
export interface TranslationStore {
  /** The newest translation of this analysis into this language for exactly this source text and glossary. */
  find(analysisId: string, language: Lang, sourceVersion: string, glossaryVersion: number): Promise<StoredTranslation | null>;
  save(analysisId: string, language: Lang, stored: StoredTranslation): Promise<void>;
  update(analysisId: string, language: Lang, runId: string, patch: Partial<StoredTranslation>): Promise<void>;
}

export interface TranslationDeps {
  port: TranslationPort;
  store: TranslationStore;
  glossary: () => Promise<{ version: number; terms: readonly GlossaryTerm[] }>;
  /** Credits one translation costs (0 = included), taken before the run and given back if it fails. */
  credits: number;
  spend: (credits: number) => Promise<void>;
  refund: (credits: number) => Promise<void>;
}

const failed = (language: Lang, error: string, stored?: StoredTranslation): TranslationView => ({ status: "failed", language, original: ORIGINAL, texts: null, trace: null, accepted: null, error: stored?.error ?? error });

export async function translate(analysis: Pick<Analysis, "id" | "report">, language: Lang, deps: TranslationDeps): Promise<TranslationView> {
  if (!analysis.report) throw new Error("A report is needed to translate it");
  if (language === ORIGINAL) return { status: "original", language, original: ORIGINAL, texts: null, trace: null, accepted: null, error: null };
  const fields = fieldsOf(analysis.report);
  const sourceVersion = sourceVersionOf(fields);
  const glossary = await deps.glossary();
  const view = (stored: StoredTranslation): TranslationView => {
    const trace: TranslationTrace = { original: ORIGINAL, language, runId: stored.runId, studioVersion: stored.studioVersion, glossaryVersion: stored.glossaryVersion, sourceVersion: stored.sourceVersion };
    return stored.status === TRANSLATION_STATUS.done
      ? { status: "done", language, original: ORIGINAL, texts: stored.texts ?? {}, trace, accepted: { texts: Object.keys(stored.texts ?? {}).length, of: stored.sent }, error: null }
      : { status: stored.status, language, original: ORIGINAL, texts: null, trace: null, accepted: null, error: stored.error };
  };

  const existing = await deps.store.find(analysis.id, language, sourceVersion, glossary.version);
  if (existing?.status === TRANSLATION_STATUS.done) return view(existing);
  if (existing?.status === TRANSLATION_STATUS.running) {
    const outcome = await deps.port.read(existing.runId);
    if (outcome.state === OUTCOME.running) return view(existing);
    if (outcome.state === OUTCOME.failed) {
      await deps.refund(existing.charged);
      await deps.store.update(analysis.id, language, existing.runId, { status: "failed", error: outcome.reason, charged: 0 });
      return failed(language, outcome.reason);
    }
    const texts: Record<string, string> = {};
    for (const [key, text] of Object.entries(outcome.texts)) {
      const spans = existing.spans[key];
      const back = spans ? restore(text, spans) : null;
      if (back !== null && back.trim()) texts[key] = back;
    }
    const done = { ...existing, status: "done" as const, studioVersion: outcome.studioVersion, texts };
    await deps.store.update(analysis.id, language, existing.runId, { status: "done", studioVersion: outcome.studioVersion, texts });
    return view(done);
  }

  // Nothing yet (or the last try failed): start one.
  if (!fields.length) return view({ status: "done", runId: "none", studioVersion: null, glossaryVersion: glossary.version, sourceVersion, spans: {}, texts: {}, sent: 0, error: null, charged: 0 });
  const spans: Record<string, string[]> = {};
  const masked = fields.map((f) => {
    const p = protect(f.text);
    spans[f.key] = p.spans;
    return { ...f, text: p.masked };
  });
  await deps.spend(deps.credits);
  try {
    const { runId } = await deps.port.start({ source: ORIGINAL, target: language, fields: masked, glossary: glossary.terms });
    const stored: StoredTranslation = { status: "running", runId, studioVersion: null, glossaryVersion: glossary.version, sourceVersion, spans, texts: null, sent: fields.length, error: null, charged: deps.credits };
    await deps.store.save(analysis.id, language, stored);
    return view(stored);
  } catch (error) {
    await deps.refund(deps.credits);
    throw error;
  }
}

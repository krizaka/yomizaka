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
  /** The Orazaka run; empty while the right to start is claimed and the run is being started. */
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

/** The identity of a translation: one per analysis, language, source text and glossary (a failed one may be replaced). */
export interface TranslationKey {
  analysisId: string;
  language: Lang;
  sourceVersion: string;
  glossaryVersion: number;
}

/**
 * Where translations are kept; PostgreSQL in the app, a map in a unit test. Every transition is ATOMIC (review of #247): two requests
 * that ask at once start one run and spend once; two polls that see a run fail refund once.
 */
export interface TranslationStore {
  /** The active translation of this key (running or done), else the last failed one, else null. */
  find(key: TranslationKey): Promise<StoredTranslation | null>;
  /** Takes the right to start this key: false when an active translation already exists (somebody is starting it, or it runs, or it is done). */
  claim(key: TranslationKey, spans: Record<string, string[]>, sent: number): Promise<boolean>;
  /** The claim started a run. */
  attach(key: TranslationKey, runId: string, charged: number): Promise<void>;
  /** The claim could not start a run: gives the right back. */
  release(key: TranslationKey): Promise<void>;
  /** Running → done or failed, once: the credits to give back go to the one caller that made the transition, `null` to everyone else. */
  finish(key: TranslationKey, runId: string, patch: { status: "done" | "failed"; studioVersion?: string | null; texts?: Record<string, string>; error?: string }): Promise<{ charged: number } | null>;
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
  const key: TranslationKey = { analysisId: analysis.id, language, sourceVersion, glossaryVersion: glossary.version };
  const view = (stored: StoredTranslation): TranslationView => {
    const trace: TranslationTrace = { original: ORIGINAL, language, runId: stored.runId, studioVersion: stored.studioVersion, glossaryVersion: stored.glossaryVersion, sourceVersion: stored.sourceVersion };
    return stored.status === TRANSLATION_STATUS.done
      ? { status: TRANSLATION_STATUS.done, language, original: ORIGINAL, texts: stored.texts ?? {}, trace, accepted: { texts: Object.keys(stored.texts ?? {}).length, of: stored.sent }, error: null }
      : { status: stored.status, language, original: ORIGINAL, texts: null, trace: null, accepted: null, error: stored.error };
  };

  if (!fields.length) return view({ status: TRANSLATION_STATUS.done, runId: "none", studioVersion: null, glossaryVersion: glossary.version, sourceVersion, spans: {}, texts: {}, sent: 0, error: null, charged: 0 });

  const existing = await deps.store.find(key);
  if (existing?.status === TRANSLATION_STATUS.done) return view(existing);
  if (existing?.status === TRANSLATION_STATUS.running) {
    // Claimed and being started by another request: it will be there at the next ask.
    if (!existing.runId) return view(existing);
    const outcome = await deps.port.read(existing.runId);
    if (outcome.state === OUTCOME.running) return view(existing);
    if (outcome.state === OUTCOME.failed) {
      const won = await deps.store.finish(key, existing.runId, { status: "failed", error: outcome.reason });
      if (won) await deps.refund(won.charged);
      return failed(language, outcome.reason);
    }
    const texts: Record<string, string> = {};
    for (const [field, text] of Object.entries(outcome.texts)) {
      const spans = existing.spans[field];
      const back = spans ? restore(text, spans) : null;
      if (back !== null && back.trim()) texts[field] = back;
    }
    await deps.store.finish(key, existing.runId, { status: "done", studioVersion: outcome.studioVersion, texts });
    // Whoever made the transition, the stored result is the one every request reads.
    const settled = await deps.store.find(key);
    return view(settled ?? { ...existing, status: TRANSLATION_STATUS.done, studioVersion: outcome.studioVersion, texts });
  }

  // Nothing yet (or the last try failed): take the right to start — only one request does.
  const spans: Record<string, string[]> = {};
  const masked = fields.map((f) => {
    const p = protect(f.text);
    spans[f.key] = p.spans;
    return { ...f, text: p.masked };
  });
  if (!(await deps.store.claim(key, spans, fields.length))) {
    const other = await deps.store.find(key);
    return other ? view(other) : failed(language, "TRANSLATION_BUSY");
  }
  try {
    await deps.spend(deps.credits);
  } catch (error) {
    await deps.store.release(key);
    throw error;
  }
  try {
    const { runId } = await deps.port.start({ source: ORIGINAL, target: language, fields: masked, glossary: glossary.terms });
    await deps.store.attach(key, runId, deps.credits);
    return view({ status: TRANSLATION_STATUS.running, runId, studioVersion: null, glossaryVersion: glossary.version, sourceVersion, spans, texts: null, sent: fields.length, error: null, charged: deps.credits });
  } catch (error) {
    await deps.refund(deps.credits);
    await deps.store.release(key);
    throw error;
  }
}

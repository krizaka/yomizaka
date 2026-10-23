import type { TranslationField } from "./fields";

/**
 * The translation port (yomizaka#246): Yomizaka never translates; the texts go to the Studio `text-translation` of Orazaka and
 * come back with the run that produced them. This is the only seam — a test gives a fake, the app gives `orazakaTranslation`.
 */
export type Lang = "fr" | "en";
/** The language Orazaka's rules and reports are written in. */
export const ORIGINAL: Lang = "fr";
export interface GlossaryTerm {
  source: string;
  target: string;
}

export interface TranslationRequest {
  source: Lang;
  target: Lang;
  fields: readonly TranslationField[];
  /** The legal glossary in force, source → target, fixed. */
  glossary: readonly GlossaryTerm[];
}

export const OUTCOME = { running: "running", failed: "failed", done: "done" } as const;

export type TranslationOutcome =
  | { state: "running"; runId: string }
  | { state: "failed"; runId: string; reason: string }
  | { state: "done"; runId: string; studioVersion: string | null; texts: Record<string, string> };

export interface TranslationPort {
  start(request: TranslationRequest): Promise<{ runId: string }>;
  read(runId: string): Promise<TranslationOutcome>;
}

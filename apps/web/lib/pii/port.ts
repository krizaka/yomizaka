/**
 * The PERSONAL INFORMATION port (ADR-0006, Loi 25). Generic: no import from the app. It finds personal information in a text —
 * deterministically, in-process — and can redact it. The values it finds are NEVER logged or sent anywhere: `scan` returns
 * spans (positions) and counts, and callers show counts; only `redact` reads values, to blank them.
 */
export type PiiKind = "sin" | "email" | "phone" | "address" | "postal-code" | "birth-date" | "bank-account";

export interface PiiPatternDef {
  kind: PiiKind;
  label: { fr: string; en: string };
  /** Regular expression (flags `giu`); the whole match is the span unless `group` names a capture group. */
  pattern: string;
  group?: number;
  /** A check on the matched value (Luhn for a full SIN). Absent = every match counts. */
  validate?: "sin-luhn-or-masked";
  /** The match only counts when this appears in the 60 characters before it (a label such as « date de naissance »). */
  context?: string;
}

export interface PiiSpan {
  kind: PiiKind;
  start: number;
  end: number;
}

export interface PiiScan {
  spans: PiiSpan[];
  counts: Partial<Record<PiiKind, number>>;
  total: number;
}

export interface PersonalInfoScanner {
  scan(text: string): PiiScan;
  /** The text with every span replaced by `[label]`. */
  redact(text: string, lang: "fr" | "en"): string;
}

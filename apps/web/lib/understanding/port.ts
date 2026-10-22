/**
 * The document UNDERSTANDING port (ADR-0006). Generic on purpose — no import from this app, so another Krizaka product can
 * lift the folder. Given the text a document already yielded, it says — deterministically, in-process, for nothing — what the
 * document is (its nature, with a confidence), who issued it, its dates, parties, reference numbers, amounts, language. The
 * types of documents and their patterns are DATA (types.ts, patterns.ts). When the cheap pass is unsure it says so
 * (`needsModel`): a model run is the application's decision (a `ModelClassifier`), never this module's.
 */
export type Confidence = "high" | "medium" | "low" | "unknown";
export type Lang = "fr" | "en" | "unknown";

export interface Labelled {
  fr: string;
  en: string;
}

/** What a recognised nature leads to: the check that fits it (a rules pack), or none. */
export interface CheckTarget {
  studio: "compliance-check";
  /** The document type of the compliance form, and the named ruleset when it is not the jurisdiction's lease. */
  documentType: "lease" | "invoice" | "contract";
  ruleset: string | null;
}

export interface DocumentTypeDef {
  id: string;
  label: Labelled;
  /** Weighted evidence: a regular expression (source, flags `iu`) and the weight it adds. */
  signals: readonly { pattern: string; weight: number }[];
  /** Where the issuer is read from (first match wins): a regular expression whose group 1 is the issuer. */
  issuerPatterns?: readonly string[];
  /** A fixed issuer, when the nature itself names it (a Revenu Québec receipt). */
  issuer?: string;
  check: CheckTarget | null;
  /** Authenticity (PDF file facts) applies whatever the nature; false for a type where it would mislead. */
  authenticity?: boolean;
}

export interface IdentifierDef {
  kind: string;
  label: Labelled;
  /** Group 1 is the value. */
  pattern: string;
  /** A checksum-free sanity filter on the value. */
  valuePattern?: string;
}

export interface DateFact {
  kind: "issued" | "effective" | "due" | "period" | "other";
  /** ISO date (yyyy-mm-dd). */
  value: string;
  /** The words as written. */
  text: string;
}
export interface PartyFact {
  role: string;
  name: string;
}
export interface ReferenceFact {
  kind: string;
  value: string;
}
export interface AmountFact {
  kind: "total" | "subtotal" | "gst" | "qst" | "rent" | "deposit" | "other";
  /** Cents, never a float. */
  cents: number;
  text: string;
}

export interface Understanding {
  nature: { id: string; label: Labelled; confidence: Confidence; score: number } | null;
  /** The next-best nature when the evidence is close (an honest « could also be »). */
  alternative: { id: string; label: Labelled } | null;
  language: Lang;
  pages: number | null;
  issuer: string | null;
  dates: DateFact[];
  parties: PartyFact[];
  references: ReferenceFact[];
  amounts: AmountFact[];
  /** The check this nature leads to, or null: no rules pack applies (said plainly, never a default). */
  check: CheckTarget | null;
  authenticity: boolean;
  /** The cheap pass is unsure: a model classification could help. */
  needsModel: boolean;
}

export interface DocumentUnderstanding {
  understand(text: string, context: { pages: number | null; filename?: string }): Understanding;
}

/** Optional: asks a model, when `needsModel`. The application supplies it (and its run id); this module never does. */
export interface ModelClassifier {
  classify(text: string): Promise<{ natureId: string; runId: string } | null>;
}

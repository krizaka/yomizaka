import type { PiiPatternDef } from "./port";

/** The patterns, as DATA. Order matters only for overlaps: the earlier kind wins a span. */
export const PII_PATTERNS: readonly PiiPatternDef[] = [
  // SIN / NAS: nine digits in 3-3-3, fully written (Luhn-valid) or partly masked (X, *, •) as receipts print them.
  { kind: "sin", label: { fr: "NAS", en: "SIN" }, pattern: "(?<![\\dA-Za-z])(?:\\d{3}|[X*•]{3})[ -]?(?:\\d{3}|[X*•]{3})[ -]?(?:\\d{3}|[X*•]{3})(?![\\dA-Za-z])", validate: "sin-luhn-or-masked" },
  { kind: "email", label: { fr: "Courriel", en: "E-mail" }, pattern: "[\\p{L}\\d._%+-]+@[\\p{L}\\d.-]+\\.[\\p{L}]{2,}" },
  { kind: "phone", label: { fr: "Téléphone", en: "Phone" }, pattern: "(?<!\\d)(?:\\+?1[ .-]?)?\\(?\\d{3}\\)?[ .-]\\d{3}[ .-]\\d{4}(?!\\d)" },
  { kind: "postal-code", label: { fr: "Code postal", en: "Postal code" }, pattern: "\\b[ABCEGHJ-NPRSTVXY]\\d[ABCEGHJ-NPRSTV-Z][ -]?\\d[ABCEGHJ-NPRSTV-Z]\\d\\b" },
  { kind: "address", label: { fr: "Adresse", en: "Address" }, pattern: "\\b\\d{1,5}(?:[ -]?[A-Z])?,?\\s+(?:rue|avenue|av\\.|boulevard|boul\\.|chemin|ch\\.|place|rang|route|croissant|impasse|montée|street|st\\.|road|rd\\.|drive|lane)\\s+[\\p{L}'’ .-]{2,40}" },
  { kind: "birth-date", label: { fr: "Date de naissance", en: "Date of birth" }, pattern: "\\d{4}-\\d{2}-\\d{2}|\\d{1,2}(?:er)?\\s+[\\p{L}]{3,9}\\s+\\d{4}|\\d{1,2}[/.]\\d{1,2}[/.]\\d{4}", context: "date\\s+de\\s+naissance|n[ée]\\(?e?\\)?\\s+le|date\\s+of\\s+birth|\\bDOB\\b|born" },
  { kind: "bank-account", label: { fr: "Compte bancaire", en: "Bank account" }, pattern: "\\b[A-Z]{2}\\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}\\b|(?<!\\d)\\d{5}[- ]\\d{3}[- ]\\d{7,12}(?!\\d)|(?<!\\d)\\d{7,12}(?!\\d)", context: "compte|account|transit|institution|IBAN|\\bRIB\\b|num[ée]ro\\s+de\\s+compte" },
];

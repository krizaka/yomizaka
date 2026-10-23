/**
 * What a translation never touches (yomizaka#246): the law references, the amounts, the dates, the rule ids and every quoted
 * passage inside a generated text. They are replaced by numbered tokens before the text leaves for the Studio and put back
 * after; if the Studio lost, doubled or invented a token, the translation of that text is refused and the original stays.
 * Pure: no network, no clock.
 */
const MONTHS = "janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|January|February|March|April|May|June|July|August|September|October|November|December";
const PROTECTED: RegExp[] = [
  // a passage quoted from the document, in French or English quotation marks
  /«[^»]*»/g,
  /“[^”]*”/g,
  /"[^"\n]{3,}"/g,
  // law references: C.c.Q. art. 1904, L.R.Q., c. B-1, Code civil du Québec, art. 1904.1, art. 1904 al. 2, RLRQ…
  /\b(?:C\.c\.Q\.|CCQ|L\.R\.Q\.|RLRQ|C\.p\.c\.|L\.p\.c\.|Code civil du Québec|Civil Code of Québec)(?:[,\s]+(?:art\.|al\.|par\.|c\.|chap\.)?\s*[A-Z]?-?\d+(?:\.\d+)?)*/g,
  /\b(?:art\.|articles?|section)\s*\d+(?:\.\d+)?(?:\s*(?:al\.|par\.)\s*\d+)?(?:\s*(?:et|à|and|to|-)\s*\d+(?:\.\d+)?)?/gi,
  // amounts and percentages: 1 234,56 $, $1,234.56, 12 %, 12 CAD
  /\d[\d\s\u00a0\u202f.,]*\d?\s?(?:\$|CAD|\$ CA|%)/g,
  /\$\s?\d(?:[\d,. ]*\d)?/g,
  // dates: 2026-10-23, 23 octobre 2026, October 23, 2026, 23/10/2026
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  new RegExp(`\\b\\d{1,2}(?:er)?\\s+(?:${MONTHS})\\s+\\d{4}\\b`, "gi"),
  new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{4}\\b`, "gi"),
  // a rule id such as QC-LEASE-001
  /\b[A-Z]{2,}(?:-[A-Z0-9]+){1,}\b/g,
];

const OPEN = "⟦";
const CLOSE = "⟧";
const TOKEN = /⟦(\d+)⟧/g;

export interface Protected {
  /** The text with each protected span replaced by `⟦n⟧`. */
  masked: string;
  /** The spans, in token order. */
  spans: string[];
}

/** Masks every protected span (longest-leftmost wins, spans never overlap). */
export function protect(text: string): Protected {
  const found: { start: number; end: number }[] = [];
  for (const pattern of PROTECTED) {
    for (const m of text.matchAll(new RegExp(pattern.source, pattern.flags))) {
      if (m[0].trim() === "") continue;
      found.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  // Overlapping matches are merged into one span — dropping one could leave part of a protected value exposed.
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const chosen: { start: number; end: number }[] = [];
  for (const f of found) {
    const last = chosen[chosen.length - 1];
    if (last && f.start < last.end) last.end = Math.max(last.end, f.end);
    else chosen.push({ ...f });
  }
  let masked = "";
  let at = 0;
  const spans: string[] = [];
  for (const { start, end } of chosen) {
    masked += text.slice(at, start) + `${OPEN}${spans.length}${CLOSE}`;
    spans.push(text.slice(start, end));
    at = end;
  }
  return { masked: masked + text.slice(at), spans };
}

/** Puts the spans back. `null` when a token is missing, doubled or invented: the translation cannot be trusted. */
export function restore(translated: string, spans: readonly string[]): string | null {
  const seen = new Set<number>();
  let ok = true;
  const out = translated.replace(TOKEN, (_, n: string) => {
    const i = Number(n);
    if (i >= spans.length || seen.has(i)) {
      ok = false;
      return "";
    }
    seen.add(i);
    return spans[i]!;
  });
  if (!ok || seen.size !== spans.length) return null;
  return out.includes(OPEN) || out.includes(CLOSE) ? null : out;
}

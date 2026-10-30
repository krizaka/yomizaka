import type { PersonalInfoScanner, PiiKind, PiiPatternDef, PiiScan, PiiSpan } from "./port";

/** Luhn, for a fully written nine-digit SIN. */
function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

function valid(def: PiiPatternDef, value: string): boolean {
  if (def.validate === "sin-luhn-or-masked") {
    if (/[X*•]/i.test(value)) return true; // partly or fully masked: still a SIN line, already hidden
    return luhn(value.replace(/\D/g, ""));
  }
  return true;
}

type Compiled = { p: PiiPatternDef; re: RegExp; ctx: RegExp | null };

/** The span of one match, or null when it is empty, not preceded by its context words, or not valid for its kind. */
function spanOf(text: string, m: RegExpMatchArray, { p, ctx }: Compiled): PiiSpan | null {
  const value = p.group ? m[p.group] : m[0];
  if (!value) return null;
  const start = m.index! + (p.group ? m[0].indexOf(value) : 0);
  if (ctx && !ctx.test(text.slice(Math.max(0, start - 60), start))) return null;
  return valid(p, value) ? { kind: p.kind, start, end: start + value.length } : null;
}

/** How many spans of each kind. */
function countKinds(spans: readonly PiiSpan[]): Partial<Record<PiiKind, number>> {
  const counts: Partial<Record<PiiKind, number>> = {};
  for (const s of spans) counts[s.kind] = (counts[s.kind] ?? 0) + 1;
  return counts;
}

export function createScanner(patterns: readonly PiiPatternDef[]): PersonalInfoScanner {
  const compiled: Compiled[] = patterns.map((p) => ({
    p,
    re: new RegExp(p.pattern, "giu"),
    ctx: p.context ? new RegExp(p.context, "iu") : null,
  }));
  const labels = new Map(patterns.map((p) => [p.kind, p.label] as const));

  function scan(text: string): PiiScan {
    const spans: PiiSpan[] = [];
    const taken = (span: PiiSpan) => spans.some((s) => span.start < s.end && span.end > s.start);
    for (const entry of compiled) {
      entry.re.lastIndex = 0;
      for (const m of text.matchAll(entry.re)) {
        const span = spanOf(text, m, entry);
        if (span && !taken(span)) spans.push(span);
      }
    }
    spans.sort((a, b) => a.start - b.start);
    return { spans, counts: countKinds(spans), total: spans.length };
  }

  return {
    scan,
    redact(text, lang) {
      let out = "";
      let cursor = 0;
      for (const s of scan(text).spans) {
        out += `${text.slice(cursor, s.start)}[${labels.get(s.kind)?.[lang] ?? s.kind}]`;
        cursor = s.end;
      }
      return out + text.slice(cursor);
    },
  };
}

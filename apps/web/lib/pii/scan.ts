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
    if (/[X*•]/i.test(value)) return /\d/.test(value) || true; // partly or fully masked: still a SIN line, already hidden
    return luhn(value.replace(/\D/g, ""));
  }
  return true;
}

export function createScanner(patterns: readonly PiiPatternDef[]): PersonalInfoScanner {
  const compiled = patterns.map((p) => ({ p, re: new RegExp(p.pattern, "giu"), ctx: p.context ? new RegExp(p.context, "iu") : null }));
  const labels = new Map(patterns.map((p) => [p.kind, p.label] as const));

  function scan(text: string): PiiScan {
    const spans: PiiSpan[] = [];
    const taken = (start: number, end: number) => spans.some((s) => start < s.end && end > s.start);
    for (const { p, re, ctx } of compiled) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        const value = p.group ? m[p.group] : m[0];
        if (!value) continue;
        const start = m.index! + (p.group ? m[0].indexOf(value) : 0);
        const end = start + value.length;
        if (taken(start, end)) continue;
        if (ctx && !ctx.test(text.slice(Math.max(0, start - 60), start))) continue;
        if (!valid(p, value)) continue;
        spans.push({ kind: p.kind, start, end });
      }
    }
    spans.sort((a, b) => a.start - b.start);
    const counts: Partial<Record<PiiKind, number>> = {};
    for (const s of spans) counts[s.kind] = (counts[s.kind] ?? 0) + 1;
    return { spans, counts, total: spans.length };
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

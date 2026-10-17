/**
 * The landing's structure — ids and destinations, never words (the words are in messages/, keyed by the same ids).
 * One story: the promise with one clear before/after, what you can do, the proof (a real recorded run), how it works, the app recorded, trust, the closing call.
 */
export const HOME_SECTIONS = ["hero", "features", "audiences", "proof", "app", "comparison", "promise", "faq", "closing"] as const;

type DevPreview = { criteria: Record<string, { evidence: string | null; na?: boolean }> };

/**
 * The honest status chip, read from the dev-preview record (dev-preview.json at the repository's root): « Dev preview »
 * only once every criterion has its evidence (or is not applicable); « In development » while one still has a gap.
 */
export function productStatus(preview: DevPreview): "development" | "preview" {
  return Object.values(preview.criteria).every((c) => c.evidence !== null || c.na === true) ? "preview" : "development";
}

/**
 * The figures of the hero's band, counted from the recorded check (never typed): the rules evaluated, the distinct articles of
 * the Civil Code its findings cite, and the findings themselves.
 */
export function HERO_FIGURES(report: { findings: readonly { citation?: string | null }[]; summary?: { rulesEvaluated?: number } | null }): { rules: number; articles: number; found: number } {
  const articles = new Set<string>();
  for (const f of report.findings) for (const m of (f.citation ?? "").matchAll(/art\.\s*(\d+)(?:\s*(?:et|,)\s*(\d+))?/g)) for (const n of [m[1], m[2]]) if (n) articles.add(n);
  return { rules: report.summary?.rulesEvaluated ?? report.findings.length, articles: articles.size, found: report.findings.length };
}

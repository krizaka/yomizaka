/**
 * The landing's structure — ids and destinations, never words (the words are in messages/, keyed by the same ids).
 * One story in five sections: the promise and its living proof, what you can do, how it works, trust, the closing call.
 */
export const HOME_SECTIONS = ["hero", "outcomes", "how", "trust", "closing"] as const;

/** What a visitor gets — outcomes, not features — and where each card leads (no dead-end card). */
export const OUTCOMES = [
  { id: "clauses", to: "run" },
  { id: "edits", to: "sign-in" },
  { id: "proof", to: "verify" },
] as const;

/** How it works: who does what, in three steps. */
export const HOW_STEPS = ["keep", "read", "prove"] as const;

/** Why a visitor can trust it: where the documents live, what is traced, the code. */
export const TRUST = ["canada", "traced", "open"] as const;

type DevPreview = { criteria: Record<string, { evidence: string | null; na?: boolean }> };

/**
 * The honest status chip, read from the dev-preview record (dev-preview.json at the repository's root): « Dev preview »
 * only once every criterion has its evidence (or is not applicable); « In development » while one still has a gap.
 */
export function productStatus(preview: DevPreview): "development" | "preview" {
  return Object.values(preview.criteria).every((c) => c.evidence !== null || c.na === true) ? "preview" : "development";
}

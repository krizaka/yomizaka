/**
 * The share of income that a rent takes (yomizaka#557, slice 2 of #104). Pure and deterministic, in integer cents and basis points.
 * It speaks only of two figures — never of the person: no score, no « refuse ». The income is a figure the applicant chose to give
 * (read from a pay stub examined as a file, never from a bank login), used in memory and never stored: the CAI finds a salary not
 * necessary to require, so the check never asks for one. The reference share is a parameter (data), not a legal limit: the common
 * « 30 % of income » is a rule of thumb, and the messages say so.
 */
export const AFFORDABILITY_RULE = { id: "TS-A-001" } as const;

export type AffordabilityCode = "within-reference" | "above-reference" | "no-claim";

export interface AffordabilityInput {
  /** The monthly rent of the lease, in integer cents. */
  rentCents: number;
  /** The gross monthly income the applicant gave, in integer cents; absent when none was given. */
  monthlyIncomeCents?: number;
  /** The reference share, in basis points of the income (3000 = 30 %); from the settings. */
  referenceBasisPoints: number;
}

export interface AffordabilityResult {
  ruleId: typeof AFFORDABILITY_RULE.id;
  /** `finding` asks for a look; `ok` is within the reference; `no-claim` says nothing, for want of a usable figure. */
  status: "finding" | "ok" | "no-claim";
  code: AffordabilityCode;
  figures: { rentCents: number; monthlyIncomeCents?: number; shareBasisPoints?: number; referenceBasisPoints: number };
}

const isPositiveInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;

export function checkAffordability(input: AffordabilityInput): AffordabilityResult {
  const { rentCents, monthlyIncomeCents, referenceBasisPoints } = input;
  const base = { ruleId: AFFORDABILITY_RULE.id, figures: { rentCents, referenceBasisPoints } } as const;
  if (!isPositiveInt(rentCents) || !isPositiveInt(monthlyIncomeCents) || !isPositiveInt(referenceBasisPoints)) {
    return { ...base, status: "no-claim", code: "no-claim" };
  }
  const shareBasisPoints = Math.round((rentCents * 10_000) / monthlyIncomeCents);
  const figures = { ...base.figures, monthlyIncomeCents, shareBasisPoints };
  return shareBasisPoints <= referenceBasisPoints
    ? { ...base, figures, status: "ok", code: "within-reference" }
    : { ...base, figures, status: "finding", code: "above-reference" };
}

/** The message key of a result, under `affordability.<code>` in the catalogues. */
export const affordabilityMessageKey = (r: Pick<AffordabilityResult, "code">) => `affordability.${r.code}` as const;

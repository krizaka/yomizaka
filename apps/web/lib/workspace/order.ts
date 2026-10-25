import { statusOrder,type StatusSet } from "@krizaka/organize/contract";

/**
 * The order of the decision column is the set's order (krizaka-ts ADR-003 § 2): « à décider », then « retenu », then « non retenu ».
 * Never a check's result, a score or a suggestion: a decision about a person is the manager's. Pure.
 */
export function decisionOrder(set: StatusSet, state: string): number {
  return statusOrder(set).get(state) ?? statusOrder(set).size;
}

/** Rows by decision (the set's order), then by the day they were asked, newest first; `desc` reverses the whole order. */
export function sortByDecision<R extends { decision: string; createdAt: string }>(rows: readonly R[], set: StatusSet, direction: "asc" | "desc" = "asc"): R[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * (decisionOrder(set, a.decision) - decisionOrder(set, b.decision) || b.createdAt.localeCompare(a.createdAt)));
}

import type { StatusSet } from "@krizaka/organize/contract";
import { Badge } from "@krizaka/ui/badge";

/**
 * The state of an entity in its kind's status set: the set's tone and its written label, in the person's language.
 * TODO(krizaka-ui#627): delete this wrapper the day `StatusChip` ships; the call sites keep their props (ADR-006 § 6).
 */
export function StatusChip({ set, state, locale }: { set: StatusSet; state: string; locale: "en" | "fr" }) {
  const found = set.states.find((s) => s.key === state);
  return <Badge tone={found?.tone ?? "neutral"}>{found?.label[locale] ?? state}</Badge>;
}

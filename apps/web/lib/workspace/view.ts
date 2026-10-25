import { sameFilters, type SavedView, type SystemView, type ViewFilters } from "@krizaka/organize/contract";

/**
 * A list's view from its address (krizaka-ts ADR-003 § 3). The address holds the state: `?view=` names a system view (its key) or a
 * saved one (its id), and the filters it carries win over the view's. A view alone (`?view=to_decide`) is its own filters. Pure.
 */
export interface ResolvedView {
  /** The view named by the address and found, or null. */
  active: { kind: "system" | "saved"; id: string; label: string } | null;
  /** The filters that narrow the list. */
  filters: ViewFilters;
  /** The address changed the active view's filters: the view is « modified » and can be saved again. */
  modified: boolean;
}

const hasFilters = (f: ViewFilters) => Object.values(f).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== ""));

export function resolveView(address: { view: string | null; filters: ViewFilters }, system: readonly SystemView[], saved: readonly SavedView[], locale: "en" | "fr"): ResolvedView {
  const sys = address.view ? system.find((v) => v.key === address.view) : undefined;
  const mine = address.view && !sys ? saved.find((v) => v.id === address.view) : undefined;
  const found = sys ? { kind: "system" as const, id: sys.key, label: sys.label[locale], filters: sys.filters } : mine ? { kind: "saved" as const, id: mine.id, label: mine.name, filters: mine.filters } : null;
  if (!found) return { active: null, filters: address.filters, modified: false };
  const own = hasFilters(address.filters);
  return { active: { kind: found.kind, id: found.id, label: found.label }, filters: own ? address.filters : found.filters, modified: own && !sameFilters(address.filters, found.filters) };
}

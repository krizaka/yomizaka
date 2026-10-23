import { readFilterParams, writeFilterParams } from "@krizaka/ui/filter-bar";
import { DOCUMENT_KINDS, DOCUMENT_STATUSES, type DocumentKind, type DocumentStatus } from "@yomizaka/core";

import type { CheckSummary } from "./checks";

/**
 * The filters of the Vérifications list (the UX review's § 4.4, Y6), read from and written to the address: `?result=attention`,
 * `?kind=lease,invoice`, `?q=bail`. The rows are filtered here, in the page's own state of the URL, never in a second copy of the list.
 */
export interface CheckFilters {
  readonly result: readonly DocumentStatus[];
  readonly kind: readonly DocumentKind[];
  /** A words search over the document's title, accents and case ignored. */
  readonly q: string;
}

export const NO_CHECK_FILTERS: CheckFilters = { result: [], kind: [], q: "" };

export const isDocumentStatus = (value: string): value is DocumentStatus => (DOCUMENT_STATUSES as readonly string[]).includes(value);
export const isDocumentKind = (value: string): value is DocumentKind => (DOCUMENT_KINDS as readonly string[]).includes(value);

/** The filters in the address. Unknown values are dropped, so a stale or edited link never breaks the list. */
export function checkFiltersOf(params: URLSearchParams): CheckFilters {
  const read = readFilterParams(params, ["result", "kind"]);
  return {
    result: DOCUMENT_STATUSES.filter((s) => (read.result ?? []).includes(s)),
    kind: DOCUMENT_KINDS.filter((k) => (read.kind ?? []).includes(k)),
    q: (params.get("q") ?? "").trim(),
  };
}

/** The address with these filters: the other parameters (the tab) are kept, empty filters are removed. */
export function writeChecksFilters(base: URLSearchParams, filters: CheckFilters): URLSearchParams {
  return writeFilterParams(base, { result: filters.result, kind: filters.kind, q: filters.q });
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** The checks that match every filter in force, in the order given (newest first). */
export function filterChecks(checks: readonly CheckSummary[], filters: CheckFilters): CheckSummary[] {
  const words = fold(filters.q);
  return checks.filter(
    (c) =>
      (filters.result.length === 0 || filters.result.includes(c.result)) &&
      (filters.kind.length === 0 || filters.kind.includes(c.kind)) &&
      (words === "" || fold(c.title).includes(words)),
  );
}

export const checkFiltersActive = (filters: CheckFilters): boolean => filters.result.length > 0 || filters.kind.length > 0 || filters.q !== "";

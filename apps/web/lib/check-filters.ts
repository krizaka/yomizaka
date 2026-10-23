import { readFilterParams, writeFilterParams } from "@krizaka/ui/filter-bar";
import { DOCUMENT_KINDS, DOCUMENT_STATUSES, type DocumentKind, type DocumentStatus } from "@yomizaka/core";
import { isBefore, startOfYear, subDays } from "date-fns";

import type { CheckSummary } from "@/lib/checks";

/** The filters of the Vérifications list, each a key in the address (`?q=bail&result=attention,failed&kind=lease&period=30d`) — the URL is the state (§ 7). */
export const CHECK_FILTER_KEYS = ["q", "result", "kind", "period"] as const;
/** A check's results worth filtering on — never « stored »: a document that was never checked is not a check. */
export const CHECK_RESULTS: readonly DocumentStatus[] = DOCUMENT_STATUSES.filter((s) => s !== "stored");
export const CHECK_PERIODS = ["7d", "30d", "year"] as const;
export type CheckPeriod = (typeof CHECK_PERIODS)[number];

export interface CheckFilters {
  /** Words looked for in the document's title. */
  q: string;
  result: readonly DocumentStatus[];
  kind: readonly DocumentKind[];
  period: CheckPeriod | null;
}
export const NO_CHECK_FILTERS: CheckFilters = { q: "", result: [], kind: [], period: null };

const known = <V extends string>(values: readonly string[], vocabulary: readonly V[]): V[] => vocabulary.filter((v) => values.includes(v));

/** The filters an address carries — an unknown value is dropped, so a stale link never breaks the page. */
export function readCheckFilters(search: string | URLSearchParams): CheckFilters {
  const read = readFilterParams(typeof search === "string" ? new URLSearchParams(search) : search, CHECK_FILTER_KEYS);
  return {
    q: (read.q ?? []).join(" ").trim(),
    result: known(read.result ?? [], CHECK_RESULTS),
    kind: known(read.kind ?? [], DOCUMENT_KINDS),
    period: CHECK_PERIODS.find((p) => (read.period ?? []).includes(p)) ?? null,
  };
}

/** The address with these filters: the other keys (the tab) kept, an empty filter removed, several values comma-separated. */
export function writeCheckFilters(base: URLSearchParams, filters: CheckFilters): URLSearchParams {
  return writeFilterParams(base, { q: filters.q.trim() || null, result: filters.result, kind: filters.kind, period: filters.period });
}

export const hasCheckFilters = (f: CheckFilters): boolean => f.q.length > 0 || f.result.length > 0 || f.kind.length > 0 || f.period !== null;

/** When a period starts, from `now`: the last 7 or 30 days, or this year. */
export function periodStart(period: CheckPeriod, now: Date): Date {
  return period === "year" ? startOfYear(now) : subDays(now, period === "7d" ? 7 : 30);
}

/** Text without its accents and case, for the search (« Dépôt » matches « depot »). */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The rows the filters keep: every word of the query in the title; the result, the kind and the period match. */
export function applyCheckFilters(rows: readonly CheckSummary[], f: CheckFilters, now: Date): CheckSummary[] {
  const words = fold(f.q).split(/\s+/).filter(Boolean);
  const since = f.period ? periodStart(f.period, now) : null;
  return rows.filter((c) => {
    if (words.length && !words.every((w) => fold(c.title).includes(w))) return false;
    if (f.result.length && !f.result.includes(c.result)) return false;
    if (f.kind.length && !f.kind.includes(c.kind)) return false;
    if (since && isBefore(new Date(c.at), since)) return false;
    return true;
  });
}

/** How many rows each value of one filter would give, with the other filters in force — the count on the menu's options. */
export function countByValue(rows: readonly CheckSummary[], f: CheckFilters, key: "result" | "kind", now: Date): Record<string, number> {
  const base = applyCheckFilters(rows, { ...f, [key]: [] }, now);
  const counts: Record<string, number> = {};
  for (const c of base) counts[c[key]] = (counts[c[key]] ?? 0) + 1;
  return counts;
}

/** The same for the periods: how many rows each period keeps, the other filters in force. */
export function countByPeriod(rows: readonly CheckSummary[], f: CheckFilters, now: Date): Record<CheckPeriod, number> {
  const base = applyCheckFilters(rows, { ...f, period: null }, now);
  return Object.fromEntries(CHECK_PERIODS.map((p) => [p, applyCheckFilters(base, { ...NO_CHECK_FILTERS, period: p }, now).length])) as Record<CheckPeriod, number>;
}

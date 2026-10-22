/**
 * The state of a list table, kept in the address so a refresh, a shared link and the back button restore it
 * (`?q=&kind=&status=&page=&size=&sort=`). Pure: the table component and its test share these.
 */
export const PAGE_SIZES = [10, 25, 50] as const;

export const TABLE_DEFAULTS = { q: "", page: "1", size: "25", sort: "added:desc" } as const;

type Sort = { column: string; direction: "ascending" | "descending" } | null;
const DIRECTION = { asc: "ascending", desc: "descending" } as const;
const CODE = { ascending: "asc", descending: "desc" } as const;

/** `column:asc|desc`, on a sortable column; `none` is no sort; anything else is the default. */
export function sortOf(raw: string, sortable: readonly string[]): Sort {
  if (raw === "none") return null;
  const [column, direction, extra] = raw.split(":");
  if (column && direction && extra === undefined && sortable.includes(column) && Object.hasOwn(DIRECTION, direction)) return { column, direction: DIRECTION[direction as keyof typeof DIRECTION] };
  return sortOf(TABLE_DEFAULTS.sort, sortable.includes("added") ? sortable : ["added"]) ?? null;
}

export function sortParam(sort: Sort): string {
  return sort ? `${sort.column}:${CODE[sort.direction]}` : "none";
}

/** A page number from 1. */
export function pageOf(raw: string): number {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 && /^\d+$/.test(raw) && n <= 1_000_000 ? n : 1;
}

export function pageSizeOf(raw: string): number {
  const n = Number(raw);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : Number(TABLE_DEFAULTS.size);
}

/** The allowed values of a comma-separated parameter, in order, once each. */
export function parseList<V extends string>(raw: string, allowed: readonly V[]): V[] {
  return [...new Set(raw.split(",").filter((v): v is V => (allowed as readonly string[]).includes(v)))];
}

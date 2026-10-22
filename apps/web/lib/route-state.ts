import { DOCUMENT_KINDS } from "@yomizaka/core";

/** A choice that lives in the address: `?<key>=<value>`, one of a closed list, absent when it is the default. */
export interface RouteState<V extends string> {
  key: string;
  values: readonly V[];
  fallback: V;
}

/** The kinds a check can be asked for: the document kinds' own words, plus « let Yomizaka decide ». */
export const CHECK_KINDS = ["auto", ...DOCUMENT_KINDS] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export const KEEP_CHOICES = ["0", "1"] as const;
export type KeepChoice = (typeof KEEP_CHOICES)[number];

/** Every route-state of the app, so one test table covers them all. */
export const ROUTE_STATES = {
  checkKind: { path: "/app/verifier", state: { key: "type", values: CHECK_KINDS, fallback: "auto" } satisfies RouteState<CheckKind> },
  keepDocuments: { path: "/app/verifier", state: { key: "conserver", values: KEEP_CHOICES, fallback: "0" } satisfies RouteState<KeepChoice> },
} as const;

/** The value in the address; an unknown or missing one is the default (a stale link never breaks the page). */
export function readRouteValue<V extends string>(search: string, { key, values, fallback }: RouteState<V>): V {
  const raw = new URLSearchParams(search).get(key);
  return values.find((v) => v === raw) ?? fallback;
}

/** The address with `value` chosen: the other parameters stay, the default leaves the address clean. */
export function routeHref<V extends string>(path: string, search: string, { key, fallback }: RouteState<V>, value: V): string {
  const params = new URLSearchParams(search);
  if (value === fallback) params.delete(key);
  else params.set(key, value);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

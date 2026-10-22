"use client";

import { useRouteState as useUrlState } from "@krizaka/ui/router";

import type { RouteState } from "@/lib/route-state";

/**
 * A choice whose state is the address (`?key=value`): back and forward, refresh and a shared link restore it. The app's
 * `RouteState` (key, values, fallback) over Krizaka UI's `useRouteState`; selection components bind to the same key with
 * `routeKey`.
 */
export function useRouteState<V extends string>(state: RouteState<V>): readonly [V, (value: V) => void] {
  return useUrlState(state.key, { values: state.values, default: state.fallback });
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { readRouteValue, routeHref,type RouteState } from "@/lib/route-state";

/**
 * A choice whose state is the address (`?key=value`): back and forward, refresh and a shared link restore it. The one place
 * to swap for Krizaka UI's `useRouteState` when it ships.
 */
export function useRouteState<V extends string>(state: RouteState<V>): [V, (value: V) => void] {
  const router = useRouter();
  const path = usePathname() ?? "";
  const search = useSearchParams()?.toString() ?? "";
  return [readRouteValue(search, state), (value) => router.push(routeHref(path, search, state, value), { scroll: false })];
}

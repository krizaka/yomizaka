import { describe, expect, it } from "vitest";

import { readRouteValue, ROUTE_STATES, routeHref,type RouteState } from "./route-state";

type Row = { path: string; state: RouteState<string> };
const table = Object.entries(ROUTE_STATES) as unknown as [string, Row][];
const search = (href: string) => href.split("?")[1] ?? "";

/** One table for every route-state: a deep link selects the value, a click updates the address, back restores the previous one. */
describe.each(table)("%s", (_name, { path, state }) => {
  it("takes the default for a missing or unknown value", () => {
    expect(readRouteValue("", state)).toBe(state.fallback);
    expect(readRouteValue(`${state.key}=nope`, state)).toBe(state.fallback);
  });
  it("keeps the other parameters and a clean address on the default", () => {
    const other = state.values.find((v) => v !== state.fallback)!;
    expect(routeHref(path, "x=1", state, other)).toBe(`${path}?x=1&${state.key}=${other}`);
    expect(routeHref(path, `${state.key}=${other}`, state, state.fallback)).toBe(path);
  });
  it.each(state.values)("%s: deep link selects it, click writes it, back restores the previous", (value) => {
    expect(readRouteValue(search(routeHref(path, "", state, value)), state)).toBe(value);
    const history = [path];
    history.push(routeHref(path, search(history.at(-1)!), state, value));
    expect(readRouteValue(search(history.at(-1)!), state)).toBe(value);
    history.pop();
    expect(readRouteValue(search(history.at(-1)!), state)).toBe(state.fallback);
  });
});

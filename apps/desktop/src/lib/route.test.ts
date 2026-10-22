import { describe, expect, it } from "vitest";

import { HOME, hashOf, parseRoute, type Route } from "./route";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("the window's address", () => {
  it.each<[string, Route]>([
    ["", HOME],
    ["#/library", HOME],
    ["#/library/%2FUsers%2Feric%2FBaux", { screen: "library", folder: "/Users/eric/Baux" }],
    [`#/check/${A}/${B}`, { screen: "check", documentId: A, analysisId: B }],
    ["#/settings", { screen: "settings" }],
  ])("reads %j", (hash, route) => expect(parseRoute(hash)).toEqual(route));

  it("falls back to the library for an address it does not know", () => {
    expect(parseRoute("#/nowhere")).toEqual(HOME);
    expect(parseRoute(`#/check/${A}`)).toEqual(HOME);
  });

  it("writes back what it reads", () => {
    for (const route of [HOME, { screen: "settings" } as Route, { screen: "check", documentId: A, analysisId: B } as Route, { screen: "library", folder: "/Users/eric/Mes baux/2026" } as Route]) {
      expect(parseRoute(hashOf(route))).toEqual(route);
    }
  });
});

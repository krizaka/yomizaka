import { asLocale, routes } from "./links";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("the app's links are the web's paths", () => {
  it("follows the device's language, French first", () => {
    expect([asLocale("fr-CA"), asLocale("en-US"), asLocale("de"), asLocale(null), asLocale(undefined)]).toEqual(["fr", "en", "fr", "fr", "fr"]);
  });

  it("writes each screen's path", () => {
    expect(routes.verify("fr")).toBe("/fr/app/verifier");
    expect(routes.document("en", A)).toBe(`/en/app/documents/${A}/infos`);
    expect(routes.document("fr", A, "verifications")).toBe(`/fr/app/documents/${A}/verifications`);
    expect(routes.settings("fr")).toBe("/fr/app/settings");
  });

  it("writes the library's path down to a collection, the filter in the query", () => {
    expect(routes.library("fr")).toBe("/fr/app/bibliotheque");
    expect(routes.library("fr", A)).toBe(`/fr/app/bibliotheque/${A}`);
    expect(routes.library("fr", A, B)).toBe(`/fr/app/bibliotheque/${A}/${B}`);
    expect(routes.library("fr", A, B, [A, B])).toBe(`/fr/app/bibliotheque/${A}/${B}?tags=${A},${B}`);
    expect(routes.library("fr", undefined, B)).toBe("/fr/app/bibliotheque");
  });
});

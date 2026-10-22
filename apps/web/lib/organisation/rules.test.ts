import { describe, expect, it } from "vitest";

import { cleanName, deleteChoice, libraryPath, parseTagsParam, TAG_COLORS, tagsHref, toggleTag } from "./rules";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("names", () => {
  it("are trimmed and collapsed, and never empty or longer than 80 characters", () => {
    expect(cleanName("  Baux   2026 ")).toBe("Baux 2026");
    expect(() => cleanName("   ")).toThrow();
    expect(() => cleanName("x".repeat(81))).toThrow();
  });
});

describe("tag colours are names, mapped to Krizaka tokens by the UI", () => {
  it("lists the allowed colours", () => expect(TAG_COLORS).toEqual(["blue", "green", "amber", "red", "violet", "gray"]));
});

describe("the tags parameter is the filter's state", () => {
  it("reads ids, drops anything that is not an id and duplicates", () => {
    expect(parseTagsParam(`${A},nope,${B},${A}`)).toEqual([A, B]);
    expect(parseTagsParam(undefined)).toEqual([]);
    expect(parseTagsParam([`${A}`, `${B}`])).toEqual([A, B]);
  });
  it("toggles a tag and builds the link that keeps the rest of the path", () => {
    expect(toggleTag([A], B)).toEqual([A, B]);
    expect(toggleTag([A, B], A)).toEqual([B]);
    expect(tagsHref("/fr/app/bibliotheque/l/c", [A, B])).toBe(`/fr/app/bibliotheque/l/c?tags=${A},${B}`);
    expect(tagsHref("/fr/app/bibliotheque/l/c", [])).toBe("/fr/app/bibliotheque/l/c");
  });
});

describe("the path of a library, a collection, a folder", () => {
  it("is the URL of the view", () => {
    expect(libraryPath("fr", "l")).toBe("/fr/app/bibliotheque/l");
    expect(libraryPath("en", "l", "c")).toBe("/en/app/bibliotheque/l/c");
    expect(libraryPath("en", "l", "c", "f")).toBe("/en/app/bibliotheque/l/c/f");
  });
});

describe("what happens to the files of a deleted folder or collection", () => {
  it("must be chosen: move (up, or to a collection) or delete", () => {
    expect(deleteChoice({ files: "delete" })).toEqual({ files: "delete" });
    expect(deleteChoice({ files: "move" })).toEqual({ files: "move", to: null });
    expect(deleteChoice({ files: "move", to: A })).toEqual({ files: "move", to: A });
    expect(() => deleteChoice({})).toThrow();
    expect(() => deleteChoice({ files: "move", to: "nope" })).toThrow();
  });
});

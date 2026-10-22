import { describe, expect, it } from "vitest";

import { cleanName, deleteChoice, libraryPath } from "./rules";

const A = "11111111-1111-4111-8111-111111111111";

describe("names", () => {
  it("are trimmed and collapsed, and never empty or longer than 80 characters", () => {
    expect(cleanName("  Baux   2026 ")).toBe("Baux 2026");
    expect(() => cleanName("   ")).toThrow();
    expect(() => cleanName("x".repeat(81))).toThrow();
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

import { describe, expect, it } from "vitest";

import en from "./messages/en.json";
import fr from "./messages/fr.json";

const leaves = (value: unknown, path = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key))
    : [path];

describe("the words the apps share", () => {
  it("exist in French and in English, with the same keys", () => {
    expect(leaves(fr).sort()).toEqual(leaves(en).sort());
  });

  it("have no empty text", () => {
    const flat = (value: unknown): string[] =>
      value && typeof value === "object" ? Object.values(value).flatMap(flat) : [String(value)];
    for (const text of [...flat(fr), ...flat(en)]) expect(text.trim()).not.toBe("");
  });
});

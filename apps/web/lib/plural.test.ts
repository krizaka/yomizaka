import { describe, expect, it } from "vitest";

import { countLabel, pluralKey } from "./plural";

describe("plural keys", () => {
  it.each([
    [0, "files", "filesMany"],
    [1, "files", "filesOne"],
    [2, "files", "filesMany"],
    [1, "folders", "foldersOne"],
  ])("%i %s -> %s", (n, base, key) => expect(pluralKey(base, n)).toBe(key));

  it.each([
    [1, "1 fichier"],
    [3, "3 fichiers"],
  ])("fills the count: %i -> %s", (n, text) =>
    expect(countLabel({ filesOne: "{count} fichier", filesMany: "{count} fichiers" }, "files", n)).toBe(text),
  );

  it("says nothing for a message that is missing or is not a text", () => {
    expect(countLabel({}, "files", 2)).toBe("");
    expect(countLabel({ filesMany: { nested: true } }, "files", 2)).toBe("");
  });
});

import { describe, expect, it } from "vitest";

import { knownBookmarks, wearingAll } from "./bookmarks";

const by = { d1: [{ id: "a" }, { id: "b" }], d2: [{ id: "a" }], d3: [] };

describe("documents filtered by bookmark", () => {
  it("keeps every document when no bookmark is asked for", () => {
    expect(wearingAll(["d1", "d2", "d3"], by, [])).toEqual(["d1", "d2", "d3"]);
  });
  it("keeps the documents that wear the bookmark", () => {
    expect(wearingAll(["d1", "d2", "d3"], by, ["a"])).toEqual(["d1", "d2"]);
  });
  it("asks for all of several bookmarks, not any", () => {
    expect(wearingAll(["d1", "d2", "d3"], by, ["a", "b"])).toEqual(["d1"]);
  });
  it("treats a document with no entry as wearing none", () => {
    expect(wearingAll(["d9"], by, ["a"])).toEqual([]);
  });
  it("keeps the order of the ids it is given", () => {
    expect(wearingAll(["d2", "d1"], by, ["a"])).toEqual(["d2", "d1"]);
  });
});

describe("the bookmarks an address may name", () => {
  it("drops an id the person does not have", () => {
    expect(knownBookmarks(["a", "gone"], [{ id: "a" }, { id: "b" }])).toEqual(["a"]);
  });
});

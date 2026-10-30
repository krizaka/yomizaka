import { describe, expect, it } from "vitest";

import { dividers, knownBookmarks, wearingAll, withBookmark } from "./bookmarks";

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

describe("one tap on a row", () => {
  it("applies a bookmark once and lifts only that one", () => {
    expect(withBookmark(["a"], "b", true)).toEqual(["a", "b"]);
    expect(withBookmark(["a", "b"], "b", true)).toEqual(["a", "b"]);
    expect(withBookmark(["a", "b"], "a", false)).toEqual(["b"]);
    expect(withBookmark([], "a", false)).toEqual([]);
  });
});

describe("the bookmarks as binder dividers", () => {
  const marks = [
    { id: "a", name: "Urgent", color: "red" as const },
    { id: "b", name: "Verified", color: "green" as const },
  ];
  const input = { bookmarks: marks, ids: ["d1", "d2", "d3"], tagsByDocument: by, path: "/en/app/documents" };
  it("starts with « All » and counts the documents that wear each bookmark", () => {
    const tabs = dividers({ ...input, selected: [] });
    expect(tabs.map((t) => [t.name, t.count, t.on])).toEqual([
      [null, 3, true],
      ["Urgent", 2, false],
      ["Verified", 1, false],
    ]);
  });
  it("opens a bookmark alone through the address, and marks the one in force", () => {
    const tabs = dividers({ ...input, selected: ["b"] });
    expect(tabs.map((t) => t.href)).toEqual([
      "/en/app/documents",
      "/en/app/documents?tags=a",
      "/en/app/documents?tags=b",
    ]);
    expect(tabs.map((t) => t.on)).toEqual([false, false, true]);
  });
  it("marks no tab when several bookmarks are combined", () => {
    expect(dividers({ ...input, selected: ["a", "b"] }).some((t) => t.on)).toBe(false);
  });
  it("gives a tone with the colour, never the colour alone", () => {
    expect(dividers({ ...input, selected: [] }).map((t) => t.hue)).toEqual(["accent", "danger", "success"]);
  });
});

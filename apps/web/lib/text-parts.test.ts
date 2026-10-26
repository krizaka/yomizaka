import { describe, expect, it } from "vitest";

import { atOffsets, keyedByLabel } from "./text-parts";

describe("atOffsets", () => {
  it("gives each run the offset where it starts", () => {
    expect(atOffsets([{ text: "ab" }, { text: "cde", mark: "r1" }, { text: "f" }]).map((p) => p.at)).toEqual([0, 2, 5]);
  });
  it("keeps the other fields of a run", () => {
    expect(atOffsets([{ text: "x", mark: "m" }])).toEqual([{ text: "x", mark: "m", at: 0 }]);
  });
  it("is empty for no runs", () => expect(atOffsets([])).toEqual([]));
});

describe("keyedByLabel", () => {
  it("numbers the rows that share a label, in order", () => {
    const rows = keyedByLabel([["Date", "a"], ["Party", "b"], ["Date", "c"]] as const);
    expect(rows.map((r) => r.key)).toEqual(["Date#0", "Party#0", "Date#1"]);
    expect(rows.map((r) => r.value)).toEqual(["a", "b", "c"]);
  });
});

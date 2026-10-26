import { describe, expect, it } from "vitest";

import { costKey, mergeDocuments } from "./BatchImport";

const file = (name: string) => new File(["x"], name);

describe("the batch import's pure rules", () => {
  it("keeps the earlier documents a drop does not replace by name, and leaves the manifest out", () => {
    const merged = mergeDocuments([file("a.pdf"), file("b.pdf")], [file("b.pdf"), file("c.pdf"), file("lots.csv")]);
    expect(merged.map((f) => f.name)).toEqual(["a.pdf", "b.pdf", "c.pdf"]);
  });

  it("says what the batch costs: the plan, the credits that cover it, or a shortfall", () => {
    expect(costKey({ audits: 3, covered: true, credits: 3, pro: true })).toBe("batch.cost.pro");
    expect(costKey({ audits: 3, covered: true, credits: 3, pro: false })).toBe("batch.cost.covered");
    expect(costKey({ audits: 3, covered: false, credits: 1, pro: false })).toBe("batch.cost.short");
  });
});

import { describe, expect, it } from "vitest";

import { allTagsClause } from "./store";

describe("the ALL-tags condition", () => {
  it("binds the tag array to the placeholder it is given, literally (never read as a regex group)", () => {
    const sql = allTagsClause("$4");
    expect(sql).toContain("unnest($4::uuid[])");
    expect(sql).not.toContain("$TAGS");
  });
});

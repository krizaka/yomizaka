import { describe, expect, it } from "vitest";

import { DOCUMENT_COLUMN_PRIORITY } from "./DocumentTable";

describe("the documents table on a phone (the review's B5)", () => {
  it("keeps the title and the result on the card; kind, size and date go to the row's detail (priority 3 and up leave the card)", () => {
    expect(DOCUMENT_COLUMN_PRIORITY.title).toBe(1);
    expect(DOCUMENT_COLUMN_PRIORITY.status).toBe(1);
    for (const column of ["kind", "size", "added"] as const) expect(DOCUMENT_COLUMN_PRIORITY[column], column).toBeGreaterThanOrEqual(3);
  });
});

import { describe, expect, it } from "vitest";

import { PAGE_SIZES, pageOf, pageSizeOf, parseList, sortOf, sortParam, TABLE_DEFAULTS } from "./table-state";

const SORTABLE = ["title", "kind", "size", "added"] as const;

/** The documents table keeps its state in the address (`?q=&kind=&status=&page=&size=&sort=`): a refresh, a shared link and the back button restore it. */
describe("the table's state in the address", () => {
  it("reads a sort as `column:asc|desc`, only on a sortable column; anything else is the default", () => {
    expect(sortOf("title:asc", SORTABLE)).toEqual({ column: "title", direction: "ascending" });
    expect(sortOf("size:desc", SORTABLE)).toEqual({ column: "size", direction: "descending" });
    expect(sortOf(TABLE_DEFAULTS.sort, SORTABLE)).toEqual({ column: "added", direction: "descending" });
    for (const bad of ["", "nope", "title", "title:sideways", "status:asc", "title:asc:x", "__proto__:asc"]) expect(sortOf(bad, SORTABLE), bad).toEqual({ column: "added", direction: "descending" });
  });

  it("writes a sort back, and nothing for no sort", () => {
    expect(sortParam({ column: "title", direction: "ascending" })).toBe("title:asc");
    expect(sortParam({ column: "added", direction: "descending" })).toBe("added:desc");
    expect(sortParam(null)).toBe("none");
    expect(sortOf("none", SORTABLE)).toBeNull();
  });

  it("reads a page as a whole number from 1; a bad one is the first page", () => {
    expect(pageOf("3")).toBe(3);
    for (const bad of ["", "0", "-2", "1.5", "abc", "99999999999"]) expect(pageOf(bad), bad).toBe(1);
  });

  it("reads a page size from the offered sizes only", () => {
    expect(PAGE_SIZES).toEqual([10, 25, 50]);
    expect(pageSizeOf("50")).toBe(50);
    for (const bad of ["", "7", "1000", "abc"]) expect(pageSizeOf(bad), bad).toBe(25);
  });

  it("reads a list of values from a comma-separated parameter, keeping only the allowed ones, once each", () => {
    expect(parseList("lease,invoice", ["lease", "invoice", "contract"])).toEqual(["lease", "invoice"]);
    expect(parseList("lease,lease,hacker,", ["lease", "invoice"])).toEqual(["lease"]);
    expect(parseList("", ["lease"])).toEqual([]);
  });
});

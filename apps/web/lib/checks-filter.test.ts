import { describe, expect, it } from "vitest";

import type { CheckSummary } from "./checks";
import { type CheckFilters, checkFiltersActive, checkFiltersOf, filterChecks, NO_CHECK_FILTERS, writeChecksFilters } from "./checks-filter";

const check = (n: number, patch: Partial<CheckSummary>): CheckSummary => ({ id: `a${n}`, documentId: `d${n}`, title: `Document ${n}`, kind: "lease", studio: "compliance-check", result: "checked", runId: `run_${n}`, at: "2026-10-21T12:00:00.000Z", ...patch });

const FIXTURES: CheckSummary[] = [
  check(1, { title: "Bail — 4½ Villeray", kind: "lease", result: "attention" }),
  check(2, { title: "Facture Plomberie Roy", kind: "invoice", result: "checked" }),
  check(3, { title: "Bail — Rosemont, logement 3", kind: "lease", result: "checked" }),
  check(4, { title: "Contrat de travail Léa", kind: "contract", result: "failed" }),
];
const ids = (rows: CheckSummary[]) => rows.map((r) => r.id);
const NONE: CheckFilters = NO_CHECK_FILTERS;

describe("the Vérifications filters, read from and written to the address", () => {
  it("reads the result and the kind, drops unknown values, and trims the search", () => {
    const f = checkFiltersOf(new URLSearchParams("result=attention&result=bogus&kind=lease,invoice,nope&q=%20Bail%20"));
    expect(f.result).toEqual(["attention"]);
    expect(f.kind).toEqual(["lease", "invoice"]);
    expect(f.q).toBe("Bail");
  });

  it("with nothing in the address, every filter is empty", () => {
    expect(checkFiltersOf(new URLSearchParams(""))).toEqual(NONE);
    expect(checkFiltersActive(checkFiltersOf(new URLSearchParams("")))).toBe(false);
    expect(checkFiltersActive(checkFiltersOf(new URLSearchParams("q=x")))).toBe(true);
  });

  it("writes the filters back and keeps the other parameters (the tab); empty filters leave the address", () => {
    const base = new URLSearchParams("tab=lots");
    expect(writeChecksFilters(base, { result: ["attention", "failed"], kind: [], q: "bail" }).toString()).toBe("tab=lots&result=attention%2Cfailed&q=bail");
    expect(writeChecksFilters(new URLSearchParams("result=attention&q=x"), NONE).toString()).toBe("");
  });
});

describe("filterChecks", () => {
  it("keeps every check with no filter in force, in the order given", () => {
    expect(ids(filterChecks(FIXTURES, NONE))).toEqual(["a1", "a2", "a3", "a4"]);
  });

  it("filters by result and by kind, and both together", () => {
    expect(ids(filterChecks(FIXTURES, { ...NONE, result: ["checked"] }))).toEqual(["a2", "a3"]);
    expect(ids(filterChecks(FIXTURES, { ...NONE, kind: ["lease"] }))).toEqual(["a1", "a3"]);
    expect(ids(filterChecks(FIXTURES, { ...NONE, kind: ["lease"], result: ["checked"] }))).toEqual(["a3"]);
  });

  it("searches the title, ignoring case and accents", () => {
    expect(ids(filterChecks(FIXTURES, { ...NONE, q: "BAIL" }))).toEqual(["a1", "a3"]);
    expect(ids(filterChecks(FIXTURES, { ...NONE, q: "lea" }))).toEqual(["a4"]);
    expect(ids(filterChecks(FIXTURES, { ...NONE, q: "villeray" }))).toEqual(["a1"]);
  });

  it("gives no row when nothing matches", () => {
    expect(filterChecks(FIXTURES, { ...NONE, result: ["analysing"] })).toEqual([]);
  });
});

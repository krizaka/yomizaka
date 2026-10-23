import { describe, expect, it } from "vitest";

import { applyCheckFilters, countByPeriod, countByValue, FILTER_HISTORY, hasCheckFilters, NO_CHECK_FILTERS, periodStart, readCheckFilters, reconcileDraft, writeCheckFilters } from "./check-filters";
import type { CheckSummary } from "./checks";

const NOW = new Date("2026-10-30T12:00:00.000Z");
const check = (n: number, result: CheckSummary["result"], patch: Partial<CheckSummary> = {}): CheckSummary => ({ id: `a${n}`, documentId: `d${n}`, title: `Bail — Rosemont, logement ${n}`, kind: "lease", studio: "compliance-check", result, runId: `run_${n}`, at: `2026-10-2${n}T12:00:00.000Z`, ...patch });
const ROWS = [check(1, "checked"), check(2, "attention"), check(3, "attention", { title: "Facture Plomberie Roy", kind: "invoice" }), check(4, "failed", { title: "Contrat d'entretien — Dépôt", kind: "contract" }), check(5, "analysing"), check(6, "checked", { at: "2026-01-05T12:00:00.000Z" }), check(7, "checked", { at: "2025-12-28T12:00:00.000Z" })];

describe("the filters of the Vérifications list live in the address (the UX review's Y6)", () => {
  it("reads them from the address — repeated or comma-separated values, unknown ones dropped — and writes them back, the tab kept", () => {
    expect(readCheckFilters("?q=bail+rosemont&result=attention,failed&kind=lease&period=30d")).toEqual({ q: "bail rosemont", result: ["attention", "failed"], kind: ["lease"], period: "30d" });
    expect(readCheckFilters("result=attention&result=stored&result=nope&kind=car&period=yesterday")).toEqual({ q: "", result: ["attention"], kind: [], period: null });
    expect(readCheckFilters("")).toEqual(NO_CHECK_FILTERS);
    expect(hasCheckFilters(NO_CHECK_FILTERS)).toBe(false);
    expect(hasCheckFilters({ ...NO_CHECK_FILTERS, period: "7d" })).toBe(true);
    const written = writeCheckFilters(new URLSearchParams("tab=checks&q=old"), { q: " dépôt ", result: ["failed", "attention"], kind: [], period: "year" });
    expect(written.get("tab")).toBe("checks");
    expect(written.get("q")).toBe("dépôt");
    expect(written.get("result")).toBe("failed,attention");
    expect(written.has("kind")).toBe(false);
    expect(written.get("period")).toBe("year");
    expect(writeCheckFilters(new URLSearchParams("q=x&result=failed"), NO_CHECK_FILTERS).toString()).toBe("");
  });

  it("a period starts 7 or 30 days of instants before now, or on the first of the year in the console's zone — the same on a UTC server and in a Montréal browser", () => {
    expect(periodStart("7d", NOW).toISOString()).toBe("2026-10-23T12:00:00.000Z");
    expect(periodStart("30d", NOW).toISOString()).toBe("2026-09-30T12:00:00.000Z");
    expect(periodStart("year", NOW).toISOString()).toBe("2026-01-01T05:00:00.000Z");
    expect(periodStart("year", new Date("2027-01-01T03:00:00.000Z")).toISOString()).toBe("2026-01-01T05:00:00.000Z");
    expect(periodStart("year", NOW, "UTC").toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(periodStart("year", NOW, "Asia/Tokyo").toISOString()).toBe("2025-12-31T15:00:00.000Z");
  });

  it("the search field's draft follows the address without losing an edit in flight; a choice is a history step, typing is not", () => {
    const typed = { draft: "ba", pending: "ba", seen: "" };
    expect(reconcileDraft(typed, "")).toBe(typed);
    expect(reconcileDraft(typed, "ba")).toEqual({ draft: null, pending: "ba", seen: "ba" });
    expect(reconcileDraft({ draft: "bai", pending: "ba", seen: "" }, "ba")).toEqual({ draft: "bai", pending: "ba", seen: "ba" });
    expect(reconcileDraft({ draft: "bai", pending: "ba", seen: "ba" }, "")).toEqual({ draft: null, pending: "", seen: "" });
    expect(reconcileDraft({ draft: null, pending: "", seen: "" }, "x")).toEqual({ draft: null, pending: "x", seen: "x" });
    expect(FILTER_HISTORY).toEqual({ chosen: "push", typed: "replace" });
  });

  it("keeps the rows whose title holds every word (accents and case aside), whose result, kind and period match", () => {
    const ids = (f: Partial<typeof NO_CHECK_FILTERS>) => applyCheckFilters(ROWS, { ...NO_CHECK_FILTERS, ...f }, NOW).map((c) => c.id);
    expect(ids({})).toHaveLength(7);
    expect(ids({ q: "DEPOT" })).toEqual(["a4"]);
    expect(ids({ q: "bail 2" })).toEqual(["a2"]);
    expect(ids({ result: ["attention"] })).toEqual(["a2", "a3"]);
    expect(ids({ kind: ["invoice", "contract"] })).toEqual(["a3", "a4"]);
    expect(ids({ period: "7d" })).toEqual(["a3", "a4", "a5"]);
    expect(ids({ period: "30d" })).toEqual(["a1", "a2", "a3", "a4", "a5"]);
    expect(ids({ period: "year" })).toEqual(["a1", "a2", "a3", "a4", "a5", "a6"]);
    expect(ids({ result: ["attention"], kind: ["lease"], period: "30d" })).toEqual(["a2"]);
    expect(ids({ q: "nothing here" })).toEqual([]);
  });

  it("counts what each option would give, the other filters in force", () => {
    expect(countByValue(ROWS, NO_CHECK_FILTERS, "result", NOW)).toEqual({ checked: 3, attention: 2, failed: 1, analysing: 1 });
    expect(countByValue(ROWS, { ...NO_CHECK_FILTERS, kind: ["lease"] }, "result", NOW)).toEqual({ checked: 3, attention: 1, analysing: 1 });
    expect(countByValue(ROWS, { ...NO_CHECK_FILTERS, kind: ["lease"] }, "kind", NOW)).toEqual({ lease: 5, invoice: 1, contract: 1 });
    expect(countByPeriod(ROWS, NO_CHECK_FILTERS, NOW)).toEqual({ "7d": 3, "30d": 5, year: 6 });
    expect(countByPeriod(ROWS, { ...NO_CHECK_FILTERS, result: ["checked"] }, NOW)).toEqual({ "7d": 0, "30d": 1, year: 2 });
  });
});

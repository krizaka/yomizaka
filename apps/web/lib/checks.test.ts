import { describe, expect, it } from "vitest";

import { type CheckSummary, runningChecks } from "./checks";

const check = (n: number, result: CheckSummary["result"]): CheckSummary => ({ id: `a${n}`, documentId: `d${n}`, title: `Bail ${n}`, kind: "lease", studio: "compliance-check", result, runId: null, at: "2026-10-23T12:00:00.000Z" });

describe("the checks still running", () => {
  it("are the ones the page refreshes from Orazaka before listing", () => {
    expect(runningChecks([check(1, "analysing"), check(2, "checked"), check(3, "attention"), check(4, "analysing"), check(5, "failed")]).map((c) => c.id)).toEqual(["a1", "a4"]);
    expect(runningChecks([])).toEqual([]);
  });
});

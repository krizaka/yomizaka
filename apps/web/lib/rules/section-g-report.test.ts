import type { ComplianceReport } from "@yomizaka/core";
import { describe, expect, it } from "vitest";

import { LEASE_RULESET, withSectionG } from "./section-g-report";

const settings = { get: async (key: string) => ({ "tal.rate.year": 2026, "tal.rate.basisPoints": 310, "tal.rate.sourceUrl": "https://www.quebec.ca/nouvelles/actualites/details/le-calcul-de-lajustement-des-loyers-en-2026-68053", "tal.rate.enteredOn": "2026-10-29" })[key] };
const report = (facts: ComplianceReport["facts"], rulesetId = LEASE_RULESET): ComplianceReport => ({
  rulesetId, rulesetVersion: "2024-02-21", jurisdiction: "QC", asOf: "2026-10-15", summary: { byVerdict: { PASS: 1 }, blockingFailures: 0, rulesEvaluated: 1 },
  findings: [{ ruleId: "QC-LEASE-003", severity: "BLOCKING", verdict: "PASS", explanation: "Le loyer est chiffré au bail." }], facts,
});

describe("withSectionG", () => {
  it("adds a failing TS-G-001 when the rent is over the TAL rate from the lowest rent, and counts it", async () => {
    const out = await withSectionG(report({ rentCents: { status: "found", cents: 99_000 }, lowestRentCents: { status: "found", cents: 92_500 } }), settings);
    const f = out.findings.find((x) => x.ruleId === "TS-G-001");
    expect(f).toMatchObject({ verdict: "FAIL", severity: "MAJOR", method: "DETERMINISTIC" });
    expect(f?.explanation).toContain("1950");
    expect(out.summary).toMatchObject({ byVerdict: { PASS: 1, FAIL: 1 }, rulesEvaluated: 2, blockingFailures: 0 });
  });
  it("a blank Section G is a finding; a rent within the rate passes", async () => {
    expect((await withSectionG(report({ rentCents: { status: "found", cents: 95_000 }, lowestRentCents: { status: "blank" } }), settings)).findings.at(-1)).toMatchObject({ ruleId: "TS-G-001", verdict: "FAIL" });
    expect((await withSectionG(report({ rentCents: { status: "found", cents: 95_000 }, lowestRentCents: { status: "found", cents: 92_500 } }), settings)).findings.at(-1)).toMatchObject({ ruleId: "TS-G-001", verdict: "PASS" });
  });
  it("returns the report untouched without facts, for another ruleset, or when it already holds the finding", async () => {
    const bare = report(undefined);
    expect(await withSectionG(bare, settings)).toBe(bare);
    const other = report({ rentCents: { status: "found", cents: 95_000 } }, "qc-invoice");
    expect(await withSectionG(other, settings)).toBe(other);
    const once = await withSectionG(report({ rentCents: { status: "found", cents: 95_000 }, lowestRentCents: { status: "blank" } }), settings);
    expect(await withSectionG(once, settings)).toBe(once);
  });
  it("makes no claim when the TAL rate of the year is not entered", async () => {
    const none = { get: async (k: string) => (k === "tal.rate.basisPoints" ? 0 : k === "tal.rate.year" ? 2031 : "") };
    const r = report({ rentCents: { status: "found", cents: 99_000 }, lowestRentCents: { status: "found", cents: 92_500 } });
    expect((await withSectionG({ ...r, asOf: "2031-01-01" }, none)).findings).toHaveLength(1);
  });
});

describe("withSectionG: the deadline and the facts to take to the TAL", () => {
  const over = { rentCents: { status: "found", cents: 99_000 }, lowestRentCents: { status: "found", cents: 92_500 } } as const;
  const dates = { concludedOn: { status: "found", date: "2026-06-15" }, startsOn: { status: "found", date: "2026-07-01" }, noticeGiven: { status: "found", flag: false } } as const;

  it("follows a finding with the basis of the deadline, its last day and the figures, in both languages", async () => {
    const f = (await withSectionG(report({ ...over, ...dates }), settings)).findings.at(-1)!;
    expect(f.explanation).toContain("dans les deux mois du début du bail");
    expect(f.explanation).toMatch(/1(er)? septembre 2026/);
    expect(f.explanationEn).toContain("within two months of the start of the lease");
    expect(f.explanationEn).toContain("September 1, 2026");
    expect(f.explanationEn).toContain("Facts to take to the TAL");
    expect(f.explanationEn).toContain("Yomizaka files nothing");
    expect(f.explanationEn).toContain("not legal advice");
  });

  it("keeps the figures without a deadline when the dates are not read, and adds nothing to a pass", async () => {
    const f = (await withSectionG(report(over), settings)).findings.at(-1)!;
    expect(f.explanationEn).toContain("Facts to take to the TAL");
    expect(f.explanationEn).not.toContain("last day to ask");
    const ok = (await withSectionG(report({ rentCents: { status: "found", cents: 95_000 }, lowestRentCents: { status: "found", cents: 92_500 }, ...dates }), settings)).findings.at(-1)!;
    expect(ok.explanationEn).not.toContain("Facts to take");
  });
});

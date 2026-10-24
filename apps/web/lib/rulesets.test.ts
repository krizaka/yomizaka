import { describe, expect, it } from "vitest";

import { isCheckKind, rulesetFor, versionInForce } from "./rulesets";

describe("the ruleset of each kind (ADR-089: the kind selects the rules)", () => {
  it("a Québec lease is checked against its ruleset, in the version in force on the check's date", () => {
    expect(rulesetFor("lease", "QC", "2026-10-24")).toEqual({ verified: true, ruleset: "qc-residential-lease/2026-10-24" });
    expect(rulesetFor("lease", "QC", "2026-05-01")).toEqual({ verified: true, ruleset: "qc-residential-lease/2024-02-21" });
  });

  it("a France or Wallonia lease keeps its jurisdiction's own ruleset, named by no request", () => {
    expect(rulesetFor("lease", "FR", "2026-10-24")).toEqual({ verified: true, ruleset: null });
    expect(rulesetFor("lease", "BE-WAL", "2026-10-24")).toEqual({ verified: true, ruleset: null });
  });

  it("a visit notice is checked against Québec's visit-notice ruleset, never the lease's", () => {
    expect(rulesetFor("visit-notice", "QC", "2026-10-24")).toEqual({ verified: true, ruleset: "qc-visit-notice" });
  });

  it("an état des lieux is checked against Québec's premises-condition ruleset", () => {
    expect(rulesetFor("premises-condition", "QC", "2026-10-24")).toEqual({ verified: true, ruleset: "qc-premises-condition" });
  });

  it("an invoice and a contract keep Québec's named rulesets, whatever jurisdiction was asked", () => {
    expect(rulesetFor("invoice", "FR", "2026-10-24")).toEqual({ verified: true, ruleset: "qc-invoice" });
    expect(rulesetFor("contract", "QC", "2026-10-24")).toEqual({ verified: true, ruleset: "qc-service-contract" });
  });
});

describe("the date picks the version in force", () => {
  const versions = [
    { effectiveFrom: null, ref: "old" },
    { effectiveFrom: "2026-10-24", ref: "new" },
  ];

  it("the version that has come into force by the date, the day it comes into force included", () => {
    expect(versionInForce(versions, "2026-10-23")?.ref).toBe("old");
    expect(versionInForce(versions, "2026-10-24")?.ref).toBe("new");
    expect(versionInForce(versions, "2030-01-01")?.ref).toBe("new");
  });

  it("no version is in force before the first one comes into force: the kind is not verified for that date", () => {
    expect(versionInForce([{ effectiveFrom: "2026-10-24", ref: "new" }], "2026-10-23")).toBeNull();
    expect(rulesetFor("visit-notice", "QC", "2026-10-23")).toEqual({ verified: false });
  });
});

describe("a kind with no ruleset in force says so (never the lease's rules)", () => {
  it("the declared kind « other » is not a checkable kind, so it has no ruleset", () => {
    expect(isCheckKind("other")).toBe(false);
    expect(isCheckKind("visit-notice")).toBe(true);
  });

  it("a Québec kind is Québec's whatever jurisdiction is asked: the buildings are in Québec", () => {
    expect(rulesetFor("visit-notice", "FR", "2026-10-24")).toEqual({ verified: true, ruleset: "qc-visit-notice" });
  });
});

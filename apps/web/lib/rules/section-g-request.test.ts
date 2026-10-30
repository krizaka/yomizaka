import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import type { SectionGResult } from "./section-g";
import type { SectionGDeadline } from "./section-g-deadline";
import { sectionGRequestSummary } from "./section-g-request";

const source = { url: "https://example.test", enteredOn: null, year: 2026 };
const base = {
  ruleId: "TS-G-001" as const,
  citations: [] as string[],
  recourse: { citation: "C.c.Q., art. 1950", authority: "TAL" as const },
  source,
};
const over: SectionGResult = {
  ...base,
  status: "finding",
  code: "over-rate",
  figures: { previousRentCents: 100_000, newRentCents: 110_000, maxRentCents: 103_100, excessCents: 6_900 },
};
const blank: SectionGResult = {
  ...base,
  status: "finding",
  code: "previous-blank",
  figures: { newRentCents: 110_000 },
};
const open: SectionGDeadline = {
  state: "open",
  basis: "ten-days",
  lastDay: "2026-07-11",
  daysLeft: 4,
  citation: "C.c.Q., art. 1950",
  sourceUrl: "https://www.tal.gouv.qc.ca/fr/signature-d-un-bail/avis-au-nouveau-locataire" as const,
};
const noDeadline: SectionGDeadline = { ...open, state: "no-claim", basis: null, lastDay: null, daysLeft: null };

describe("the facts for a request to the TAL (slice 5 of #104)", () => {
  it("lays out the figures of an over-rate finding, then the deadline, in a stable order", () => {
    const r = sectionGRequestSummary(over, open);
    expect(r.status).toBe("ready");
    expect(r.citation).toBe("C.c.Q., art. 1950");
    expect(r.lines.map((l) => l.key)).toEqual(["rentNew", "rentPrevious", "rentMax", "excess", "deadline"]);
  });

  it("says a blank Section G as such, with no invented previous rent", () => {
    expect(sectionGRequestSummary(blank, noDeadline).lines.map((l) => l.key)).toEqual(["rentNew", "previousBlank"]);
  });

  it("gives no summary without a finding or without the recourse", () => {
    expect(sectionGRequestSummary({ ...over, status: "ok", recourse: null }, open)).toEqual({
      status: "no-claim",
      citation: null,
      lines: [],
    });
    expect(sectionGRequestSummary({ ...over, status: "no-claim", recourse: null }, open).status).toBe("no-claim");
  });

  it("has an EN and FR message for every line, with the same placeholders, and no verdict", () => {
    for (const key of [
      "rentNew",
      "rentPrevious",
      "previousBlank",
      "previousAltered",
      "rentMax",
      "excess",
      "deadline",
    ] as const) {
      const e = en.sectionGRequest[key];
      const f = fr.sectionGRequest[key];
      expect(e && f, key).toBeTruthy();
      expect([...e.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()).toEqual(
        [...f.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
      );
      expect(e).not.toMatch(/illegal|guilty|fraud|you will win/i);
    }
    expect(en.sectionGRequest.title && fr.sectionGRequest.title).toBeTruthy();
  });
});

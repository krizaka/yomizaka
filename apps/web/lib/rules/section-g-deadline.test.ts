import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { addMonthsIso, SECTION_G_DEADLINE_SOURCE,sectionGDeadline } from "./section-g-deadline";

describe("deadline to ask the TAL to fix the rent", () => {
  it("is 10 days after the lease was concluded when the notice was given", () => {
    expect(sectionGDeadline({ concludedOn: "2027-06-20", startsOn: "2027-07-01", notice: { kind: "given" }, today: "2027-06-25" })).toMatchObject({
      lastDay: "2027-06-30", basis: "ten-days", state: "open", daysLeft: 5,
    });
  });

  it("is two months from the start of the lease when no notice was given", () => {
    expect(sectionGDeadline({ concludedOn: "2027-06-20", startsOn: "2027-07-01", notice: { kind: "not-given" }, today: "2027-08-01" })).toMatchObject({
      lastDay: "2027-09-01", basis: "two-months-from-start", state: "open",
    });
  });

  it("is two months from the day the tenant learned the notice was false", () => {
    expect(sectionGDeadline({ concludedOn: "2027-06-20", startsOn: "2027-07-01", notice: { kind: "false", knownOn: "2027-11-30" }, today: "2027-12-01" })).toMatchObject({
      lastDay: "2028-01-30", basis: "two-months-from-knowledge",
    });
  });

  it("says today is the last day, and says closed after it", () => {
    const base = { concludedOn: "2027-06-20", startsOn: "2027-07-01", notice: { kind: "given" } } as const;
    expect(sectionGDeadline({ ...base, today: "2027-06-30" })).toMatchObject({ state: "last-day", daysLeft: 0 });
    expect(sectionGDeadline({ ...base, today: "2027-07-01" })).toMatchObject({ state: "closed" });
  });

  it("clamps a month end (31 December + 2 months)", () => {
    expect(addMonthsIso("2027-12-31", 2)).toBe("2028-02-29");
    expect(addMonthsIso("2027-01-31", 1)).toBe("2027-02-28");
  });

  it("counts across a year end and a leap day", () => {
    const given = { startsOn: "2028-01-01", notice: { kind: "given" } } as const;
    expect(sectionGDeadline({ ...given, concludedOn: "2027-12-25", today: "2027-12-26" })).toMatchObject({ lastDay: "2028-01-04", daysLeft: 9 });
    expect(sectionGDeadline({ ...given, concludedOn: "2028-02-25", today: "2028-02-26" })).toMatchObject({ lastDay: "2028-03-06" });
  });

  it("makes no claim from an unreadable date", () => {
    expect(sectionGDeadline({ concludedOn: "soon", startsOn: "2027-07-01", notice: { kind: "given" }, today: "2027-06-25" })).toMatchObject({ state: "no-claim", lastDay: null });
    expect(sectionGDeadline({ concludedOn: "2027-06-20", startsOn: "2027-07-01", notice: { kind: "false", knownOn: "" }, today: "2027-06-25" })).toMatchObject({ state: "no-claim" });
  });

  it("cites the TAL page and the article, and every message exists in both languages without a verdict word", () => {
    expect(SECTION_G_DEADLINE_SOURCE).toMatchObject({ citation: "C.c.Q., art. 1950", url: expect.stringContaining("tal.gouv.qc.ca") });
    for (const dict of [en, fr] as const) {
      const m = dict.sectionGDeadline as Record<string, string>;
      for (const k of ["ten-days", "two-months-from-start", "two-months-from-knowledge", "open", "last-day", "closed", "no-claim"]) expect(m[k], k).toBeTruthy();
      expect(Object.values(m).join(" ")).not.toMatch(/\b(illegal|illégal|unlawful|abusive|fraud)/i);
    }
  });
});

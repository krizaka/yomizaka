import { describe, expect, it } from "vitest";

import { closingNoteOf } from "./for-analysis";
import { LANGS, NOTE_KIND } from "./vocabulary";

const report = {
  rulesetId: "qc-residential-lease",
  rulesetVersion: "2024-02-21",
  jurisdiction: "QC",
  asOf: "2026-10-22",
  findings: [
    {
      ruleId: "QC-LEASE-004",
      title: "Dépôt de garantie interdit",
      severity: "BLOCKING",
      verdict: "FAIL",
      explanation: "Le bail exige un dépôt.",
    },
  ],
};

describe("the closing note an app shows", () => {
  it("is nothing while the analysis has no report", () => {
    expect(closingNoteOf({ report: null }, "fr")).toBeNull();
  });

  it.each(LANGS)("is the note of the report, in %s", (lang) => {
    const note = closingNoteOf({ report }, lang);
    expect(note).toMatchObject({ lang, kind: NOTE_KIND.compliance });
    expect(note?.next.items[0]).toMatchObject({ important: true });
  });
});

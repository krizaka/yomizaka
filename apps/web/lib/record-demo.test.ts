import { complianceReport } from "@yomizaka/core";
import { describe, expect, it } from "vitest";

// The recorder of the public page's real run (scripts/record-demo.mjs): what it writes must be what the page reads.
import { demoModule, SAMPLE_LEASE } from "../scripts/record-demo.mjs";

describe("the demo-run recorder", () => {
  it("writes the run id, the Studio version and the report exactly as Orazaka returned them", () => {
    const report = { rulesetId: "fr-residential-lease", rulesetVersion: "2026-07-01", jurisdiction: "FR", asOf: "2026-10-14", findings: [{ ruleId: "FR-LEASE-005", severity: "BLOCKING", verdict: "FAIL", explanation: "Excède un mois." }] };
    const source: string = demoModule({ id: "8f6b1c2e-1d2c-4b8a-9a55-0d1e2f3a4b5c", blueprintVersion: "1.1.1", finishedAt: "2026-10-14T23:59:00Z" }, report, SAMPLE_LEASE);
    expect(source).toContain('"runId": "8f6b1c2e-1d2c-4b8a-9a55-0d1e2f3a4b5c"');
    expect(source).toContain('"blueprintVersion": "1.1.1"');
    const json = source.slice(source.indexOf("= {") + 2, source.lastIndexOf(";"));
    const data = JSON.parse(json);
    expect(complianceReport.parse(data.report)).toEqual(report);
    expect(data.document).toBe(SAMPLE_LEASE);
  });

  it("sends a Québec lease the rules can judge: a deposit, postdated cheques, a clause against children, the parties", () => {
    for (const words of ["dépôt de sécurité de 1 450 $", "chèques postdatés", "enfants", "locateur", "locataire", "Montréal"]) expect(SAMPLE_LEASE).toContain(words);
  });
});

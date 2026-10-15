import { describe, expect, it } from "vitest";

import { issueReport, sha256 } from "./report";
import { buildPayload } from "./report";
import { reportLabels } from "./report-labels";
import { signingKey } from "./report-signer";
import { verifyRequest } from "./verify";

// NODE_ENV is "test": the public development key signs (a production server refuses to start without the real one).
const doc = { sha256: sha256("lease bytes"), filename: "bail.pdf", title: "Bail", sizeBytes: 11, pages: 1 };
const analysis = {
  id: "a1",
  studio: "compliance-check" as const,
  status: "succeeded" as const,
  runId: "run-123",
  blueprintVersion: "1.0.0",
  inputs: {},
  report: { rulesetId: "qc", rulesetVersion: "1", jurisdiction: "QC", asOf: "2026-10-14", findings: [{ ruleId: "r1", severity: "BLOCKING", verdict: "FAIL", explanation: "x", evidenceSpan: { quote: "q" } }] },
  error: null,
  createdAt: "2026-10-14T10:00:00.000Z",
  finishedAt: "2026-10-14T10:00:05.000Z",
};
const issued = issueReport(buildPayload(doc, analysis, "en"), reportLabels("en"), signingKey());

describe("POST /api/verify (the request behind the public page)", () => {
  it("verifies an uploaded report, and the document when given", async () => {
    const form = new FormData();
    form.set("report", new File([issued.html], "report.html", { type: "text/html" }));
    form.set("document", new File(["lease bytes"], "bail.pdf"));
    expect(await verifyRequest(form)).toMatchObject({ ok: true, documentMatch: true, fileSha256: issued.fileSha256 });
  });

  it("verifies pasted text", async () => {
    const form = new FormData();
    form.set("reportText", issued.html);
    expect(await verifyRequest(form)).toMatchObject({ ok: true, documentMatch: null });
  });

  it("fails a tampered upload and says so in the answer", async () => {
    const form = new FormData();
    form.set("report", new File([issued.html.replace("run-123", "run-999")], "report.html"));
    expect(await verifyRequest(form)).toMatchObject({ ok: false, reason: "ALTERED" });
  });

  it("refuses an empty request and oversized files without reading them as reports", async () => {
    await expect(verifyRequest(new FormData())).rejects.toMatchObject({ status: 400 });
    const big = new FormData();
    big.set("report", new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.html"));
    await expect(verifyRequest(big)).rejects.toMatchObject({ status: 413 });
  });
});

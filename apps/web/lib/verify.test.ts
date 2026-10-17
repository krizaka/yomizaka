import { describe, expect, it } from "vitest";

import { issueReport, sha256 } from "./report";
import { buildPayload } from "./report";
import { verifyReport } from "./report";
import { reportLabels } from "./report-labels";
import { signingKey } from "./report-signer";
import { readVerifyForm } from "./verify";

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

describe("readVerifyForm (the request behind the members-only page)", () => {
  it("reads an uploaded report, and the document when given", async () => {
    const form = new FormData();
    form.set("report", new File([issued.html], "report.html", { type: "text/html" }));
    form.set("document", new File(["lease bytes"], "bail.pdf"));
    const { text, document } = await readVerifyForm(form);
    expect(verifyReport(text, signingKey(), document)).toMatchObject({ ok: true, documentMatch: true, fileSha256: issued.fileSha256 });
  });

  it("reads pasted text", async () => {
    const form = new FormData();
    form.set("reportText", issued.html);
    const { text, document } = await readVerifyForm(form);
    expect(verifyReport(text, signingKey(), document)).toMatchObject({ ok: true, documentMatch: null });
  });

  it("a tampered upload fails the signature check and says so", async () => {
    const form = new FormData();
    form.set("report", new File([issued.html.replace("run-123", "run-999")], "report.html"));
    const { text } = await readVerifyForm(form);
    expect(verifyReport(text, signingKey())).toMatchObject({ ok: false, reason: "ALTERED" });
  });

  it("refuses an empty request and oversized files", async () => {
    await expect(readVerifyForm(new FormData())).rejects.toMatchObject({ status: 400 });
    const big = new FormData();
    big.set("report", new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.html"));
    await expect(readVerifyForm(big)).rejects.toMatchObject({ status: 413 });
  });

  it("accepts only an .html report as a file (415), however it is named otherwise", async () => {
    const form = new FormData();
    form.set("report", new File([issued.html], "report.pdf", { type: "application/pdf" }));
    await expect(readVerifyForm(form)).rejects.toMatchObject({ status: 415 });
  });
});

import { describe, expect, it } from "vitest";

import { buildPayload, issueReport, sha256, verifyReport } from "../report";
import { reportLabels } from "../report-labels";
import { issuePdf, verifyPdf } from "../report-pdf";
import { signingKey } from "../report-signer";
import { LANGS } from "./vocabulary";

const doc = { sha256: sha256("lease bytes"), filename: "bail.pdf", title: "Bail (fictif)", sizeBytes: 11, pages: 1 };
const analysis = {
  id: "a1",
  studio: "compliance-check" as const,
  status: "succeeded" as const,
  runId: "run-123",
  blueprintVersion: "1.2.0",
  inputs: {},
  report: {
    rulesetId: "qc-residential-lease",
    rulesetVersion: "2024-02-21",
    rulesetRevision: 2,
    jurisdiction: "QC",
    asOf: "2026-10-22",
    findings: [
      {
        ruleId: "QC-LEASE-004",
        title: "Dépôt de garantie interdit",
        severity: "BLOCKING",
        verdict: "FAIL",
        explanation: "Le bail exige un dépôt.",
        evidenceSpan: { quote: "dépôt de sécurité de 1 450 $" },
      },
      {
        ruleId: "QC-LEASE-003",
        title: "Montant du loyer",
        severity: "BLOCKING",
        verdict: "PASS",
        explanation: "Le loyer est chiffré.",
      },
    ],
  },
  error: null,
  createdAt: "2026-10-22T10:00:00.000Z",
  finishedAt: "2026-10-22T10:00:05.000Z",
};

describe.each(LANGS)("the closing note travels with the signed report (%s)", (lang) => {
  const payload = buildPayload(doc, analysis, lang);
  const heading = lang === "fr" ? "Ce que nous avons vérifié" : "What we checked";

  it("is part of the signed payload", () => {
    expect(payload.note?.title).toBe(heading);
    expect(payload.note?.next.items[0]).toMatchObject({ important: true });
  });

  it("is printed in the signed HTML report and still verifies; editing it is detected", () => {
    const issued = issueReport(payload, reportLabels(lang), signingKey());
    expect(issued.html).toContain(heading);
    expect(issued.html).toContain(lang === "fr" ? "retirer la clause de dépôt" : "remove the deposit clause");
    expect(verifyReport(issued.html, signingKey())).toMatchObject({ ok: true });
    const edited = issued.html.replace(
      lang === "fr" ? "retirer la clause de dépôt" : "remove the deposit clause",
      "ignorer la clause",
    );
    expect(verifyReport(edited, signingKey())).toMatchObject({ ok: false, reason: "ALTERED" });
  });

  it("is printed in the signed PDF and still verifies", async () => {
    const issued = await issuePdf(payload, reportLabels(lang), signingKey());
    const { extractText, getDocumentProxy } = await import("unpdf");
    const text = (
      (await extractText(await getDocumentProxy(new Uint8Array(issued.bytes)), { mergePages: true })).text as string
    ).replace(/\s+/g, " ");
    expect(text).toContain(heading);
    expect(text).toContain(lang === "fr" ? "C'est vous qui décidez" : "You decide");
    expect(await verifyPdf(issued.bytes, signingKey())).toMatchObject({ ok: true });
  });

  it("a document made from photos says so in the signed note and in the payload, and the signature still verifies", () => {
    const origin = {
      software: "Adobe Photoshop 25.0",
      device: "Apple iPhone 15",
      takenAt: null,
      modifiedAt: null,
      hadGps: true,
    };
    const photo = buildPayload(
      {
        ...doc,
        textSource: { kind: "ocr", engine: "tesseract", confidence: 74, photos: 2, lowConfidence: false, origin },
      },
      analysis,
      lang,
    );
    expect(photo.document.textSource).toMatchObject({ kind: "ocr", confidence: 74, photos: 2 });
    expect(photo.note?.how.sentences.join(" ")).toContain("74");
    expect(buildPayload(doc, analysis, lang).document.textSource).toBeUndefined();
    const issued = issueReport(photo, reportLabels(lang), signingKey());
    expect(issued.html).toContain("74");
    expect(verifyReport(issued.html, signingKey())).toMatchObject({ ok: true });
  });

  it("a report issued before the note existed (no note in its payload) still verifies", () => {
    const old = { ...payload, note: undefined };
    expect(verifyReport(issueReport(old, reportLabels(lang), signingKey()).html, signingKey())).toMatchObject({
      ok: true,
    });
  });
});

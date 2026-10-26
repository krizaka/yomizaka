import { PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildPayload, sha256 } from "./report";
import { generateSigningKeyBase64, parseSigningKey } from "./report-key";
import { reportLabels } from "./report-labels";
import { attestationOfPdf, foldToWinAnsi, issuePdf, reportBlocks, verifyPdf } from "./report-pdf";
import { signingKey } from "./report-signer";

const doc = { sha256: sha256("lease bytes"), filename: "bail.pdf", title: "Bail — rue Saint-Denis (fictif)", sizeBytes: 11, pages: 1 };
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
    asOf: "2026-10-17",
    reviewStatus: "TO_REVIEW_BY_LAWYER",
    findings: [
      { ruleId: "QC-LEASE-004", title: "Dépôt de garantie interdit", severity: "BLOCKING", verdict: "FAIL", citation: "C.c.Q., art. 1904, al. 1", explanation: "Le bail exige un dépôt de garantie. L'article 1904 ne permet que le premier terme de loyer.", evidenceSpan: { quote: "dépôt de sécurité de 1 450 $" } },
      { ruleId: "QC-LEASE-003", title: "Montant du loyer", severity: "BLOCKING", verdict: "PASS", citation: "C.c.Q., art. 1855", explanation: "Le loyer est chiffré au bail." },
    ],
  },
  error: null,
  createdAt: "2026-10-17T10:00:00.000Z",
  finishedAt: "2026-10-17T10:00:05.000Z",
};
const payload = buildPayload(doc, analysis, "fr");

describe("the report's legal guardrail", () => {
  it.each(["fr", "en"] as const)("says in %s that it is informative, not legal advice, and gives the absolute verification address", async (lang) => {
    const issued = await issuePdf(buildPayload(doc, analysis, lang), reportLabels(lang), signingKey());
    const { extractText, getDocumentProxy } = await import("unpdf");
    const text = ((await extractText(await getDocumentProxy(new Uint8Array(issued.bytes)), { mergePages: true })).text as string).replace(/\s+/g, " ");
    expect(text).toContain(lang === "fr" ? "Vérification informative, ce n’est pas un avis juridique" : "Informative check, not legal advice");
    expect(text).toContain("https://www.yomizaka.com/verify");
    expect(text).not.toMatch(/\bconforme\b/i);
    expect(text).not.toMatch(/\bcompliant\b/i);
  });
});

describe("the service contract report", () => {
  it("says what it did not check: the right to terminate (art. 2125), to be reviewed by a lawyer", async () => {
    const contract = { ...analysis, report: { ...analysis.report, rulesetId: "qc-service-contract", rulesetVersion: "2026-10-19", rulesetRevision: 1 } };
    const issued = await issuePdf(buildPayload(doc, contract, "fr"), reportLabels("fr"), signingKey());
    const { extractText, getDocumentProxy } = await import("unpdf");
    const text = ((await extractText(await getDocumentProxy(new Uint8Array(issued.bytes)), { mergePages: true })).text as string).replace(/\s+/g, " ");
    expect(text).toContain("Non vérifié : droit de résiliation, art. 2125 C.c.Q.");
    const lease = await issuePdf(payload, reportLabels("fr"), signingKey());
    const leaseText = ((await extractText(await getDocumentProxy(new Uint8Array(lease.bytes)), { mergePages: true })).text as string);
    expect(leaseText).not.toContain("2125");
  });
});

describe("the signed PDF report", () => {
  it("is a PDF with its attestation embedded and a visible signature page after the report's pages", async () => {
    const issued = await issuePdf(payload, reportLabels("fr"), signingKey());
    expect(Buffer.from(issued.bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
    expect((await PDFDocument.load(issued.bytes)).getPageCount()).toBeGreaterThanOrEqual(2);
    const embedded = await attestationOfPdf(issued.bytes);
    expect(embedded).toMatchObject({ keyId: issued.attestation.keyId, bodySha256: issued.attestation.bodySha256, signature: issued.attestation.signature });
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pages = (await extractText(await getDocumentProxy(new Uint8Array(issued.bytes)), { mergePages: false })).text as string[];
    expect(pages.at(-1)).toContain("Page de signature");
    expect(pages.at(-1)).toContain(issued.attestation.keyId);
    expect(pages.slice(0, -1).join(" ")).toContain("Dépôt de garantie interdit");
  });

  it("is deterministic: the same payload, labels and key give the same bytes", async () => {
    const a = await issuePdf(payload, reportLabels("fr"), signingKey());
    const b = await issuePdf(payload, reportLabels("fr"), signingKey());
    expect(a.fileSha256).toBe(b.fileSha256);
  });

  it("verifies with the key, and with the original document when given", async () => {
    const issued = await issuePdf(payload, reportLabels("fr"), signingKey());
    expect(await verifyPdf(issued.bytes, signingKey())).toMatchObject({ ok: true, documentMatch: null, payload: { check: { runId: "run-123" } } });
    expect(await verifyPdf(issued.bytes, signingKey(), new TextEncoder().encode("lease bytes"))).toMatchObject({ ok: true, documentMatch: true });
    expect(await verifyPdf(issued.bytes, signingKey(), new TextEncoder().encode("another"))).toMatchObject({ ok: true, documentMatch: false });
  });

  it("verifies the English report too (the words are signed with the file)", async () => {
    const issued = await issuePdf(buildPayload(doc, analysis, "en"), reportLabels("en"), signingKey());
    expect(await verifyPdf(issued.bytes, signingKey())).toMatchObject({ ok: true });
  });

  it("fails with ALTERED when a word on a page changes — the attestation alone is not enough", async () => {
    const forged = await issuePdf({ ...payload, document: { ...payload.document, title: "Bail — AUTRE titre" } }, reportLabels("fr"), signingKey());
    // Carry the genuine attestation into a PDF whose visible text says something else.
    const genuine = (await issuePdf(payload, reportLabels("fr"), signingKey())).attestation;
    const doc2 = await PDFDocument.load(forged.bytes);
    doc2.context.lookup(doc2.context.trailerInfo.Info, PDFDict).set(PDFName.of("YomizakaAttestation"), PDFString.of(Buffer.from(JSON.stringify(genuine)).toString("base64")));
    expect(await verifyPdf(await doc2.save(), signingKey())).toMatchObject({ ok: false, reason: "ALTERED" });
  });

  it("fails with BAD_SIGNATURE when the signed payload is edited, UNKNOWN_KEY for another key", async () => {
    const issued = await issuePdf(payload, reportLabels("fr"), signingKey());
    const doc2 = await PDFDocument.load(issued.bytes);
    const edited = { ...issued.attestation, payload: { ...payload, check: { ...payload.check, runId: "run-999" } } };
    doc2.context.lookup(doc2.context.trailerInfo.Info, PDFDict).set(PDFName.of("YomizakaAttestation"), PDFString.of(Buffer.from(JSON.stringify(edited)).toString("base64")));
    expect(await verifyPdf(await doc2.save(), signingKey())).toMatchObject({ ok: false, reason: "BAD_SIGNATURE" });
    const other = parseSigningKey(generateSigningKeyBase64(), false);
    expect(await verifyPdf(issued.bytes, other)).toMatchObject({ ok: false, reason: "UNKNOWN_KEY" });
  });

  it("never throws on hostile input: not a PDF, a PDF without an attestation", async () => {
    expect(await verifyPdf(new TextEncoder().encode("hello"), signingKey())).toMatchObject({ ok: false, reason: "NOT_A_REPORT" });
    const plain = await (await PDFDocument.create()).save();
    expect(await verifyPdf(plain, signingKey())).toMatchObject({ ok: false, reason: "UNREADABLE" });
  });

  it("rejects a specimen even with a valid signature", async () => {
    const issued = await issuePdf({ ...payload, specimen: true }, reportLabels("fr"), signingKey());
    expect(await verifyPdf(issued.bytes, signingKey())).toMatchObject({ ok: false, reason: "SPECIMEN" });
  });
});

describe("typography the PDF's fonts cannot draw", () => {
  it("folds French typography and common symbols to their plain equivalent instead of a question mark", () => {
    expect(foldToWinAnsi("1\u202f450\u00a0$")).toBe("1 450\u00a0$");
    expect(foldToWinAnsi("a\u2009b\u2011c")).toBe("a b-c");
    expect(foldToWinAnsi("loyer \u2265 850 \u2192 refus \u2713")).toBe("loyer >= 850 -> refus ok");
    expect(foldToWinAnsi("« dépôt » — l’article")).toBe("« dépôt » — l’article");
  });
});

describe("the report's text blocks, in reading order", () => {
  const labels = reportLabels("fr");
  const texts = (p = payload) => reportBlocks(p, labels).map((b) => b.text);

  it("lays out the header, the document, the check, each finding, the guarantees and the footer", () => {
    const blocks = reportBlocks(payload, labels);
    expect(blocks[0]).toMatchObject({ text: labels.eyebrow, size: 8 });
    expect(blocks[1]).toMatchObject({ text: doc.title, size: 18, bold: true });
    expect(blocks.at(-1)).toMatchObject({ text: labels.footer, size: 8 });
    const all = texts();
    expect(all).toContain(`${labels.file}: bail.pdf`);
    expect(all).toContain(`${labels.size}: 11 B · 1 p.`);
    expect(all).toContain(`${labels.ruleset}: qc-residential-lease · 2024-02-21 (rev. 2)`);
    expect(all).toContain(`${labels.passage}: « dépôt de sécurité de 1 450 $ »`);
    expect(all).toContain(`${labels.passage}: ${labels.noPassage}`);
    expect(all.filter((t) => t.startsWith(`${labels.article}: `))).toHaveLength(2);
  });

  it("leaves out what is absent: the page count, the Studio version, the review notice", () => {
    const bare = { ...payload, document: { ...payload.document, pages: null }, check: { ...payload.check, studioVersion: null, reviewStatus: null, rulesetRevision: null } };
    const all = texts(bare as typeof payload);
    expect(all).toContain(`${labels.size}: 11 B`);
    expect(all).not.toContain(labels.toReview);
    expect(all.find((t) => t.startsWith(`${labels.ruleset}: `))).not.toContain("rev.");
    expect(all.find((t) => t.startsWith(`${labels.engine}: `))).toMatch(/compliance-check$/);
    expect(texts()).toContain(labels.toReview);
  });
});

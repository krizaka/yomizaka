import { describe, expect, it } from "vitest";

import { buildPayload, issueReport, sha256, verifyReport } from "./report";
import { reportLabels } from "./report-labels";
import { issuePdf, verifyPdf } from "./report-pdf";
import { signingKey } from "./report-signer";
import type { TranslationTrace } from "./translation/apply";

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
      { ruleId: "QC-LEASE-004", title: "Dépôt de garantie interdit", severity: "BLOCKING", verdict: "FAIL", citation: "C.c.Q., art. 1904, al. 1", explanation: "Le bail exige un dépôt de garantie de 1 450 $.", evidenceSpan: { quote: "dépôt de sécurité de 1 450 $" } },
      { ruleId: "QC-LEASE-003", title: "Montant du loyer", severity: "BLOCKING", verdict: "PASS", citation: "C.c.Q., art. 1855", explanation: "Le loyer est chiffré au bail." },
    ],
  },
  error: null,
  createdAt: "2026-10-17T10:00:00.000Z",
  finishedAt: "2026-10-17T10:00:05.000Z",
};
const trace: TranslationTrace = { original: "fr", language: "en", runId: "run-translation-9", studioVersion: "1.0.0", glossaryVersion: 3, sourceVersion: "abc123" };
const texts = { "title:QC-LEASE-004": "Security deposit prohibited", "explanation:QC-LEASE-004": "The lease requires a security deposit of 1 450 $.", "quote:QC-LEASE-004": "security deposit of $1,450", "title:QC-LEASE-003": "Rent amount" };
const english = buildPayload(doc, analysis, "en", { trace, texts });

const pdfText = async (bytes: Uint8Array) => {
  const { extractText, getDocumentProxy } = await import("unpdf");
  return ((await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: true })).text as string).replace(/\s+/g, " ");
};

describe("the signed report in each language (yomizaka#246)", () => {
  it("the English payload carries the translated texts and their trace; the quote, the citation and the ids stay as Orazaka sent them", () => {
    expect(english.translation).toEqual(trace);
    const [first, second] = english.findings;
    expect(first).toMatchObject({ title: "Security deposit prohibited", quote: "dépôt de sécurité de 1 450 $", quoteAid: "security deposit of $1,450", citation: "C.c.Q., art. 1904, al. 1", ruleId: "QC-LEASE-004", verdict: "FAIL" });
    expect(second).toMatchObject({ title: "Rent amount", explanation: "Le loyer est chiffré au bail.", citation: "C.c.Q., art. 1855" });
    expect(english.check.asOf).toBe("2026-10-17");
  });

  it("without a translation the payload is what it was: no `translation`, no `quoteAid`", () => {
    const plain = buildPayload(doc, analysis, "fr");
    expect("translation" in plain).toBe(false);
    expect(JSON.stringify(plain)).not.toContain("quoteAid");
  });

  it("the PDF is produced in English with its notice, the quote beside its indicative translation, and the legal-review banner — and verifies", async () => {
    const issued = await issuePdf(english, reportLabels("en"), signingKey());
    const text = await pdfText(issued.bytes);
    expect(text).toContain("Original language: French");
    expect(text).toContain("run-translation-9");
    expect(text).toContain("Security deposit prohibited");
    expect(text).toContain("« dépôt de sécurité de 1 450 $ »");
    expect(text).toContain("Indicative translation: « security deposit of $1,450 »");
    expect(text).toContain("Québec rules still to be reviewed by a lawyer");
    expect(text).toContain("Informative check, not legal advice");
    const verified = await verifyPdf(issued.bytes, signingKey());
    expect(verified.ok).toBe(true);
  });

  it("the French PDF stays the original: no translation notice, and the legal-review banner is there too", async () => {
    const issued = await issuePdf(buildPayload(doc, analysis, "fr"), reportLabels("fr"), signingKey());
    const text = await pdfText(issued.bytes);
    expect(text).not.toContain("Langue d'origine");
    expect(text).not.toContain("Traduction indicative");
    expect(text).toContain("encore à faire réviser par un avocat");
  });

  it("a French reader of a report written in English would be told the same, in French", async () => {
    const reversed = buildPayload(doc, analysis, "fr", { trace: { ...trace, original: "en", language: "fr" }, texts: { "quote:QC-LEASE-004": "dépôt de garantie de 1 450 $" } });
    const text = await pdfText((await issuePdf(reversed, reportLabels("fr"), signingKey())).bytes);
    expect(text).toContain("Langue d'origine : anglais");
    expect(text).toContain("Traduction indicative: « dépôt de garantie de 1 450 $ »");
  });

  it("the HTML says the same, escapes the translations, and a changed translated word breaks the signature", () => {
    const issued = issueReport({ ...english, findings: english.findings.map((f) => ({ ...f, quoteAid: f.quoteAid ? `${f.quoteAid} <b>` : f.quoteAid })) }, reportLabels("en"), signingKey());
    expect(issued.html).toContain("Original language: French");
    expect(issued.html).toContain("Indicative translation:");
    expect(issued.html).toContain("&lt;b&gt;");
    expect(issued.html).toContain('<blockquote lang="fr">');
    expect(verifyReport(issued.html, signingKey())).toMatchObject({ ok: true });
    expect(verifyReport(issued.html.replace("Security deposit prohibited", "Security deposit allowed"), signingKey())).toMatchObject({ ok: false, reason: "ALTERED" });
  });
});

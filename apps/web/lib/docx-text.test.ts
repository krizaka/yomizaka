import { DOCX_MIME } from "@yomizaka/core";
import { describe, expect, it } from "vitest";

import { docxText } from "./docx-text";
import { readText } from "./pdf-text";
import { docx, zipOf } from "./preflight/fixtures";
import { createInspector } from "./preflight/inspector";
import { YOMIZAKA_RULES } from "./preflight/rules";

const LEASE = `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>
<w:p><w:r><w:t>BAIL DE LOGEMENT</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Loyer : 1 250 $ </w:t></w:r><w:r><w:t>par mois</w:t></w:r><w:r><w:tab/><w:t>(Montr&#233;al)</w:t></w:r></w:p>
<w:p><w:r><w:fldChar w:fldCharType="begin"/><w:instrText> PAGE </w:instrText><w:fldChar w:fldCharType="end"/><w:t>Article 2 &amp; annexes</w:t></w:r></w:p>
</w:body></w:document>`;
const lease = () => docx([]).length && zipOf([{ name: "[Content_Types].xml", data: Buffer.from("<Types/>") }, { name: "word/document.xml", data: Buffer.from(LEASE) }]);

describe("a Word file (yomizaka#229)", () => {
  it("its text: one paragraph per line, tabs and entities kept, field codes and markup dropped", () => {
    expect(docxText(lease() as Uint8Array).trim().split("\n")).toEqual(["BAIL DE LOGEMENT", "Loyer : 1 250 $ par mois\t(Montréal)", "Article 2 & annexes"]);
  });

  it("reaches the checks through readText, normalised like a PDF's text", async () => {
    const read = await readText(DOCX_MIME, lease() as Uint8Array);
    expect(read).toEqual({ text: "BAIL DE LOGEMENT\nLoyer : 1 250 $ par mois (Montréal)\nArticle 2 & annexes", pages: null });
  });

  it("is accepted by the pre-flight; a macro-bearing one is still refused", async () => {
    const inspector = createInspector(YOMIZAKA_RULES);
    expect(await inspector.inspect(lease() as Uint8Array, { name: "bail.docx", type: DOCX_MIME })).toMatchObject({ kind: "accepted", fileKind: "docx" });
    expect(await inspector.inspect(docx([{ name: "word/vbaProject.bin", data: Buffer.from("x") }]), { name: "bail.docx", type: DOCX_MIME })).toMatchObject({ kind: "rejected", reason: "ACTIVE_CONTENT" });
  });

  it("a file without its main part reads as no text, never as an error", () => {
    expect(docxText(zipOf([{ name: "[Content_Types].xml", data: Buffer.from("<Types/>") }]))).toBe("");
  });
});

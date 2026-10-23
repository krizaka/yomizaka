import { describe, expect, it } from "vitest";

// A plain ES module script (scripts/demo-documents), tested here where the PDF text reader lives.
import { generateAll, generateDocument, PERSONA_ERIC, SPECS, WATERMARK } from "../../../scripts/demo-documents/index.mjs";
import { readText } from "./pdf-text";

interface Finding { code: string; present?: string[]; absent?: string[] }
interface Generated { id: string; family: string; flaw: string | null; kind: string; bytes: Uint8Array; text: string; pages: number; findings: Finding[] }

const all: Generated[] = await generateAll();
const textOf = async (doc: Generated) => (await readText("application/pdf", doc.bytes)).text;

describe("the demo documents generator", () => {
  it("gives the same bytes for the same seed, and others for another seed", async () => {
    const again: Generated[] = await generateAll();
    expect(again.map((d) => Buffer.from(d.bytes).toString("base64"))).toEqual(all.map((d) => Buffer.from(d.bytes).toString("base64")));
    const other: Generated = await generateDocument("bail-rosemont-1-conforme", 7);
    expect(Buffer.from(other.bytes).equals(Buffer.from(all[0]!.bytes))).toBe(false);
  });

  it("makes real PDFs with the watermark on every page", async () => {
    for (const doc of all) {
      expect(Buffer.from(doc.bytes.slice(0, 5)).toString()).toBe("%PDF-");
      const { text, pages } = await readText("application/pdf", doc.bytes);
      expect(pages).toBe(doc.pages);
      expect(text.split(WATERMARK).length - 1, doc.id).toBeGreaterThanOrEqual(doc.pages);
    }
  });

  it("finds every recorded finding in the document: what is said is there, what is missing is missing, and a clean sibling has it", async () => {
    const clean = new Map<string, string>();
    for (const doc of all) if (doc.flaw === null) clean.set(doc.family, await textOf(doc));
    for (const doc of all) {
      const text = await textOf(doc);
      for (const finding of doc.findings) {
        for (const quote of finding.present ?? []) expect(text, `${doc.id} ${finding.code}`).toContain(quote);
        for (const quote of finding.absent ?? []) {
          expect(text, `${doc.id} ${finding.code}`).not.toContain(quote);
          expect(clean.get(doc.family), `${doc.family} clean`).toContain(quote);
        }
      }
    }
  });

  it("has a clean and a flawed variant of each kind a check looks at, and flawed ones always record a finding", () => {
    for (const family of ["lease", "pay-stub", "bank-statement", "employment-letter", "invoice"]) {
      const of = all.filter((d) => d.family === family);
      expect(of.some((d) => d.flaw === null), `${family} clean`).toBe(true);
      expect(of.some((d) => d.flaw !== null), `${family} flawed`).toBe(true);
    }
    for (const doc of all) expect(doc.findings.length > 0, doc.id).toBe(doc.flaw !== null);
    expect(new Set(all.filter((d) => d.family === "lease").map((d) => d.flaw))).toEqual(new Set([null, "no-tal", "illegal-clause"]));
  });

  it("has totals that really do not add up in the flawed pay stub and invoice, and a balance that does not follow in the edited statement", async () => {
    const amount = (text: string, label: string) => {
      const m = text.match(new RegExp(`${label} : (-?[\\d ]+),(\\d\\d) \\$`));
      return Number(m![1]!.replace(/ /g, "")) * 100 + Number(m![2]);
    };
    for (const [id, gross, deduct, net] of [["paie-villeray-2-totaux-faux", "Salaire brut", "Total des retenues", "Net à payer"]] as const) {
      const text = (await generateDocument(id)).text;
      expect(amount(text, gross) - amount(text, deduct)).not.toBe(amount(text, net));
    }
    const ok = (await generateDocument("paie-villeray-1-conforme")).text;
    expect(amount(ok, "Salaire brut") - amount(ok, "Total des retenues")).toBe(amount(ok, "Net à payer"));
    const bank = (await generateDocument("banque-villeray-2-solde-modifie")).text;
    const last = [...bank.matchAll(/solde (-?[\d ]+),(\d\d) \$/g)].at(-1)!;
    expect(Number(last[1]!.replace(/ /g, "")) * 100 + Number(last[2])).not.toBe(amount(bank, "Solde de clôture"));
  });

  it("invents everything: postal codes with a letter Canada Post never issues, SIN-like numbers that start with 0", () => {
    for (const doc of all) {
      for (const postal of doc.text.match(/\b[A-Z]\d[A-Z] \d[A-Z]\d\b/g) ?? []) expect(postal, doc.id).toMatch(/^H\dD \dD\d$/);
      for (const sin of doc.text.match(/NAS : [\d ]+/g) ?? []) expect(sin.replace("NAS : ", "")).toMatch(/^0\d\d \d{3} \d{3}/);
      expect(doc.text).toContain("DOCUMENT FICTIF");
    }
  });

  it("fills the persona's three collections with 4 to 8 documents each, of the right kinds", () => {
    expect(PERSONA_ERIC.collections.map((c: { key: string }) => c.key)).toEqual(["rosemont", "villeray", "invoices"]);
    for (const c of PERSONA_ERIC.collections as { key: string; documents: string[] }[]) {
      expect(c.documents.length).toBeGreaterThanOrEqual(4);
      expect(c.documents.length).toBeLessThanOrEqual(8);
    }
    const ids = new Set(SPECS.map((s: { id: string }) => s.id));
    for (const id of PERSONA_ERIC.collections.flatMap((c: { documents: string[] }) => c.documents).concat(PERSONA_ERIC.checked)) expect(ids.has(id)).toBe(true);
  });
});

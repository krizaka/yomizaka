import { describe, expect, it } from "vitest";

import * as fx from "./fixtures";
import { understanding } from "./index";

const read = (text: string, pages: number | null = 1) => understanding.understand(text, { pages });

describe("understanding: the nature, with a confidence", () => {
  it.each([
    ["revenu-quebec-registration", fx.RECEIPT],
    ["invoice", fx.INVOICE],
    ["residential-lease", fx.LEASE],
    ["service-contract", fx.CONTRACT],
    ["pay-stub", fx.PAY_STUB],
    ["bank-statement", fx.BANK_STATEMENT],
    ["identity-document", fx.ID_CARD],
    ["visit-notice", fx.VISIT_NOTICE],
    ["premises-condition", fx.PREMISES_CONDITION],
    ["premises-condition", fx.ENGLISH_CONDITION_REPORT],
  ])("recognises %s", (id, text) => {
    const u = read(text);
    expect(u.nature?.id).toBe(id);
    expect(u.nature?.confidence).not.toBe("unknown");
  });
  it("says it does not know rather than guess", () => {
    const u = read(fx.NOTHING);
    expect(u.nature).toBeNull();
    expect(u.needsModel).toBe(true);
    expect(u.check).toBeNull();
  });
  it("reads an English invoice too", () => {
    const u = read(fx.ENGLISH_INVOICE);
    expect(u.nature?.id).toBe("invoice");
    expect(u.language).toBe("en");
  });
});

describe("understanding: the matching check (or none, said plainly)", () => {
  it("a lease leads to the lease rules, an invoice and a contract to their named rulesets", () => {
    expect(read(fx.LEASE).check).toEqual({ studio: "compliance-check", documentType: "lease", ruleset: null });
    expect(read(fx.INVOICE).check).toEqual({
      studio: "compliance-check",
      documentType: "invoice",
      ruleset: "qc-invoice",
    });
    expect(read(fx.CONTRACT).check).toEqual({
      studio: "compliance-check",
      documentType: "contract",
      ruleset: "qc-service-contract",
    });
  });
  it("a visit notice and an état des lieux lead to their own rulesets, never to the lease", () => {
    expect(read(fx.VISIT_NOTICE).check).toEqual({
      studio: "compliance-check",
      documentType: "visit-notice",
      ruleset: "qc-visit-notice",
    });
    expect(read(fx.PREMISES_CONDITION).check).toEqual({
      studio: "compliance-check",
      documentType: "premises-condition",
      ruleset: "qc-premises-condition",
    });
    expect(read(fx.ENGLISH_CONDITION_REPORT).check?.documentType).toBe("premises-condition");
  });
  it("a Revenu Québec receipt, a pay stub, a statement and an ID have no legal check — never a lease by default", () => {
    for (const text of [fx.RECEIPT, fx.PAY_STUB, fx.BANK_STATEMENT, fx.ID_CARD]) expect(read(text).check).toBeNull();
  });
});

describe("understanding: the facts", () => {
  it("reads the receipt: issuer, NEQ, reference, date, language, pages", () => {
    const u = read(fx.RECEIPT, 2);
    expect(u.issuer).toBe("Revenu Québec");
    expect(u.references).toEqual(
      expect.arrayContaining([
        { kind: "neq", value: "1170000001" },
        { kind: "reference", value: "RQ-2026-0042" },
      ]),
    );
    expect(u.dates).toContainEqual({ kind: "issued", value: "2026-10-12", text: "12 octobre 2026" });
    expect(u.language).toBe("fr");
    expect(u.pages).toBe(2);
    expect(u.parties).toContainEqual({ role: "company", name: "Atelier Boréal enr." });
  });
  it("reads the invoice: issuer, tax numbers, invoice number, dates, amounts in cents", () => {
    const u = read(fx.INVOICE);
    expect(u.issuer).toBe("Atelier Boréal inc.");
    expect(u.references).toEqual(
      expect.arrayContaining([
        { kind: "gst", value: "123456789 RT 0001" },
        { kind: "qst", value: "1234567890 TQ 0001" },
        { kind: "invoice-number", value: "F-2026-0042" },
      ]),
    );
    expect(u.dates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "issued", value: "2026-10-12" }),
        expect.objectContaining({ kind: "due", value: "2026-11-11" }),
      ]),
    );
    const by = Object.fromEntries(u.amounts.map((a) => [a.kind, a.cents]));
    expect(by).toMatchObject({ subtotal: 400000, gst: 20000, qst: 39900, total: 459900 });
  });
  it("reads the lease: parties, effective dates, rent", () => {
    const u = read(fx.LEASE);
    expect(u.parties).toEqual(
      expect.arrayContaining([
        { role: "landlord", name: "Madame Hélène Roy" },
        { role: "tenant", name: "Monsieur Karim Haddad" },
      ]),
    );
    expect(u.dates.map((d) => d.value)).toEqual(expect.arrayContaining(["2026-09-01", "2027-08-31"]));
    expect(u.amounts).toContainEqual(expect.objectContaining({ kind: "rent", cents: 112000 }));
  });
  it("is deterministic and reads nothing it cannot see", () => {
    expect(read(fx.INVOICE)).toEqual(read(fx.INVOICE));
    const u = read(fx.NOTHING);
    expect([u.dates, u.parties, u.references, u.amounts].every((x) => x.length === 0)).toBe(true);
  });
});

describe("insight of a document (understanding + personal information, values never kept)", () => {
  it("combines the nature and the counts, and maps the nature to the document kind", async () => {
    const { insightOf, kindFromNature } = await import("../documents");
    const insight = insightOf(fx.RECEIPT, 2);
    expect(insight.understanding.nature?.id).toBe("revenu-quebec-registration");
    expect(insight.pii.counts).toMatchObject({ sin: 1, email: 1 });
    expect(JSON.stringify(insight.pii)).not.toMatch(/example\.test|555/);
    expect([
      kindFromNature("residential-lease"),
      kindFromNature("invoice"),
      kindFromNature("service-contract"),
      kindFromNature("pay-stub"),
      kindFromNature(null),
    ]).toEqual(["lease", "invoice", "contract", "other", "other"]);
  });
});

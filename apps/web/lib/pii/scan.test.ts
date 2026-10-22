import { describe, expect, it } from "vitest";

import { RECEIPT } from "../understanding/fixtures";
import { personalInfo } from "./index";

// Fictional data only: example.test addresses, 555 numbers, invented streets, a Luhn-valid but unassigned test SIN.
const counts = (text: string) => personalInfo.scan(text).counts;

describe("personal information: what is found", () => {
  it("finds the kinds on a receipt of the kind Oussama tested (fictional rebuild)", () => {
    expect(counts(RECEIPT)).toEqual({ sin: 1, email: 1, phone: 1, "postal-code": 1, address: 1 });
  });
  it("finds a SIN fully written (Luhn) and partly or fully masked, never a random nine-digit number", () => {
    expect(counts("NAS : 046 454 286")).toEqual({ sin: 1 });
    expect(counts("NAS : XXX XXX 123")).toEqual({ sin: 1 });
    expect(counts("SIN ***-***-123")).toEqual({ sin: 1 });
    expect(counts("Référence 123 456 789")).toEqual({}); // not Luhn-valid, not masked
  });
  it("finds phones in the usual shapes, and not a date or an amount", () => {
    expect(counts("Tél. (514) 555-0142 ou 438.555.0199 ou +1 450 555 0111")).toEqual({ phone: 3 });
    expect(counts("Total 2026-10-12 4 599,00 $")).toEqual({});
  });
  it("finds e-mails", () => {
    expect(counts("Courriel : prenom.nom+x@example.test")).toEqual({ email: 1 });
  });
  it("finds a birth date only with its label (an issue date is not personal)", () => {
    expect(counts("Date de naissance : 1990-05-17")).toEqual({ "birth-date": 1 });
    expect(counts("Date de la facture : 2026-10-12")).toEqual({});
  });
  it("finds a bank account only next to its label, and an IBAN", () => {
    expect(counts("Numéro de compte : 1234567")).toEqual({ "bank-account": 1 });
    expect(counts("Loyer 1234567 $")).toEqual({});
    expect(counts("IBAN FR76 3000 6000 0112 3456 7890 189")).toEqual({ "bank-account": 1 });
  });
  it("finds street addresses and postal codes", () => {
    expect(counts("123, rue des Érables, Montréal H2X 1Y4")).toEqual({ address: 1, "postal-code": 1 });
  });
});

describe("personal information: redaction and discretion", () => {
  it("blanks every value with its kind, in the chosen language", () => {
    const out = personalInfo.redact("Courriel : exemple@example.test, NAS : XXX XXX 123", "fr");
    expect(out).toBe("Courriel : [Courriel], NAS : [NAS]");
    expect(personalInfo.redact("Phone 514 555-0142", "en")).toBe("Phone [Phone]");
    expect(personalInfo.scan(personalInfo.redact(RECEIPT, "fr")).total).toBe(0);
  });
  it("a scan holds positions and counts, never the values", () => {
    const scan = personalInfo.scan(RECEIPT);
    expect(JSON.stringify(scan)).not.toMatch(/example\.test|555|XXX|Érables/);
  });
});

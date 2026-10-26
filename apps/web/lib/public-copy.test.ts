import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";

/**
 * The public copy tells the truth about what runs (AGENTS.md, Yomizaka launch): the same keys in both languages, the registry
 * services and the credit checks named only where they are marked « In preparation », and no price typed in a message (the
 * prices are `lib/pricing.ts`, the processor's catalogue). Residency claims are held by `lib/storage/residency-claims.test.ts`.
 */
const PUBLIC = ["meta", "chrome", "landing", "pricing", "privacy", "terms", "download"] as const;
const PREPARATION = { en: "In preparation", fr: "En préparation" } as const;
/** Words that promise what is not built yet: the registry services and the credit check. */
const NOT_BUILT = /SOQUIJ|Equifax|TransUnion|\bcr[ée]dit|\bTAL\b|plumitif/i;
/** A price typed by hand (« 9,99 $ », « $29 », « 29 $ CAD »): a price only ever arrives through a `{placeholder}`. */
const TYPED_PRICE = /\$\s?\d|\d(?:[.,]\d{2})?\s?\$/;

type Dict = Record<string, unknown>;
/** Each string of a public namespace, with the object that holds it (its sibling `status` says whether it is built). */
function leaves(o: unknown, path: string, parent: Dict | null, out: { path: string; text: string; parent: Dict | null }[] = []) {
  if (typeof o === "string") out.push({ path, text: o, parent });
  else if (Array.isArray(o)) o.forEach((v, i) => leaves(v, `${path}.${i}`, null, out));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) leaves(v, `${path}.${k}`, o as Dict, out);
  return out;
}

const dicts = { en: en as unknown as Dict, fr: fr as unknown as Dict };

describe("the messages", () => {
  it("have the same keys in English and French", () => {
    const paths = (locale: "en" | "fr") => leaves(dicts[locale], "", null).map((l) => l.path).sort();
    expect(paths("fr")).toEqual(paths("en"));
  });

  it("have no empty string in either language", () => {
    for (const locale of ["en", "fr"] as const) {
      const empty = leaves(dicts[locale], "", null).filter((l) => l.text.trim() === "").map((l) => l.path);
      expect(empty, locale).toEqual([]);
    }
  });
});

describe("the public copy names what is not built only as « In preparation »", () => {
  for (const locale of ["en", "fr"] as const) {
    it(`${locale}: a SOQUIJ, credit or TAL mention sits next to the status « ${PREPARATION[locale]} »`, () => {
      const offenders: string[] = [];
      for (const ns of PUBLIC) {
        for (const leaf of leaves((dicts[locale] as Dict)[ns], ns, null)) {
          if (!NOT_BUILT.test(leaf.text)) continue;
          if (leaf.parent?.status !== PREPARATION[locale]) offenders.push(`${leaf.path}: ${leaf.text.slice(0, 80)}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});

describe("no message types a price (#300)", () => {
  for (const locale of ["en", "fr"] as const) {
    it(`${locale}: every price comes from lib/pricing.ts through a placeholder`, () => {
      const offenders = leaves(dicts[locale], "", null).filter((l) => TYPED_PRICE.test(l.text));
      expect(offenders.map((l) => `${l.path}: ${l.text.slice(0, 80)}`)).toEqual([]);
    });
  }
});

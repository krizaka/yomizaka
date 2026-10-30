import { describe, expect, it } from "vitest";

import { isGenericName } from "./generic-name";

/** The single pattern `isGenericName` replaces: the oracle. */
const OLD =
  /^(document|doc|scan|scanner|image|img|photo|file|fichier|untitled|sans titre|download|télécharg\w*)?[\s_-]*[\d\s_()-]*$|^[a-f0-9-]{16,}$/i;

describe("isGenericName", () => {
  it.each([
    "scan",
    "IMG_2041",
    "Document (3)",
    "télécharger",
    "Téléchargement (2)",
    "sans titre 1",
    "0123456789abcdef",
    "2024-01-05",
    "  ",
    "",
  ])("%s says nothing", (name) => expect(isGenericName(name)).toBe(true));
  it.each(["Bail 2024", "Lease for Marie", "facture janvier", "scan de bail", "télécharger bail"])(
    "%s says something",
    (name) => expect(isGenericName(name)).toBe(false),
  );

  it("answers like the single pattern on every combination of up to four pieces", () => {
    const pieces = [
      "document",
      "doc",
      "scan",
      "scanner",
      "IMG",
      "file",
      "sans titre",
      "télécharg",
      "TÉLÉCHARG",
      "ement",
      "1",
      "_",
      " ",
      "-",
      "(",
      ")",
      "a",
      "é",
      "f",
      "9",
      ".",
      "x",
      "0123456789abcdef",
    ];
    let checked = 0;
    const walk = (prefix: string, depth: number) => {
      expect(isGenericName(prefix), JSON.stringify(prefix)).toBe(OLD.test(prefix));
      checked++;
      if (depth === 0) return;
      for (const p of pieces) walk(prefix + p, depth - 1);
    };
    walk("", 4);
    expect(checked).toBeGreaterThan(200000);
  });
});

import { describe, expect, it } from "vitest";

import en from "../i18n/own.en.json";
import fr from "../i18n/own.fr.json";
import { localDocuments } from "./local-documents";
import { rememberFiles } from "./use-batch";

const leaves = (value: unknown, path = ""): string[] =>
  value && typeof value === "object" ? Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key)) : [path];

describe("the Mac app's own words", () => {
  it("exist in French and in English, with the same keys and the same placeholders", () => {
    expect(leaves(en).sort()).toEqual(leaves(fr).sort());
    const at = (o: unknown, path: string) => path.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown>)[k], o) as string;
    for (const key of leaves(fr)) expect(at(en, key).match(/\{\w+\}/g)?.sort() ?? []).toEqual(at(fr, key).match(/\{\w+\}/g)?.sort() ?? []);
  });
});

describe("a batch's documents and the files of the Mac", () => {
  it("remembers each row's file by name, so its signed report lands next to it", () => {
    rememberFiles(
      [
        { file: "Bail.pdf", documentId: "d1" },
        { file: "refused.pdf", documentId: null },
        { file: "unknown.pdf", documentId: "d3" },
      ],
      [
        { name: "bail.pdf", path: "/Users/eric/Baux/bail.pdf" },
        { name: "refused.pdf", path: "/Users/eric/Baux/refused.pdf" },
      ],
    );
    expect(localDocuments.pathOf("d1")).toBe("/Users/eric/Baux/bail.pdf");
    expect(localDocuments.pathOf("d3")).toBeNull();
  });
});

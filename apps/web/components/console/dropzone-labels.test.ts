import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

describe("the Dropzones' file inputs are named (axe label, @krizaka/ui 3.67 inputLabel)", () => {
  it.each([
    ["en", en],
    ["fr", fr],
  ] as const)("%s says what each file input chooses", (_locale, m) => {
    for (const label of [m.console.library.inputLabel, m.console.batch.inputLabel]) expect(label.trim()).not.toBe("");
    expect(JSON.stringify(m)).toContain('"inputLabel"');
  });
});

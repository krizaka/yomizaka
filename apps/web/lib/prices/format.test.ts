import { describe, expect, it } from "vitest";

import { money } from "./format";

describe("a catalogue amount is written from its cents, in Canadian French and English", () => {
  it.each([
    [65, "fr", "0,65 $"],
    [65, "en", "$0.65"],
    [5900, "fr", "59,00 $"],
    [27900, "en", "$279.00"],
  ] as const)("%i cents in %s", (cents, locale, shown) =>
    expect(money(cents, locale).replace(/\s/gu, " ")).toBe(shown),
  );
});

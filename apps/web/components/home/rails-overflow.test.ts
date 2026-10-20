import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A horizontal rail (`overflow-x-auto`) scrolls vertically too for one pixel of overflow (the CSS computes overflow-y to
// auto): a stray vertical scroll on a phone. Both audience rails clip the other axis.
const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");

describe("the home's horizontal rails", () => {
  for (const file of ["./AudiencePicker.tsx", "./AudienceCards.tsx"]) {
    it(`${file} clips the vertical axis`, () => {
      const rail = read(file).split("\n").find((l) => l.includes("overflow-x-auto")) ?? "";
      expect(rail).toContain("overflow-y-hidden");
    });
  }
});

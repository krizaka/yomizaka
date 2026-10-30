import { describe, expect, it } from "vitest";

import { csvCell } from "./csv-out";

describe("a CSV cell we hand out (review of #265)", () => {
  it.each(["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tx", "\rx"])(
    "%j cannot run as a formula in a spreadsheet",
    (value) => {
      expect(csvCell(value).replace(/^"/, "")).toMatch(/^'/);
    },
  );

  it("quotes what holds a separator, a quote or a line break — after neutralising", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
    expect(csvCell("a;b")).toBe('"a;b"');
  });

  it("leaves numbers, empty cells and ordinary text alone", () => {
    expect(csvCell(12)).toBe("12");
    expect(csvCell(null)).toBe("");
    expect(csvCell("bail-101.pdf")).toBe("bail-101.pdf");
    expect(csvCell("Étienne")).toBe("Étienne");
  });
});

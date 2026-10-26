import { describe, expect, it } from "vitest";

import { trimEdges } from "./trim-edges";

describe("trimEdges", () => {
  it.each([
    ["--a-b..", "-.", "a-b"],
    ["...", "-.", ""],
    ["", "-", ""],
    ["abc", "-.", "abc"],
    ["-x", "-", "x"],
    ["x-", "-", "x"],
    ["-a-b-", "-", "a-b"],
  ])("%j without %j at the ends is %j", (text, chars, out) => expect(trimEdges(text, chars)).toBe(out));

  it("is the same as the pattern it replaces", () => {
    const alphabet = ["a", "-", "."];
    const walk = (prefix: string, depth: number) => {
      expect(trimEdges(prefix, "-.")).toBe(prefix.replace(/^[-.]+|[-.]+$/g, ""));
      expect(trimEdges(prefix, "-")).toBe(prefix.replace(/^-+|-+$/g, ""));
      if (depth > 0) for (const c of alphabet) walk(prefix + c, depth - 1);
    };
    walk("", 7);
  });

  it("stays fast on a long run that is not at the end", () => {
    const text = `${"-".repeat(200000)}a`;
    const start = performance.now();
    expect(trimEdges(text, "-.")).toBe("a");
    expect(performance.now() - start).toBeLessThan(500);
  });
});

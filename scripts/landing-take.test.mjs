import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./landing-take.mjs", import.meta.url), "utf8");

// yomizaka#602: a CDP `clip` at y=0 cut the frame at the top of the page, so a scrolled page left a blank band in the film.
// yomizaka#575: the take waited for a <mark> that never exists when the document is deleted after its check; the keep
// choice is read when the file leaves, so it is made BEFORE the drop, and every wait is bounded and logged.
describe("the /story take", () => {
  it("never clips its screenshots", () => {
    expect(source).not.toMatch(/clip\s*:/);
  });
  it("ticks « Keep my documents » before the file is dropped", () => {
    expect(source.indexOf("keep-documents")).toBeGreaterThan(-1);
    expect(source.indexOf("keep-documents")).toBeLessThan(source.indexOf("setInputFiles"));
  });
  it("bounds the wait for a lit line, so a missing <mark> cannot hang the take", () => {
    expect(source).toMatch(/querySelectorAll\("mark"\)[\s\S]{0,120}timeout: 60_000/);
  });
});

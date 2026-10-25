import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";

import { contextOptions } from "./check-app-pages.mjs";

// yomizaka#354: the signed-in browser check raced View Transitions (« Viewport size changed », 0 of 2 h1).
describe("the signed-in pages check and View Transitions", () => {
  it("emulates reduced motion in every theme, so the page change is instant while it measures", () => {
    for (const theme of ["dark", "light"]) assert.deepEqual(contextOptions(theme), { colorScheme: theme, reducedMotion: "reduce" });
  });
  it("opens no browser context without reduced motion, and waits for a running transition before measuring", () => {
    const src = readFileSync(new URL("./check-app-pages.mjs", import.meta.url), "utf8");
    for (const m of src.matchAll(/newContext\(([^)]*)\)/g)) assert.match(m[1], /reducedMotion|contextOptions/);
    assert.ok(src.indexOf("await settled(page)") > src.indexOf("document.fonts.ready"));
  });
});

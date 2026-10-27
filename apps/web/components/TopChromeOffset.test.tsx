import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { chromeOffset } from "./TopChromeOffset";

describe("the fixed bar clears the top chrome (yomizaka#449)", () => {
  it("stands at the lowest bottom edge of what is in view, and at 0 once it has scrolled away", () => {
    expect(chromeOffset([37])).toBe(37);
    expect(chromeOffset([37, 52.4])).toBe(52);
    expect(chromeOffset([-20])).toBe(0);
    expect(chromeOffset([])).toBe(0);
  });

  it("is what the site bar's top reads, and the notice mounts it", () => {
    expect(readFileSync(new URL("./SiteChrome.tsx", import.meta.url), "utf8")).toContain("var(--kz-top-chrome,0px)");
    expect(readFileSync(new URL("./StageNotice.tsx", import.meta.url), "utf8")).toContain("<TopChromeOffset />");
  });
});

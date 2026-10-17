import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MEDIA_CDN, owlLoop } from "./owl-loop";

describe("the owl's loop", () => {
  it("is a hashed file of the Krizaka media CDN, in both themes, with its poster", () => {
    for (const theme of ["dark", "light"] as const) {
      const { mp4, poster } = owlLoop(theme);
      const base = `${MEDIA_CDN}/site/brand-films/loops/owl-square-${theme}.`;
      expect(mp4.startsWith(base) && poster.startsWith(base)).toBe(true);
      expect(mp4.slice(base.length)).toMatch(/^[0-9a-f]{10}\.mp4$/);
      expect(poster.slice(base.length)).toMatch(/^[0-9a-f]{10}\.jpg$/);
      expect(mp4).not.toMatch(/\.0{10}\./);
    }
  });

  it("is allowed by the page's CSP — that host only, for images and media", () => {
    const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
    expect(config).toContain(`"img-src 'self' data: blob: ${MEDIA_CDN}"`);
    expect(config).toContain(`"media-src 'self' ${MEDIA_CDN}"`);
  });
});

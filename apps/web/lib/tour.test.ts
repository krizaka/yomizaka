import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MEDIA_CDN, TAKE_CHAPTERS, TAKE_LOCALES, takeFor } from "./tour";

describe("the landing's recording: one smooth take, phone first, in each language", () => {
  it("has the four chapters of the real journey: drop the lease, the check runs, the finding, search", () => {
    expect(TAKE_CHAPTERS).toEqual(["drop", "check", "finding", "search"]);
    expect(TAKE_LOCALES).toEqual(["en", "fr"]);
  });

  it("is a hashed, immutable file of the Krizaka media CDN under site/products/yomizaka/tour/, with its poster", () => {
    for (const locale of TAKE_LOCALES) {
      const take = takeFor(locale);
      const base = `${MEDIA_CDN}/site/products/yomizaka/tour/take-${locale}.`;
      for (const [url, ext] of [[take.webm, "webm"], [take.mp4, "mp4"], [take.poster, "jpg"]] as const) {
        expect(url.startsWith(base)).toBe(true);
        expect(url.slice(base.length)).toMatch(new RegExp(`^[0-9a-f]{10}\\.${ext}$`));
      }
    }
  });

  it("lasts at most 25 seconds, its chapters in order inside it", () => {
    for (const locale of TAKE_LOCALES) {
      const { seconds, chapters } = takeFor(locale);
      expect(seconds).toBeLessThanOrEqual(25);
      const times = TAKE_CHAPTERS.map((c) => chapters[c]);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect(times.at(-1)!).toBeLessThan(seconds);
    }
  });

  it("proves a real run: the Orazaka run id of each recorded check is kept with the clip", () => {
    for (const locale of TAKE_LOCALES) expect(takeFor(locale).runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("are allowed by the page's CSP — that host only, for images and media", () => {
    const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
    expect(config).toContain(`"img-src 'self' data: blob: ${MEDIA_CDN}"`);
    expect(config).toContain(`"media-src 'self' ${MEDIA_CDN}"`);
  });
});

describe("the take is filmed smoothly", () => {
  it("was captured at 25 frames a second or more, in each language (scripts/landing-take.mjs refuses less)", () => {
    for (const locale of ["en", "fr"] as const) expect(takeFor(locale).fps).toBeGreaterThanOrEqual(25);
  });
});

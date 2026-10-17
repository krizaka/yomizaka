import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MEDIA_CDN, TOUR_DEVICES, TOUR_RUNS, TOUR_STEPS, tourClip } from "./tour";

describe("the landing's recordings", () => {
  it("are the three steps of the real journey, on a phone and on a desktop", () => {
    expect(TOUR_STEPS).toEqual(["keep", "check", "find"]);
    expect(TOUR_DEVICES).toEqual(["phone", "desktop"]);
  });

  it("are hashed, immutable files of the Krizaka media CDN under site/products/yomizaka/tour/, each with its poster", () => {
    for (const device of TOUR_DEVICES) {
      for (const step of TOUR_STEPS) {
        const clip = tourClip(device, step);
        const base = `${MEDIA_CDN}/site/products/yomizaka/tour/${device}-${step}.`;
        for (const [url, ext] of [[clip.webm, "webm"], [clip.mp4, "mp4"], [clip.poster, "jpg"]] as const) {
          expect(url.startsWith(base)).toBe(true);
          expect(url.slice(base.length)).toMatch(ext === "webm" ? /^[0-9a-f]{10}\.webm$/ : ext === "mp4" ? /^[0-9a-f]{10}\.mp4$/ : /^[0-9a-f]{10}\.jpg$/);
        }
      }
    }
  });

  it("prove a real run: the Orazaka run id of each recorded check is kept with the clips", () => {
    for (const device of TOUR_DEVICES) expect(TOUR_RUNS[device]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("are allowed by the page's CSP — that host only, for images and media", () => {
    const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
    expect(config).toContain(`"img-src 'self' data: blob: ${MEDIA_CDN}"`);
    expect(config).toContain(`"media-src 'self' ${MEDIA_CDN}"`);
  });
});

import { describe, expect, it } from "vitest";

import { MEDIA_CDN } from "./owl-loop";
import { TOUR_DEVICES, TOUR_RUNS, TOUR_STEPS, tourClip } from "./tour";

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
        expect(clip.webm).toMatch(new RegExp(`^${base.replace(/\./g, "\\.")}[0-9a-f]{10}\\.webm$`));
        expect(clip.mp4).toMatch(new RegExp(`^${base.replace(/\./g, "\\.")}[0-9a-f]{10}\\.mp4$`));
        expect(clip.poster).toMatch(new RegExp(`^${base.replace(/\./g, "\\.")}[0-9a-f]{10}\\.jpg$`));
      }
    }
  });

  it("prove a real run: the Orazaka run id of each recorded check is kept with the clips", () => {
    for (const device of TOUR_DEVICES) expect(TOUR_RUNS[device]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

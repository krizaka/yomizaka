import { describe, expect, it } from "vitest";

import { estimateSkew, pageBox } from "./deskew";

/** A synthetic page: dark text lines (thick horizontal dashes), turned by `degrees` around the centre, on white. */
function page(width: number, height: number, degrees: number): { data: Uint8Array; width: number; height: number } {
  const data = new Uint8Array(width * height).fill(255);
  const rad = (degrees * Math.PI) / 180;
  const [cx, cy] = [width / 2, height / 2];
  for (let line = 0; line < 14; line++) {
    const y0 = 60 + line * 30;
    for (let x0 = 50; x0 < width - 50; x0++) {
      if (Math.floor(x0 / 18) % 4 === 3) continue; // gaps between words
      for (let t = 0; t < 7; t++) {
        const [dx, dy] = [x0 - cx, y0 + t - cy];
        const x = Math.round(cx + dx * Math.cos(rad) - dy * Math.sin(rad));
        const y = Math.round(cy + dx * Math.sin(rad) + dy * Math.cos(rad));
        if (x >= 0 && x < width && y >= 0 && y < height) data[y * width + x] = 20;
      }
    }
  }
  return { data, width, height };
}

describe("skew", () => {
  it("finds the angle a page was turned by, within half a degree, and says to turn it back", () => {
    for (const turned of [-8, -3, 0, 2.5, 7]) {
      const found = estimateSkew(page(600, 480, turned), { max: 12, step: 0.5 });
      expect(found, `turned ${turned}`).toBeCloseTo(-turned, 0);
      expect(Math.abs(found + turned)).toBeLessThanOrEqual(0.5);
    }
  });
  it("leaves a blank page alone", () => {
    expect(estimateSkew({ data: new Uint8Array(100 * 100).fill(255), width: 100, height: 100 }, { max: 12, step: 0.5 })).toBe(0);
  });
});

describe("page box", () => {
  it("is the bright page on a dark desk, with a small margin", () => {
    const [w, h] = [200, 200];
    const data = new Uint8Array(w * h).fill(30);
    for (let y = 40; y < 170; y++) for (let x = 30; x < 160; x++) data[y * w + x] = 235;
    const box = pageBox({ data, width: w, height: h }, 0.4)!;
    expect(box.left).toBeLessThanOrEqual(30);
    expect(box.left).toBeGreaterThan(20);
    expect(box.top).toBeLessThanOrEqual(40);
    expect(box.right).toBeGreaterThanOrEqual(160);
    expect(box.bottom).toBeGreaterThanOrEqual(170);
  });
  it("is null when the page already fills the frame (nothing to crop) or there is no page", () => {
    expect(pageBox({ data: new Uint8Array(100 * 100).fill(240), width: 100, height: 100 }, 0.4)).toBeNull();
    expect(pageBox({ data: new Uint8Array(100 * 100).fill(10), width: 100, height: 100 }, 0.4)).toBeNull();
  });
});

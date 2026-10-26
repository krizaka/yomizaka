import { describe, expect, it } from "vitest";

import { imageSize, isHeif } from "./image-size";

const png = (w: number, h: number) => {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
};

/** A JPEG header: SOI, then segments (marker, payload), then a start-of-frame of the given marker. */
const jpeg = (segments: [number, number[]][], sof: number, w: number, h: number, pad = 0) => {
  const out: number[] = [0xff, 0xd8];
  for (const [marker, payload] of segments) out.push(0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload);
  for (let i = 0; i < pad; i++) out.push(0xff);
  out.push(0xff, sof, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  return Buffer.from(out);
};

describe("imageSize (read from the header, never decoded)", () => {
  it("reads a PNG's IHDR", () => {
    expect(imageSize(png(640, 480))).toEqual({ width: 640, height: 480 });
  });

  it("walks a JPEG's segments to its first start-of-frame", () => {
    expect(imageSize(jpeg([[0xe0, [1, 2, 3, 4]], [0xdb, [0, 0, 0]]], 0xc0, 1200, 800))).toEqual({ width: 1200, height: 800 });
    expect(imageSize(jpeg([], 0xc2, 3000, 2000))).toEqual({ width: 3000, height: 2000 });
  });

  it("skips fill bytes, and never takes a DHT, JPG or DAC marker for a frame", () => {
    expect(imageSize(jpeg([], 0xc0, 10, 20, 3))).toEqual({ width: 10, height: 20 });
    for (const marker of [0xc4, 0xc8, 0xcc]) expect(imageSize(jpeg([], marker, 10, 20))).toBeNull();
  });

  it("answers null for a broken segment chain, a short file or something else", () => {
    expect(imageSize(Buffer.from([0xff, 0xd8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))).toBeNull();
    expect(imageSize(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(imageSize(Buffer.from("hello world, not an image at all"))).toBeNull();
  });
});

describe("isHeif", () => {
  const box = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftyp"), Buffer.from(brand), Buffer.alloc(8)]);
  it("is an ftyp box with a HEIF major brand", () => {
    expect(isHeif(box("heic"))).toBe(true);
    expect(isHeif(box("mif1"))).toBe(true);
    expect(isHeif(box("isom"))).toBe(false);
    expect(isHeif(Buffer.from("short"))).toBe(false);
  });
});

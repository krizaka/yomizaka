import { readFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { squareAvatar } from "./avatar";
import { photoOfPage } from "./fixtures";
import { ImageError } from "./port";

/** An avatar from a photo: square, small, upright, with no metadata (Loi 25: a collection's picture must not carry a GPS position or a device). */
describe("a square avatar", () => {
  it("is cropped square at the size asked, upright, and carries no metadata", async () => {
    const out = await squareAvatar({ bytes: await photoOfPage({ orientation: 6, editor: "Adobe Photoshop" }), kind: "jpeg" }, 256);
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([256, 256]);
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(Buffer.from(out).includes(Buffer.from("Photoshop"))).toBe(false);
  });

  it("reads a PNG with transparency (flattened on white) and a HEIC", async () => {
    const png = await sharp({ create: { width: 40, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const flat = await squareAvatar({ bytes: new Uint8Array(png), kind: "png" }, 64);
    const { data } = await sharp(flat).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(240);
    const heic = await squareAvatar({ bytes: new Uint8Array(readFileSync(join(__dirname, "samples", "page.heic"))), kind: "heic" }, 128);
    expect((await sharp(heic).metadata()).width).toBe(128);
  });

  it("is deterministic, and refuses bytes that are not the image they claim, with a stable code", async () => {
    const bytes = await photoOfPage({ degrees: 3 });
    expect(Buffer.from(await squareAvatar({ bytes, kind: "jpeg" }, 128)).equals(Buffer.from(await squareAvatar({ bytes, kind: "jpeg" }, 128)))).toBe(true);
    await expect(squareAvatar({ bytes: new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), kind: "jpeg" }, 128)).rejects.toBeInstanceOf(ImageError);
  });
});

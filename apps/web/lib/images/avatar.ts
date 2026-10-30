import sharp from "sharp";

import { decodeHeic } from "./clean";
import { ImageError, PHOTO_KIND, type PhotoInput } from "./port";

/**
 * A picture for an avatar: the camera's orientation applied, cropped square on what matters (sharp's attention crop), set to
 * `size` pixels, flattened on white, as a JPEG — and no metadata at all (sharp keeps none unless asked), so a collection's picture
 * never carries a position or a device (Loi 25). Deterministic.
 */
export async function squareAvatar(input: PhotoInput, size: number): Promise<Uint8Array> {
  try {
    const base =
      input.kind === PHOTO_KIND.heic
        ? await decodeHeic(input.bytes)
        : sharp(Buffer.from(input.bytes), { failOn: "error", limitInputPixels: 80_000_000 });
    const out = await base
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize(size, size, { fit: "cover", position: sharp.strategy.attention })
      .jpeg({ quality: 85 })
      .toBuffer();
    return new Uint8Array(out);
  } catch {
    throw new ImageError("UNREADABLE_IMAGE");
  }
}

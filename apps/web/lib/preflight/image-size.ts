type Size = { width: number; height: number };

/** A start-of-frame marker: SOF0–SOF15, but not DHT (0xc4), JPG (0xc8) or DAC (0xcc). */
const isFrameMarker = (marker: number) => marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

/** JPEG: walk the marker segments to the first start-of-frame. */
function jpegSize(bytes: Uint8Array, view: DataView): Size | null {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (isFrameMarker(marker)) return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
    i += 2 + view.getUint16(i + 2);
  }
  return null;
}

/** The pixel size an image's header declares — read from the bytes, never decoded (a decompression bomb is refused before any decoder runs). */
export function imageSize(bytes: Uint8Array): Size | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // PNG: the IHDR chunk follows the 8-byte signature and its 8-byte chunk header.
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47)
    return { width: view.getUint32(16), height: view.getUint32(20) };
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 ? jpegSize(bytes, view) : null;
}

/** HEIC and HEIF are ISO base media files: an « ftyp » box whose major brand is one of these. */
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);
export function isHeif(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(4, 8)).toString("latin1") === "ftyp" &&
    HEIF_BRANDS.has(Buffer.from(bytes.subarray(8, 12)).toString("latin1"))
  );
}

import sharp from "sharp";

/** The text of the fictional lease the photo fixtures show (nothing here is a real document). */
export const LEASE_LINES = [
  "BAIL DE LOGEMENT",
  "Le locateur loue au locataire le logement situé au",
  "123 rue Exemple, Montréal (Québec) H2X 1Y1.",
  "Loyer mensuel : 1 150,00 $ payable le premier du mois.",
];

/** A flat « scan » of the page: black text on white. */
export function pageSvg(lines: readonly string[] = LEASE_LINES, width = 1200, height = 520): Buffer {
  const text = lines
    .map(
      (l, i) =>
        `<text x="50" y="${90 + i * 100}" font-family="Helvetica, Arial, DejaVu Sans, sans-serif" font-size="42" fill="#111">${l.replaceAll("&", "&amp;")}</text>`,
    )
    .join("");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/>${text}</svg>`,
  );
}

/** The page photographed on a dark desk: turned by `degrees`, with a camera's metadata (a device, an editor and a GPS position). */
export async function photoOfPage(
  options: { degrees?: number; orientation?: number; editor?: string; format?: "jpeg" | "png" } = {},
): Promise<Uint8Array> {
  const { degrees = 0, orientation, editor, format = "jpeg" } = options;
  const flat = await sharp(pageSvg()).png().toBuffer();
  const turned = await sharp(flat).rotate(degrees, { background: "#1a1a1a" }).png().toBuffer();
  const { width, height } = await sharp(turned).metadata();
  const desk = await sharp({
    create: { width: width! + 240, height: height! + 240, channels: 3, background: "#1a1a1a" },
  })
    .composite([{ input: turned, left: 120, top: 120 }])
    .png()
    .toBuffer();
  const exif = {
    IFD0: { Make: "Apple", Model: "Apple iPhone 15", ...(editor ? { Software: editor } : {}) },
    IFD3: { GPSLatitudeRef: "N", GPSLatitude: "45/1 30/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "73/1 34/1 0/1" },
  };
  let image = sharp(desk).withExif(exif);
  if (orientation) image = image.withMetadata({ orientation });
  return new Uint8Array(await (format === "png" ? image.png() : image.jpeg({ quality: 90 })).toBuffer());
}

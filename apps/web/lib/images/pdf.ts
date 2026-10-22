import { PDFDocument } from "pdf-lib";

import type { CleanedPage } from "./port";

const LETTER = { width: 612, height: 792 };
const FIXED_DATE = new Date("2000-01-01T00:00:00Z");

/**
 * Several cleaned pages make ONE document: a PDF, one page per photo, in the order given. Deterministic — no clock, no random
 * identifier — so the same photos give the same bytes (and the pre-flight's duplicate check recognises them). Its producer says
 * what it is, so nobody mistakes it for a document someone else issued.
 */
export async function pagesToPdf(pages: readonly CleanedPage[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setProducer("Yomizaka (photos assembled into one document)");
  doc.setCreator("Yomizaka");
  doc.setTitle("");
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  for (const p of pages) {
    const image = await doc.embedJpg(p.jpeg);
    const scale = Math.min(LETTER.width / image.width, LETTER.height / image.height);
    const [w, h] = [image.width * scale, image.height * scale];
    doc.addPage([w, h]).drawImage(image, { x: 0, y: 0, width: w, height: h });
  }
  return doc.save({ useObjectStreams: false });
}

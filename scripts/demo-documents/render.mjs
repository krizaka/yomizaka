import { createRequire } from "node:module";

// pdf-lib is a dependency of apps/web (pnpm keeps it there): resolve it from that package.
const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { PDFDocument, StandardFonts, degrees, rgb } = require("pdf-lib");

export const WATERMARK = "SPÉCIMEN — document fictif";
const LINES_PER_PAGE = 44;
const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z");

/** How many pages `renderPdf` makes of these lines. */
export const pageCount = (lines) => Math.max(1, Math.ceil(lines.length / LINES_PER_PAGE));

/** Renders lines of text as a PDF (Helvetica, A4-ish) with the watermark on every page. Deterministic: no clock, no random id. */
export async function renderPdf(title, lines) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.setTitle(title);
  pdf.setProducer("Yomizaka demo-documents");
  pdf.setCreator("Yomizaka demo-documents");
  pdf.setCreationDate(FIXED_DATE);
  pdf.setModificationDate(FIXED_DATE);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE));
  if (pages.length === 0) pages.push([]);
  for (const chunk of pages) {
    const page = pdf.addPage([612, 792]);
    chunk.forEach((line, n) => {
      if (line) page.drawText(line, { x: 56, y: 730 - n * 15, size: 10.5, font, color: rgb(0.1, 0.1, 0.12) });
    });
    page.drawText(WATERMARK, { x: 70, y: 250, size: 34, font: bold, color: rgb(0.8, 0.2, 0.2), opacity: 0.28, rotate: degrees(35) });
    page.drawText(WATERMARK, { x: 56, y: 28, size: 9, font, color: rgb(0.5, 0.1, 0.1) });
  }
  return pdf.save({ useObjectStreams: false });
}

/**
 * Reading a file's text layer — deterministic parsing, no model: a PDF's embedded text (pdf.js, through unpdf) or a text
 * file as UTF-8. It is the input of Orazaka's compliance Studio and of search. A scanned PDF has no text layer: `text`
 * is empty and the page says so (reading an image is an analysis — it would be Orazaka's, never done here).
 */
export interface ReadText {
  text: string;
  pages: number | null;
}

/** Collapses the PDF's layout whitespace, keeps line breaks (a clause stays on its line). */
export function normaliseText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v\u00a0]+/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function readText(mimeType: "application/pdf" | "text/plain", bytes: Uint8Array): Promise<ReadText> {
  if (mimeType === "text/plain") return { text: normaliseText(new TextDecoder("utf-8", { fatal: false }).decode(bytes)), pages: null };
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { text: normaliseText(Array.isArray(text) ? text.join("\n") : text), pages: totalPages };
}

/** A PDF starts with `%PDF-` — what is checked, not what the browser declared. */
export const looksLikePdf = (bytes: Uint8Array) => bytes.length > 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";

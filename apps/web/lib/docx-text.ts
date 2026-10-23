import { inflateRawSync } from "node:zlib";

import { zipEntries } from "./preflight/inspector";

/**
 * The text of a Word file (.docx), read without a library and without a model (yomizaka#229): the main part
 * `word/document.xml`, its paragraphs one per line, its tabs and breaks kept, its markup and its fields' codes dropped.
 * The pre-flight already refused a bomb, a macro or an ActiveX control; the inflate is bounded again here.
 */
const DOCUMENT_PART = "word/document.xml";
// @fixed: the largest main part inflated — far above a long contract's text, below anything that could hurt the server.
const MAX_PART_BYTES = 20 * 1024 * 1024;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) =>
    code[0] === "#" ? String.fromCodePoint(code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)) : (ENTITIES[code] ?? whole),
  );

/** The bytes of one stored or deflated zip entry, found through the central directory; null when absent or unreadable. */
function entryBytes(bytes: Uint8Array, name: string): Buffer | null {
  const entries = zipEntries(bytes);
  const entry = entries?.find((e) => e.name === name);
  if (!entry || entry.uncompressed > MAX_PART_BYTES) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.offset;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50) return null;
  const method = view.getUint16(at + 8, true);
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const data = Buffer.from(bytes.subarray(start, start + entry.compressed));
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data, { maxOutputLength: MAX_PART_BYTES });
  return null;
}

/** What makes the text: a run's text, a tab, a break, the end of a paragraph — everything else (markup, layout whitespace) is not read. */
const TEXT_TOKENS = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:(?:br|cr)\b[^>]*\/>|<\/w:p>/g;

export function docxText(bytes: Uint8Array): string {
  // A field's code (« PAGE », « HYPERLINK … ») is not text a reader sees.
  const xml = (entryBytes(bytes, DOCUMENT_PART)?.toString("utf8") ?? "").replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, "");
  let text = "";
  for (const [token, run] of xml.matchAll(TEXT_TOKENS)) {
    if (run !== undefined) text += decode(run);
    else if (token === "<w:tab/>") text += "\t";
    else text += "\n";
  }
  return text;
}

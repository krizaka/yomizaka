import { MAX_OFFICE_PART_BYTES, zipEntryBytes } from "./preflight/inspector";

/**
 * The text of a Word file (.docx), read without a library and without a model (yomizaka#229): the main part
 * `word/document.xml`, its paragraphs one per line, its tabs and breaks kept, its markup and its fields' codes dropped.
 * The pre-flight already refused a bomb, a macro or an ActiveX control; the inflate is bounded again here.
 */
const DOCUMENT_PART = "word/document.xml";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) =>
    code[0] === "#" ? String.fromCodePoint(code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)) : (ENTITIES[code] ?? whole),
  );

/** What makes the text: a run's text, a tab, a break, the end of a paragraph — everything else (markup, layout whitespace) is not read. */
const TEXT_TOKENS = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:(?:br|cr)\b[^>]*\/>|<\/w:p>/g;

export function docxText(bytes: Uint8Array): string {
  // A field's code (« PAGE », « HYPERLINK … ») is not text a reader sees.
  const xml = (zipEntryBytes(bytes, DOCUMENT_PART, MAX_OFFICE_PART_BYTES)?.toString("utf8") ?? "").replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, "");
  let text = "";
  for (const [token, run] of xml.matchAll(TEXT_TOKENS)) {
    if (run !== undefined) text += decode(run);
    else if (token === "<w:tab/>") text += "\t";
    else text += "\n";
  }
  return text;
}

/** OpenDocument's content.xml: headings and paragraphs, with inline text, tabs and line breaks kept. */
export function odtText(bytes: Uint8Array): string {
  const xml = zipEntryBytes(bytes, "content.xml", MAX_OFFICE_PART_BYTES)?.toString("utf8") ?? "";
  let text = "";
  let paragraphs = 0;
  let history = 0;
  for (const [token, closing, name, run] of xml.matchAll(/<(\/?)(text:(?:p|h|tracked-changes|s|tab|line-break|note|note-citation))(?=[\s/>])[^<>]*>|<[^<>]*>|([^<]+)/g)) {
    const empty = token.endsWith("/>");
    if (name === "text:tracked-changes") {
      history = Math.max(0, history + (closing ? -1 : empty ? 0 : 1));
      continue;
    }
    if (history) continue;
    if (name === "text:p" || name === "text:h") {
      if (closing || empty) text += "\n";
      if (!empty) paragraphs = Math.max(0, paragraphs + (closing ? -1 : 1));
    } else if (name === "text:note" || name === "text:note-citation") {
      text += "\n";
    } else if (paragraphs) {
      if (run !== undefined) text += decode(run);
      else if (!closing && name === "text:tab") text += "\t";
      else if (!closing && name === "text:line-break") text += "\n";
      else if (!closing && name === "text:s") text += " ";
    }
  }
  return text;
}

import crypto from "node:crypto";
import { inflateRawSync } from "node:zlib";

import { ODT_MIME } from "@yomizaka/core";
import { EncryptedPDFError, PDFArray, PDFDict, PDFDocument, PDFName } from "pdf-lib";

import { imageSize, isHeif } from "./image-size";
import type { DocumentPreflight, FileKind, Inspection, PdfFacts, PreflightRules, RejectReason } from "./port";

/**
 * The pre-flight inspector: pure and deterministic, no network, no model, nothing executed or rendered. A PDF is read as
 * bytes and as an object tree (pdf-lib); an archive's directory is read, only its bounded mimetype entry inflated.
 */
const ascii = (bytes: Uint8Array, from: number, to: number) => Buffer.from(bytes.subarray(from, to)).toString("latin1");
const startsWith = (bytes: Uint8Array, signature: readonly number[]) => signature.every((b, i) => bytes[i] === b);
// @fixed: cap the inflated main XML part independently of archive directory claims and workspace limits.
export const MAX_OFFICE_PART_BYTES = 20 * 1024 * 1024;

/** What the bytes are — not what the name or the browser said. */
export function sniff(bytes: Uint8Array): FileKind {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  if (startsWith(bytes, [0x4d, 0x5a]) || startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46]) || startsWith(bytes, [0x23, 0x21]) || startsWith(bytes, [0xcf, 0xfa, 0xed, 0xfe]) || startsWith(bytes, [0xca, 0xfe, 0xba, 0xbe])) return "executable";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (isHeif(bytes)) return "heic";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (zipEntryBytes(bytes, "mimetype", ODT_MIME.length)?.toString("utf8") === ODT_MIME) return "odt";
    return isDocx(bytes) ? "docx" : "zip";
  }
  if (bytes.includes(0)) return "unknown";
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "text";
  } catch {
    return "unknown";
  }
}

const EXTENSIONS: Record<FileKind, readonly string[]> = { pdf: ["pdf"], text: ["txt", "text", "md"], png: ["png"], jpeg: ["jpg", "jpeg"], heic: ["heic", "heif"], docx: ["docx"], odt: ["odt"], zip: ["zip"], executable: [], unknown: [] };
const MIME: Record<string, FileKind> = { "application/pdf": "pdf", "text/plain": "text", "image/png": "png", "image/jpeg": "jpeg", "image/heic": "heic", "image/heif": "heic", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", [ODT_MIME]: "odt", "application/zip": "zip" };

/** The kind the client claims (extension first, then MIME type), or null when it claims nothing we know. */
function claimed(declared: { name: string; type: string }): FileKind | null {
  const ext = /\.([a-z0-9]+)$/i.exec(declared.name)?.[1]?.toLowerCase();
  for (const [kind, exts] of Object.entries(EXTENSIONS)) if (ext && exts.includes(ext)) return kind as FileKind;
  return MIME[declared.type] ?? null;
}

interface ZipEntry {
  name: string;
  compressed: number;
  uncompressed: number;
  /** Where its local header starts, for bounded entry reads. */
  offset: number;
}

/** The central directory of a zip, read without inflating anything. Null when it cannot be read. */
export function zipEntries(bytes: Uint8Array): ZipEntry[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lowest = Math.max(0, bytes.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= lowest; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) return null;
    const nameLength = view.getUint16(offset + 28, true);
    const extra = view.getUint16(offset + 30, true);
    const comment = view.getUint16(offset + 32, true);
    entries.push({ compressed: view.getUint32(offset + 20, true), uncompressed: view.getUint32(offset + 24, true), offset: view.getUint32(offset + 42, true), name: Buffer.from(bytes.subarray(offset + 46, offset + 46 + nameLength)).toString("utf8") });
    offset += 46 + nameLength + extra + comment;
  }
  return entries;
}

/** One stored or deflated entry, bounded independently of the sizes claimed by the directory. */
export function zipEntryBytes(bytes: Uint8Array, name: string, maxBytes: number): Buffer | null {
  const entry = zipEntries(bytes)?.find((e) => e.name === name);
  if (!entry || entry.uncompressed > maxBytes) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.offset;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50) return null;
  const method = view.getUint16(at + 8, true);
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  if (start + entry.compressed > bytes.length) return null;
  const data = bytes.subarray(start, start + entry.compressed);
  try {
    const result = method === 0 ? (data.length <= maxBytes ? Buffer.from(data) : null)
      : method === 8 ? inflateRawSync(data, { maxOutputLength: maxBytes }) : null;
    return result?.length === entry.uncompressed ? result : null;
  } catch {
    return null;
  }
}

function isDocx(bytes: Uint8Array): boolean {
  const names = zipEntries(bytes)?.map((e) => e.name) ?? [];
  return names.includes("[Content_Types].xml") && names.some((n) => n.startsWith("word/"));
}

/** `/Name` tokens of a PDF's raw bytes, with `#xx` escapes decoded (an obfuscated /J#61vaScript is still JavaScript). */
function pdfNames(raw: string): Set<string> {
  const names = new Set<string>();
  for (const m of raw.matchAll(/\/([A-Za-z0-9_#.+-]{1,40})/g)) names.add(m[1]!.replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))));
  return names;
}

function pdfFacts(doc: PDFDocument, raw: string): PdfFacts {
  return {
    producer: doc.getProducer() ?? null,
    creator: doc.getCreator() ?? null,
    creationDate: doc.getCreationDate()?.toISOString() ?? null,
    modificationDate: doc.getModificationDate()?.toISOString() ?? null,
    incrementalSaves: Math.max(0, (raw.match(/%%EOF/g) ?? []).length - 1),
  };
}

/** Actions that run something, on the catalogue and on each annotation of the first pages — in object streams too. */
function treeHasActiveContent(doc: PDFDocument, active: ReadonlySet<string>, pageLimit: number): boolean {
  const catalog = doc.catalog;
  for (const key of ["OpenAction", "AA"]) if (active.has(key) && catalog.has(PDFName.of(key))) return true;
  const names = catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  if (names) for (const key of ["JavaScript", "EmbeddedFiles"]) if (active.has(key) && names.has(PDFName.of(key))) return true;
  for (const page of doc.getPages().slice(0, pageLimit)) {
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    for (let i = 0; annots && i < annots.size(); i++) {
      const action = annots.lookupMaybe(i, PDFDict)?.lookupMaybe(PDFName.of("A"), PDFDict);
      const type = action?.get(PDFName.of("S"))?.toString().slice(1);
      if (type && active.has(type)) return true;
    }
  }
  return false;
}

const reject = (reason: RejectReason, detail?: string): Inspection => ({ kind: "rejected", reason, ...(detail ? { detail } : {}) });

export function createInspector(rules: PreflightRules): DocumentPreflight {
  const active = new Set(rules.pdfActiveNames);
  return {
    async inspect(bytes, declared) {
      if (bytes.length === 0) return reject("EMPTY");
      if (bytes.length > rules.maxBytes) return reject("TOO_LARGE", String(bytes.length));
      const detected = sniff(bytes);
      if (detected === "executable") return reject("EXECUTABLE");
      const said = claimed(declared);
      if (said && said !== detected && !(said === "text" && detected === "unknown")) return reject("TYPE_MISMATCH", `${said} ≠ ${detected}`);
      if (detected === "zip" || detected === "docx" || detected === "odt") {
        const problem = archiveProblem(bytes, rules);
        if (problem) return reject(problem);
      }
      if (!rules.allowedKinds.includes(detected)) return reject("UNSUPPORTED_TYPE", detected);
      if (detected === "odt") {
        const xml = zipEntryBytes(bytes, "content.xml", MAX_OFFICE_PART_BYTES)?.toString("utf8");
        if (xml && /<(?:[\w.-]+:)?(?:script|event-listener)(?=[\s/>])/i.test(xml)) return reject("ACTIVE_CONTENT");
      }
      const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

      if (detected === "text") return { kind: "accepted", fileKind: "text", sha256, pages: null, facts: null };
      if (detected === "png" || detected === "jpeg" || detected === "heic") {
        const size = imageSize(bytes);
        if (size && size.width * size.height > rules.maxImagePixels) return reject("IMAGE_TOO_LARGE", `${size.width}x${size.height}`);
        return { kind: "accepted", fileKind: detected, sha256, pages: null, facts: null };
      }
      // An office file passed the archive guards above (no macro, no bomb): its pages are not counted (no layout here).
      if (detected === "docx" || detected === "odt") return { kind: "accepted", fileKind: detected, sha256, pages: null, facts: null };
      if (detected !== "pdf") return reject("UNSUPPORTED_TYPE", detected);

      const raw = ascii(bytes, 0, bytes.length);
      const tail = raw.slice(-2048);
      if (!/startxref/.test(tail) || !/%%EOF/.test(tail)) return reject("TRUNCATED");
      const found = [...pdfNames(raw)].filter((n) => active.has(n));
      if (pdfNames(raw).has("Encrypt")) return reject("ENCRYPTED");
      if (found.length) return reject("ACTIVE_CONTENT", found.sort().join(", "));
      let doc: PDFDocument;
      try {
        doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
      } catch (error) {
        return error instanceof EncryptedPDFError ? reject("ENCRYPTED") : reject("CORRUPT");
      }
      let pages: number;
      try {
        pages = doc.getPageCount();
      } catch {
        return reject("CORRUPT", "page tree");
      }
      if (pages < 1) return reject("CORRUPT", "no page");
      if (pages > rules.maxPages) return reject("TOO_MANY_PAGES", String(pages));
      try {
        if (treeHasActiveContent(doc, active, rules.maxPages)) return reject("ACTIVE_CONTENT", "object tree");
      } catch {
        return reject("CORRUPT", "object tree");
      }
      return { kind: "accepted", fileKind: "pdf", sha256, pages, facts: pdfFacts(doc, raw) };
    },
  };
}

/** The archive guards: entries, total size, ratio — from the directory alone, never inflating. */
export function archiveProblem(bytes: Uint8Array, rules: PreflightRules): RejectReason | null {
  const entries = zipEntries(bytes);
  if (!entries) return "CORRUPT";
  if (entries.length > rules.maxArchiveEntries) return "ARCHIVE_BOMB";
  const total = entries.reduce((sum, e) => sum + e.uncompressed, 0);
  if (total > rules.maxArchiveBytes) return "ARCHIVE_BOMB";
  if (entries.some((e) => e.compressed > 0 && e.uncompressed / e.compressed > rules.maxArchiveRatio)) return "ARCHIVE_BOMB";
  if (entries.some((e) => /vbaProject\.bin$|ActiveX|\.exe$|^(?:Basic|Scripts)\//i.test(e.name))) return "ACTIVE_CONTENT";
  return null;
}

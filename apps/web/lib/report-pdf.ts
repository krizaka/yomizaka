import crypto from "node:crypto";

import { PDFDict, PDFDocument, type PDFFont, PDFName, PDFString, rgb, StandardFonts } from "pdf-lib";
import { z } from "zod";

import { LINE, type LineKind, noteLines } from "./closing-note/render";
import { type Attestation, fill, REPORT_SCHEMA, type ReportLabels, type ReportPayload, reportPayload, sha256, signedMessage, type Verification, type VerifyFailure } from "./report";
import { type SigningKey } from "./report-key";
import { SITE_URL } from "./site";

/*
 * The signed PDF report of a compliance check — for the owner and the members the owner gave access to (ADR-0002).
 *
 * The same attestation as the HTML report, in a file people print and file: the report's pages, then a visible signature
 * page. What is signed is the canonical JSON `payload` and the SHA-256 of the report's TEXT (every page before the
 * signature page); the attestation is embedded in the PDF (its Info dictionary, key `YomizakaAttestation`, base64 JSON).
 * Verification reads it back, checks the Ed25519 signature, then extracts the text of the pages with pdf.js and compares
 * it: a changed word on any page is `ALTERED`. Deterministic: the same payload and labels give the same bytes.
 *
 * It does NOT sign the PDF's bytes (a viewer that re-saves a file changes them): it signs what the file says.
 */
export const ATTESTATION_KEY = "YomizakaAttestation";
const PAGE = { w: 595.28, h: 841.89, margin: 56 };

/** How each kind of line of the closing note is printed. */
const NOTE_STYLE: Record<LineKind, { size: number; bold?: boolean; gap?: number }> = {
  [LINE.title]: { size: 12, bold: true, gap: 2 },
  [LINE.heading]: { size: 10, bold: true, gap: 1 },
  [LINE.text]: { size: 9 },
  [LINE.item]: { size: 9 },
  [LINE.note]: { size: 9, bold: true, gap: 4 },
};

type Block = { text: string; size: number; bold?: boolean; mono?: boolean; gap?: number };

const block = (text: string, size = 10, extra: Partial<Block> = {}): Block => ({ text, size, ...extra });
/** An optional piece of a line, or nothing: keeps the conditionals out of the template literals. */
const optional = (present: boolean, text: string) => (present ? text : "");

/** The top of the report: who says what, the disclaimer, the summary and the review notices. */
function headerBlocks(payload: ReportPayload, labels: ReportLabels): Block[] {
  const blocks = [
    block(labels.eyebrow!, 8, { gap: 2 }),
    block(payload.document.title, 18, { bold: true, gap: 6 }),
    block(labels.disclaimer!, 10, { bold: true, gap: 8 }),
    block(fill(labels.summary!, { failures: payload.summary.blockingFailures, rules: payload.summary.rulesEvaluated }), 10, { gap: 8 }),
  ];
  if (payload.check.reviewStatus) blocks.push(block(labels.toReview!, 9, { gap: 8 }));
  if (payload.check.rulesetId === "qc-service-contract") blocks.push(block(labels.notCheckedServiceContract!, 9, { bold: true, gap: 8 }));
  return blocks;
}

/** The document that was checked: its file, size and fingerprint. */
function documentBlocks(payload: ReportPayload, labels: ReportLabels): Block[] {
  const d = payload.document;
  const pages = optional(!!d.pages, ` · ${d.pages} p.`);
  return [
    block(labels.documentHeading!, 12, { bold: true, gap: 2 }),
    block(`${labels.file}: ${d.filename}`, 9),
    block(`${labels.size}: ${d.sizeBytes} B${pages}`, 9),
    block(`${labels.documentSha}: ${d.sha256}`, 8, { mono: true, gap: 8 }),
  ];
}

/** The check that was run: engine, run id, jurisdiction, ruleset, times. */
function checkBlocks(payload: ReportPayload, labels: ReportLabels): Block[] {
  const c = payload.check;
  const version = optional(!!c.studioVersion, ` ${c.studioVersion}`);
  const revision = optional(c.rulesetRevision !== null, ` (rev. ${c.rulesetRevision})`);
  return [
    block(labels.checkHeading!, 12, { bold: true, gap: 2 }),
    block(`${labels.engine}: ${c.engine} · ${c.studio}${version}`, 9),
    block(`${labels.runId}: ${c.runId}`, 8, { mono: true }),
    block(`${labels.jurisdiction}: ${c.jurisdiction}`, 9),
    block(`${labels.asOf}: ${c.asOf}`, 9),
    block(`${labels.ruleset}: ${c.rulesetId} · ${c.rulesetVersion}${revision}`, 9),
    block(`${labels.model}: ${labels.modelValue}`, 9),
    block(`${labels.started}: ${c.startedAt}`, 9),
    block(`${labels.finished}: ${c.finishedAt}`, 9, { gap: 8 }),
  ];
}

/** One finding: its verdict, explanation, rule, citation and the passage it rests on. */
function findingBlocks(f: ReportPayload["findings"][number], labels: ReportLabels): Block[] {
  const method = optional(!!f.method, ` · ${f.method}`);
  const passage = f.quote ? `« ${f.quote} »` : labels.noPassage;
  const verdict = labels[`verdict.${f.verdict}`] ?? f.verdict;
  const blocks = [
    block(`${f.title ?? f.ruleId} — ${verdict}`, 10, { bold: true, gap: 1 }),
    block(f.explanation, 9),
    block(`${labels.rule}: ${f.ruleId} · ${f.severity}${method}`, 8),
  ];
  if (f.citation) blocks.push(block(`${labels.article}: ${f.citation}`, 8));
  blocks.push(block(`${labels.passage}: ${passage}`, 8, { gap: 6 }));
  return blocks;
}

/** The closing note, line by line, in the style of each kind of line. */
function noteBlocks(note: NonNullable<ReportPayload["note"]>): Block[] {
  return noteLines(note).map(({ kind, text }) => block(kind === LINE.item ? `- ${text}` : text, NOTE_STYLE[kind].size, NOTE_STYLE[kind]));
}

/** What the signature guarantees and does not, how to verify, the footer. */
function guaranteeBlocks(labels: ReportLabels): Block[] {
  return [
    block(labels.guaranteeHeading!, 12, { bold: true, gap: 2 }),
    block(labels.guarantees!, 9),
    block(labels.notGuaranteed!, 9),
    block(fill(labels.howToVerify!, { url: `${SITE_URL}/app/verifications/report` }), 9),
    block(labels.footer!, 8),
  ];
}

/** The report's text, in reading order: what the pages print and what the signature covers. */
export function reportBlocks(payload: ReportPayload, labels: ReportLabels): Block[] {
  return [
    ...headerBlocks(payload, labels),
    ...documentBlocks(payload, labels),
    ...checkBlocks(payload, labels),
    block(fill(labels.findingsHeading!, { count: payload.findings.length }), 12, { bold: true, gap: 2 }),
    ...payload.findings.flatMap((f) => findingBlocks(f, labels)),
    ...(payload.note ? noteBlocks(payload.note) : []),
    ...guaranteeBlocks(labels),
  ];
}

/** What French typography and common symbols become where the standard fonts have no glyph: their plain equivalent, not « ? ». */
const FOLD: Record<string, string> = { "\u202f": " ", "\u2009": " ", "\u2002": " ", "\u2003": " ", "\u2011": "-", "\u2212": "-", "\u2192": "->", "\u2190": "<-", "\u2265": ">=", "\u2264": "<=", "\u2713": "ok", "\u2714": "ok", "\u2717": "x", "\u2715": "x", "\u2022": "\u2022" };
export const foldToWinAnsi = (text: string) => [...text].map((ch) => FOLD[ch] ?? ch).join("");

/** A PDF's standard fonts print WinAnsi: what has no plain equivalent becomes « ? » — in the signed text too, so both sides agree. */
const printable = (text: string, font: PDFFont) => {
  const ok = font.getCharacterSet();
  return [...foldToWinAnsi(text.replace(/[\r\n\t]+/g, " "))].map((ch) => (ok.includes(ch.codePointAt(0)!) ? ch : "?")).join("");
};

/** The text the signature covers: the blocks, printable, with every whitespace removed (wrapping must not matter). */
export const signedText = (blocks: Block[], font: PDFFont) => blocks.map((b) => printable(b.text, font)).join("").replace(/\s+/g, "");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  const push = (w: string) => {
    // A single token wider than the line (a hash) is cut where it stops fitting.
    let rest = w;
    while (font.widthOfTextAtSize(rest, size) > width) {
      let n = rest.length;
      while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > width) n -= 1;
      lines.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
    line = rest;
  };
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= width) line = test;
    else {
      if (line) lines.push(line);
      push(word);
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface IssuedPdf {
  bytes: Uint8Array;
  /** SHA-256 of the file as delivered. */
  fileSha256: string;
  attestation: Attestation;
}

/** Lays out, hashes the text, signs, embeds. */
export async function issuePdf(payload: ReportPayload, labels: ReportLabels, key: SigningKey): Promise<IssuedPdf> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const blocks = reportBlocks(payload, labels);
  const width = PAGE.w - PAGE.margin * 2;
  let page = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - PAGE.margin;
  const draw = (text: string, size: number, f: PDFFont, gap: number) => {
    for (const line of wrap(text, f, size, width)) {
      if (y < PAGE.margin + size) {
        page = doc.addPage([PAGE.w, PAGE.h]);
        y = PAGE.h - PAGE.margin;
      }
      page.drawText(line, { x: PAGE.margin, y, size, font: f, color: rgb(0.08, 0.09, 0.12) });
      y -= size * 1.4;
    }
    y -= gap;
  };
  for (const b of blocks) draw(printable(b.text, font), b.size, b.mono ? mono : b.bold ? bold : font, b.gap ?? 4);
  const bodySha256 = sha256(signedText(blocks, font));
  const signature = crypto.sign(null, signedMessage(payload, bodySha256), key.privateKey).toString("base64");
  const attestation: Attestation = { schema: REPORT_SCHEMA, algorithm: "Ed25519", keyId: key.keyId, payload, bodySha256, signature };

  // The visible signature page — after the pages it covers, and not part of the signed text.
  page = doc.addPage([PAGE.w, PAGE.h]);
  y = PAGE.h - PAGE.margin;
  draw(printable(labels.signatureHeading!, font), 16, bold, 8);
  draw(printable(`${labels.signatureAlgorithm}: Ed25519`, font), 10, font, 2);
  draw(printable(`${labels.signatureKey}: ${key.keyId}`, font), 9, mono, 2);
  draw(printable(`${labels.documentSha}: ${payload.document.sha256}`, font), 8, mono, 2);
  draw(printable(`${labels.runId}: ${payload.check.runId}`, font), 8, mono, 2);
  draw(printable(`${labels.signatureBody}: ${bodySha256}`, font), 8, mono, 2);
  draw(printable(`${labels.signatureValue}: ${signature}`, font), 8, mono, 10);
  draw(printable(labels.signatureNote!, font), 9, font, 4);

  const finished = new Date(payload.check.finishedAt);
  doc.setTitle(payload.document.title);
  doc.setSubject(`Yomizaka — ${payload.check.runId}`);
  doc.setProducer("Yomizaka");
  doc.setCreator("Yomizaka");
  doc.setCreationDate(finished);
  doc.setModificationDate(finished);
  const info = doc.context.lookup(doc.context.trailerInfo.Info, PDFDict);
  info.set(PDFName.of(ATTESTATION_KEY), PDFString.of(Buffer.from(JSON.stringify(attestation), "utf8").toString("base64")));
  const bytes = await doc.save({ useObjectStreams: false });
  return { bytes, fileSha256: sha256(bytes), attestation };
}

const attestationSchema = z.object({ schema: z.literal(REPORT_SCHEMA), algorithm: z.literal("Ed25519"), keyId: z.string(), payload: reportPayload, bodySha256: z.string().regex(/^[0-9a-f]{64}$/), signature: z.string() });

/** The attestation a PDF carries (not checked), or null — never throws on hostile input. */
export async function attestationOfPdf(bytes: Uint8Array): Promise<Attestation | null> {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const info = doc.context.lookup(doc.context.trailerInfo.Info, PDFDict);
    const raw = info.get(PDFName.of(ATTESTATION_KEY));
    if (!(raw instanceof PDFString)) return null;
    return attestationSchema.parse(JSON.parse(Buffer.from(raw.asString(), "base64").toString("utf8"))) as Attestation;
  } catch {
    return null;
  }
}

/** Checks a PDF report like `verifyReport` checks an HTML one — signature first, then the text of the pages, then a specimen is refused. */
export async function verifyPdf(bytes: Uint8Array, key: Pick<SigningKey, "keyId" | "publicKey">, document?: Uint8Array | null): Promise<Verification> {
  const fileSha256 = sha256(bytes);
  const fail = (reason: VerifyFailure): Verification => ({ ok: false, reason, fileSha256 });
  if (!(bytes.length > 5 && Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-")) return fail("NOT_A_REPORT");
  const attestation = await attestationOfPdf(bytes);
  if (!attestation) return fail("UNREADABLE");
  if (attestation.keyId !== key.keyId) return fail("UNKNOWN_KEY");
  if (!crypto.verify(null, signedMessage(attestation.payload, attestation.bodySha256), key.publicKey, Buffer.from(attestation.signature, "base64"))) return fail("BAD_SIGNATURE");
  // The pages the signature covers: every page but the last (the visible signature page).
  const { extractText, getDocumentProxy } = await import("unpdf");
  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const pages = (await extractText(pdf, { mergePages: false })).text as string[];
    text = pages.slice(0, -1).join("").replace(/\s+/g, "");
  } catch {
    return fail("UNREADABLE");
  }
  if (sha256(text) !== attestation.bodySha256) return fail("ALTERED");
  if (attestation.payload.specimen) return fail("SPECIMEN");
  return { ok: true, fileSha256, keyId: attestation.keyId, payload: attestation.payload, documentMatch: document ? sha256(document) === attestation.payload.document.sha256 : null };
}


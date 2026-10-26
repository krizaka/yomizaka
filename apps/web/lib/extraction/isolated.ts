import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";

const require = createRequire(import.meta.url);

/**
 * The PDF's text layer, read OFF the web process (yomizaka#21). pdf.js is CPU-bound: read in the request it would hold the
 * event loop for seconds (health checks and page loads stall, App Platform answers 504), and a hostile file could exhaust the
 * heap and kill the whole container. Here it runs in a `node:worker_threads` worker with its own heap limit, a deadline and a
 * page ceiling: whatever goes wrong ends the worker, and the web process keeps serving.
 */
export type ExtractionFailure = "TIMEOUT" | "MEMORY" | "TOO_MANY_PAGES" | "FAILED";

export class ExtractionError extends Error {
  constructor(readonly code: ExtractionFailure) {
    super(`PDF extraction failed: ${code}`);
    this.name = "ExtractionError";
  }
}

export interface ExtractionLimits {
  /** The deadline of one file; the worker is ended when it passes. */
  timeoutMs: number;
  /** The worker's own old-generation heap, in MB: a decompression bomb ends the worker, not the process. */
  maxHeapMb: number;
  /** Pages read at most; a longer document is refused, not truncated. */
  maxPages: number;
}

/** 10 s, 384 MB, 150 pages — what the issue's guardrails say, inside the 512 MB container. */
export const DEFAULT_LIMITS: ExtractionLimits = { timeoutMs: 10_000, maxHeapMb: 384, maxPages: 150 };

type Answer = { ok: true; pages: number; text: string } | { ok: false; code: "TOO_MANY_PAGES" | "FAILED" };

/** The worker's program (CommonJS, run from a string: nothing to trace into the standalone image but `unpdf` itself, which is external). */
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
(async () => {
  const { extractText, getDocumentProxy } = require(workerData.unpdf);
  const pdf = await getDocumentProxy(new Uint8Array(workerData.bytes));
  if (pdf.numPages > workerData.maxPages) return parentPort.postMessage({ ok: false, code: "TOO_MANY_PAGES" });
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  parentPort.postMessage({ ok: true, pages: totalPages, text: Array.isArray(text) ? text.join("\\n") : text });
})().catch(() => parentPort.postMessage({ ok: false, code: "FAILED" }));
`;

/** Reads a PDF's text layer (as pdf.js gives it: normalising is the caller's) in an isolated worker. Rejects with an `ExtractionError`, never with a crash of this process. */
export function extractPdfText(bytes: Uint8Array, limits: Partial<ExtractionLimits> = {}): Promise<{ text: string; pages: number }> {
  const { timeoutMs, maxHeapMb, maxPages } = { ...DEFAULT_LIMITS, ...limits };
  return new Promise((resolve, reject) => {
    const copy = new Uint8Array(bytes).buffer; // the worker gets its own copy; the caller keeps its bytes
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { unpdf: require.resolve("unpdf"), bytes: copy, maxPages },
      resourceLimits: { maxOldGenerationSizeMb: maxHeapMb },
      transferList: [copy],
    });
    let settled = false;
    const end = (settle: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      void worker.terminate();
      settle();
    };
    const deadline = setTimeout(() => end(() => reject(new ExtractionError("TIMEOUT"))), timeoutMs);
    worker.once("message", (answer: Answer) =>
      end(() => (answer.ok ? resolve({ text: answer.text, pages: answer.pages }) : reject(new ExtractionError(answer.code)))),
    );
    worker.once("error", (error: NodeJS.ErrnoException) => end(() => reject(new ExtractionError(error.code === "ERR_WORKER_OUT_OF_MEMORY" ? "MEMORY" : "FAILED"))));
    worker.once("exit", () => end(() => reject(new ExtractionError("FAILED"))));
  });
}

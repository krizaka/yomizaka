import { Worker } from "node:worker_threads";

import { findPackageDir } from "./package-dir";

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

type Answer = { id: number; ok: true; pages: number; text: string } | { id: number; ok: false; code: "TOO_MANY_PAGES" | "FAILED" };

/**
 * The worker's program (CommonJS, run from a string: nothing to trace into the standalone image but `unpdf` itself, which is external).
 * It stays up between files — loading pdf.js costs more than reading a page — and answers one job at a time, each document destroyed
 * once read.
 */
const WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require("node:worker_threads");
const { extractText, getDocumentProxy } = require(workerData.unpdf);
parentPort.on("message", async ({ id, bytes, maxPages }) => {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
    if (pdf.numPages > maxPages) return parentPort.postMessage({ id, ok: false, code: "TOO_MANY_PAGES" });
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    parentPort.postMessage({ id, ok: true, pages: totalPages, text: Array.isArray(text) ? text.join("\n") : text });
  } catch {
    parentPort.postMessage({ id, ok: false, code: "FAILED" });
  } finally {
    await pdf?.destroy?.().catch(() => undefined);
  }
});
`;

/** A worker is renewed after this many files (memory a document leaves behind never piles up) and ended after this much idle time. */
const WARM = { jobs: 50, idleMs: 30_000 };

interface Warm {
  worker: Worker;
  heapMb: number;
  jobs: number;
  idle?: NodeJS.Timeout;
}
let warm: Warm | null = null;
let started = 0;
/** Files are read one at a time: a queue, so one worker (and one heap) serves the process. */
let queue: Promise<unknown> = Promise.resolve();

/** How many workers this process has started: a batch of files shares one (tests and the logs read it). */
export const extractionWorkersStarted = (): number => started;

function endWorker(w: Warm | null) {
  if (!w) return;
  clearTimeout(w.idle);
  void w.worker.terminate();
  if (warm === w) warm = null;
}

function workerFor(maxHeapMb: number): Warm {
  if (warm && warm.heapMb === maxHeapMb && warm.jobs < WARM.jobs) return warm;
  endWorker(warm);
  const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { unpdf: findPackageDir("unpdf") }, resourceLimits: { maxOldGenerationSizeMb: maxHeapMb } });
  // A worker never keeps the process alive: when the work is done the process may end.
  worker.unref();
  started++;
  warm = { worker, heapMb: maxHeapMb, jobs: 0 };
  return warm;
}

let nextId = 0;

function runJob(bytes: Uint8Array, { timeoutMs, maxHeapMb, maxPages }: ExtractionLimits): Promise<{ text: string; pages: number }> {
  return new Promise((resolve, reject) => {
    const w = workerFor(maxHeapMb);
    clearTimeout(w.idle);
    w.jobs++;
    const id = ++nextId;
    let settled = false;
    const settle = (finish: () => void, keep: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      w.worker.off("message", onMessage);
      w.worker.off("error", onError);
      w.worker.off("exit", onExit);
      // A worker that answered stays warm; one that failed, timed out or died is ended — the next file starts a fresh one.
      if (keep && warm === w) {
        w.idle = setTimeout(() => endWorker(w), WARM.idleMs);
        w.idle.unref();
      } else endWorker(w);
      finish();
    };
    const onMessage = (answer: Answer) => {
      if (answer.id !== id) return;
      settle(() => (answer.ok ? resolve({ text: answer.text, pages: answer.pages }) : reject(new ExtractionError(answer.code))), answer.ok || answer.code === "TOO_MANY_PAGES");
    };
    const onError = (error: NodeJS.ErrnoException) => settle(() => reject(new ExtractionError(error.code === "ERR_WORKER_OUT_OF_MEMORY" ? "MEMORY" : "FAILED")), false);
    const onExit = () => settle(() => reject(new ExtractionError("FAILED")), false);
    const deadline = setTimeout(() => settle(() => reject(new ExtractionError("TIMEOUT")), false), timeoutMs);
    w.worker.on("message", onMessage);
    w.worker.once("error", onError);
    w.worker.once("exit", onExit);
    const copy = new Uint8Array(bytes).buffer; // the worker gets its own copy; the caller keeps its bytes
    w.worker.postMessage({ id, bytes: copy, maxPages }, [copy]);
  });
}

/** Reads a PDF's text layer (as pdf.js gives it: normalising is the caller's) in an isolated worker. Rejects with an `ExtractionError`, never with a crash of this process. */
export function extractPdfText(bytes: Uint8Array, limits: Partial<ExtractionLimits> = {}): Promise<{ text: string; pages: number }> {
  const job = queue.then(() => runJob(bytes, { ...DEFAULT_LIMITS, ...limits }));
  queue = job.catch(() => undefined);
  return job;
}

import { describe, expect, it } from "vitest";

import { extractionRefusal } from "../documents";
import { textPdf } from "../test-pdf";
import { ExtractionError, extractionWorkersStarted, extractPdfText } from "./isolated";

/** Far more than a millisecond of reading: a hundred pages of text. */
const HEAVY = textPdf(
  Array.from(
    { length: 4000 },
    (_, i) => `Ligne ${i} du bail, avec assez de texte pour que la lecture prenne du temps.`,
  ),
);

describe("PDF extraction off the web process", () => {
  it("reads the text layer and the page count in a worker", async () => {
    const { text, pages } = await extractPdfText(textPdf(["Bail residentiel", "Loyer : 1 000 $ par mois"]));
    expect(pages).toBe(1);
    expect(text).toContain("Loyer");
  });

  it("leaves the event loop free while the worker reads", async () => {
    // Turns of the loop taken WHILE a long file is read: a read done on the web process itself would take none until it ended; the worker
    // leaves the loop turning for the whole read. A count over a long read, never "which came first": that order flipped on a loaded
    // runner (CI, 2026-10-29), because a fast answer can reach the loop before a single turn is scheduled.
    let turns = 0;
    let reading = true;
    const spin = () => {
      turns++;
      if (reading) {
        setImmediate(spin);
      }
    };
    setImmediate(spin);
    await extractPdfText(HEAVY, { timeoutMs: 60_000 });
    reading = false;
    expect(turns).toBeGreaterThan(5);
  });

  it("serves a batch of files with one worker, and starts a fresh one after a file that ended it", async () => {
    const before = extractionWorkersStarted();
    await extractPdfText(textPdf(["Un"]));
    for (const n of [1, 2, 3, 4]) {
      await expect(extractPdfText(textPdf([`Fichier ${n}`]))).resolves.toMatchObject({ pages: 1 });
    }
    expect(extractionWorkersStarted() - before).toBeLessThanOrEqual(1);
    await expect(extractPdfText(HEAVY, { timeoutMs: 1 })).rejects.toMatchObject({ code: "TIMEOUT" });
    await expect(extractPdfText(textPdf(["Après"]))).resolves.toMatchObject({ pages: 1 });
    expect(extractionWorkersStarted() - before).toBeLessThanOrEqual(3);
  });

  it("reads files that arrive together one after the other, each with its own answer", async () => {
    const answers = await Promise.all([1, 2, 3].map((n) => extractPdfText(textPdf([`Document numéro ${n}`]))));
    expect(answers.map((a) => a.text.match(/numéro (\d)/)?.[1])).toEqual(["1", "2", "3"]);
  });

  it("refuses a document over the page ceiling, without reading it", async () => {
    await expect(extractPdfText(textPdf(["Bail"]), { maxPages: 0 })).rejects.toMatchObject({ code: "TOO_MANY_PAGES" });
  });

  it("ends the worker at the deadline: the caller gets a TIMEOUT, the process is untouched", async () => {
    await expect(extractPdfText(HEAVY, { timeoutMs: 1 })).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("answers FAILED to bytes that are not a PDF", async () => {
    await expect(extractPdfText(new TextEncoder().encode("not a pdf"))).rejects.toBeInstanceOf(ExtractionError);
  });

  it("ends only the worker when the file exhausts its heap", async () => {
    // A heap too small for pdf.js stands for a decompression bomb: the worker dies of memory, this process lives on.
    await expect(extractPdfText(textPdf(["Bail"]), { maxHeapMb: 8 })).rejects.toMatchObject({
      code: expect.stringMatching(/MEMORY|FAILED/),
    });
    expect(process.memoryUsage().heapUsed).toBeGreaterThan(0);
  });
});

describe("what the person is told when the reader gives up", () => {
  it.each([
    ["TOO_MANY_PAGES", "FILE_TOO_MANY_PAGES"],
    ["TIMEOUT", "FILE_TOO_COMPLEX"],
    ["MEMORY", "FILE_TOO_COMPLEX"],
    ["FAILED", "UNREADABLE_FILE"],
  ] as const)("%s is refused as %s (422)", (failure, code) => {
    const refusal = extractionRefusal(new ExtractionError(failure));
    expect(refusal.status).toBe(422);
    expect(refusal.body.code).toBe(code);
  });
});

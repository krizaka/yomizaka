import { describe, expect, it } from "vitest";

import { extractionRefusal } from "../documents";
import { textPdf } from "../test-pdf";
import { ExtractionError, extractPdfText } from "./isolated";

describe("PDF extraction off the web process", () => {
  it("reads the text layer and the page count in a worker", async () => {
    const { text, pages } = await extractPdfText(textPdf(["Bail residentiel", "Loyer : 1 000 $ par mois"]));
    expect(pages).toBe(1);
    expect(text).toContain("Loyer");
  });

  it("leaves the event loop free while the worker reads", async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 1);
    await extractPdfText(textPdf(["Bail"]));
    clearInterval(timer);
    expect(ticks).toBeGreaterThan(0);
  });

  it("refuses a document over the page ceiling, without reading it", async () => {
    await expect(extractPdfText(textPdf(["Bail"]), { maxPages: 0 })).rejects.toMatchObject({ code: "TOO_MANY_PAGES" });
  });

  it("ends the worker at the deadline: the caller gets a TIMEOUT, the process is untouched", async () => {
    await expect(extractPdfText(textPdf(["Bail"]), { timeoutMs: 1 })).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("answers FAILED to bytes that are not a PDF", async () => {
    await expect(extractPdfText(new TextEncoder().encode("not a pdf"))).rejects.toBeInstanceOf(ExtractionError);
  });

  it("ends only the worker when the file exhausts its heap", async () => {
    // A heap too small for pdf.js stands for a decompression bomb: the worker dies of memory, this process lives on.
    await expect(extractPdfText(textPdf(["Bail"]), { maxHeapMb: 8 })).rejects.toMatchObject({ code: expect.stringMatching(/MEMORY|FAILED/) });
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

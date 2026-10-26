import { describe, expect, it } from "vitest";

import { ExtractionNotReady, isExtracting, waitForExtraction } from "./extraction";

const sequence = (...states: Array<{ extraction?: "queued" | "running" | "done" | "failed"; extractionError?: string | null }>) => {
  let i = 0;
  return async () => states[Math.min(i++, states.length - 1)]!;
};
const noSleep = async () => undefined;

describe("waiting for a document's text", () => {
  it("answers at once for a document read before the status existed", async () => {
    await expect(waitForExtraction(sequence({}), { sleep: noSleep })).resolves.toEqual({});
  });

  it("polls while the document is queued or running, and resolves when done", async () => {
    let slept = 0;
    const read = sequence({ extraction: "queued" }, { extraction: "running" }, { extraction: "done" });
    const done = await waitForExtraction(read, { sleep: async () => void slept++ });
    expect(done.extraction).toBe("done");
    expect(slept).toBe(2);
  });

  it("rejects with the reason when the reading failed", async () => {
    const error = await waitForExtraction(sequence({ extraction: "running" }, { extraction: "failed", extractionError: "FILE_TOO_COMPLEX" }), { sleep: noSleep }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExtractionNotReady);
    expect(error).toMatchObject({ status: "failed", reason: "FILE_TOO_COMPLEX" });
  });

  it("gives up at the deadline", async () => {
    let clock = 0;
    const error = await waitForExtraction(sequence({ extraction: "queued" }), { deadlineMs: 1000, intervalMs: 400, sleep: async (ms) => void (clock += ms), now: () => clock }).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: "timeout" });
  });

  it("knows what is still being read", () => {
    expect([undefined, "queued", "running", "done", "failed"].map((s) => isExtracting(s as never))).toEqual([false, true, true, false, false]);
  });
});

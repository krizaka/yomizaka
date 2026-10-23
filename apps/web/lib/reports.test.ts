import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ analysis: null as unknown, document: null as unknown }));

vi.mock("./analyses", () => ({ getAnalysis: async () => state.analysis }));
vi.mock("./documents", () => ({ getDocument: async () => state.document }));

import { reportFor, reportPdfFor } from "./reports";

describe("seeded demo report exports", () => {
  beforeEach(() => {
    state.document = { sha256: "a".repeat(64), filename: "demo.pdf", title: "Demo", sizeBytes: 10, pages: 1 };
    state.analysis = {
      id: "demo-analysis",
      studio: "compliance-check",
      status: "succeeded",
      runId: "seeded-demo",
      blueprintVersion: null,
      inputs: { seeded: "true" },
      report: { rulesetId: "demo", rulesetVersion: "1", jurisdiction: "QC", asOf: "2026-01-01", findings: [] },
      error: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:00.000Z",
    };
  });

  it.each([reportFor, reportPdfFor])("refuses seeded checks before exporting", async (exportReport) => {
    await expect(exportReport("owner", "document", "analysis", "fr")).rejects.toMatchObject({
      status: 409,
      body: { code: "REPORT_NOT_READY" },
    });
  });
});

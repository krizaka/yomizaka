import { readFileSync } from "node:fs";

import type { OrazakaRun } from "@yomizaka/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrate, pool, query } from "../db";
import { useOrazakaClient } from "../orazaka";
import { reportFor, reportPdfFor } from "../reports";
import { appSettings, resetAppSettings } from "../settings/instance";
import { GLOBAL } from "../settings/service";
import { readGlossary, saveGlossary } from "./store";
import { translationFor } from "./wire";

/**
 * A report in the other language against PostgreSQL, the settings, the credits and a fake Orazaka (CI's service; locally
 * YOMIZAKA_DB_IT=1 DATABASE_URL=…). The real Studio `text-translation` (krizaka/orazaka-packs#119) is not needed: the port is the seam.
 */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;
const FIXTURE = JSON.parse(readFileSync(new URL("../fixtures/orazaka-compliance-qc-1.2.0.json", import.meta.url), "utf8")) as { report?: Record<string, unknown> } & Record<string, unknown>;

describe.runIf(enabled)("the report in English (yomizaka#246)", () => {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const actor = { id: null, label: "test" };
  let owner = "";
  let glossary0 = { version: 0, terms: [] as { source: string; target: string }[] };
  let documentId = "";
  let analysisId = "";
  const runs = new Map<string, { status: string; texts: { key: string; locale: string; text: string }[] }>();
  const starts: Record<string, string>[] = [];

  beforeAll(async () => {
    await migrate();
    glossary0 = await readGlossary();
    const [a] = await query<{ id: string }>("INSERT INTO accounts (email, audit_credits) VALUES ($1, 3) RETURNING id", [`translate-${stamp}@yomizaka.test`]);
    owner = a!.id;
    const [d] = await query<{ id: string }>("INSERT INTO documents (owner_id, title, filename, mime_type, size_bytes, sha256, content) VALUES ($1, 'Bail', 'bail.txt', 'text/plain', 4, $2, 'bail') RETURNING id", [
      owner,
      stamp.replace(/\W/g, "").padEnd(64, "a").slice(0, 64),
    ]);
    documentId = d!.id;
    const body = (FIXTURE.report ?? FIXTURE) as Record<string, unknown>;
    const [an] = await query<{ id: string }>("INSERT INTO analyses (document_id, studio, status, run_id, blueprint_version, report, finished_at) VALUES ($1, 'compliance-check', 'succeeded', $2, '1.2.0', $3, now()) RETURNING id", [
      documentId,
      `run-${stamp}`,
      JSON.stringify(body),
    ]);
    analysisId = an!.id;
    useOrazakaClient({
      startRun: async (studio: string, inputs: Record<string, string>) => {
        expect(studio).toBe("text-translation");
        starts.push(inputs);
        const id = `00000000-0000-4000-8000-${String(starts.length).padStart(12, "0")}`;
        runs.set(id, { status: "RUNNING", texts: [] });
        return { id, studioKey: studio, status: "RUNNING", outputs: [] } as OrazakaRun;
      },
      getRun: async (id: string): Promise<OrazakaRun> => {
        const r = runs.get(id)!;
        return { id, studioKey: "text-translation", blueprintVersion: "1.0.0", status: r.status, outputs: r.status === "SUCCEEDED" ? [{ key: "translations", type: "JSON", value: JSON.stringify(r.texts) }] : [] };
      },
    } as never);
  });
  afterAll(async () => {
    useOrazakaClient(null);
    await saveGlossary(glossary0.terms);
    for (const setting of ["features.reportTranslation", "limits.reportTranslationCredits"] as const) await appSettings().reset(actor, GLOBAL, setting, new Date());
    resetAppSettings();
    await query("DELETE FROM accounts WHERE id = $1", [owner]);
    await pool().end();
  });

  const stored = async () => (await query<{ report: { findings: { ruleId: string; explanation: string }[] } }>("SELECT report FROM analyses WHERE id = $1", [analysisId]))[0]!.report;
  const balance = async () => (await query<{ audit_credits: number }>("SELECT audit_credits FROM accounts WHERE id = $1", [owner]))[0]!.audit_credits;
  const finish = () => {
    const id = [...runs.keys()].at(-1)!;
    const sent = JSON.parse(starts.at(-1)!.fields!) as { key: string; text: string }[];
    runs.set(id, { status: "SUCCEEDED", texts: sent.map((f) => ({ key: f.key, locale: "en", text: `EN ${f.text}` })) });
  };

  it("switched off: a report in English is as Orazaka wrote it, and no run starts", async () => {
    const { issued } = await reportFor(owner, documentId, analysisId, "en");
    expect(issued.attestation.payload.translation).toBeUndefined();
    expect(starts).toHaveLength(0);
    await expect(translationFor(owner, { id: analysisId, report: await stored() } as never, "en")).rejects.toMatchObject({ status: 403, body: { code: "FEATURE_OFF" } });
  });

  it("switched on: pending while the Studio works, then signed in English with its trace; translated once and charged once", async () => {
    await appSettings().set(actor, GLOBAL, "features.reportTranslation", true, new Date());
    await appSettings().set(actor, GLOBAL, "limits.reportTranslationCredits", 2, new Date());
    resetAppSettings();
    await expect(reportFor(owner, documentId, analysisId, "en")).rejects.toMatchObject({ status: 409, body: { code: "TRANSLATION_PENDING" } });
    await expect(reportPdfFor(owner, documentId, analysisId, "en")).rejects.toMatchObject({ status: 409, body: { code: "TRANSLATION_PENDING" } });
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ sourceLocale: "fr" });
    expect(JSON.parse(starts[0]!.targetLocales!)).toEqual(["en"]);
    expect(JSON.parse(starts[0]!.glossary!)).toHaveLength(glossary0.terms.length);
    expect(await balance()).toBe(1);

    finish();
    const { issued } = await reportFor(owner, documentId, analysisId, "en");
    const payload = issued.attestation.payload;
    expect(payload.translation).toMatchObject({ original: "fr", language: "en", studioVersion: "1.0.0", glossaryVersion: glossary0.version });
    const original = (await stored()).findings;
    for (const [i, f] of payload.findings.entries()) {
      expect(f.explanation.startsWith("EN ")).toBe(true);
      expect(f.ruleId).toBe(original[i]!.ruleId);
    }
    const pdf = await reportPdfFor(owner, documentId, analysisId, "en");
    expect(pdf.issued.attestation.payload.translation?.runId).toBe(payload.translation!.runId);
    expect(starts).toHaveLength(1);
    expect(await balance()).toBe(1);
    // French is the original: no run, no charge
    expect((await reportFor(owner, documentId, analysisId, "fr")).issued.attestation.payload.translation).toBeUndefined();
  });

  it("an administrator changing the glossary raises its version: the report is translated again with the new terms", async () => {
    const before = await readGlossary();
    const version = await saveGlossary([...before.terms, { source: "résiliation", target: "termination" }]);
    expect(version).toBe(before.version + 1);
    await query("UPDATE accounts SET audit_credits = 3 WHERE id = $1", [owner]);
    await expect(reportFor(owner, documentId, analysisId, "en")).rejects.toMatchObject({ body: { code: "TRANSLATION_PENDING" } });
    expect(starts).toHaveLength(2);
    expect(JSON.parse(starts[1]!.glossary!)).toContainEqual({ source: "résiliation", target: "termination" });
    await saveGlossary(before.terms);
  });

  it("not enough credits: a 402 and nothing started", async () => {
    await query("UPDATE accounts SET audit_credits = 0 WHERE id = $1", [owner]);
    const count = starts.length;
    await saveGlossary([
      { source: "bail", target: "lease" },
      { source: "nouveau", target: "new" },
    ]);
    await expect(reportFor(owner, documentId, analysisId, "en")).rejects.toMatchObject({ status: 402, body: { code: "PAYWALL" } });
    expect(starts).toHaveLength(count);
  });
});

import { beforeAll, describe, expect, it } from "vitest";

import { listUsers } from "./accounts";
import { migrate, pool, query } from "./db";
import { deleteDocument, getDocument, getFile, listDocuments, storeDocument } from "./documents";
import { hashPassword } from "./password";
import { search } from "./search";
import { createSession, resolveSession, revokeSession } from "./session";

/**
 * The SQL against a real PostgreSQL 16 (CI's service; locally `YOMIZAKA_DB_IT=1 DATABASE_URL=… pnpm test`): the
 * migrations, the library, the analyses' state, search, the administration list, sessions. Skipped without a database.
 */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("database", () => {
  const email = `it-${Date.now()}@yomizaka.test`;
  let owner: { id: string } | undefined;
  let stranger: { id: string } | undefined;

  beforeAll(async () => {
    await migrate();
    [owner] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash) VALUES ($1, $2) RETURNING id", [email, await hashPassword("integration password")]);
    [stranger] = await query<{ id: string }>("INSERT INTO accounts (email) VALUES ($1) RETURNING id", [`other-${email}`]);
  });
  const LEASE = "CONTRAT DE LOCATION\nLoyer mensuel : 850 € hors charges.\nDépôt de garantie : 2 550 €.";

  it("migrates once, idempotently", async () => {
    expect(await migrate()).toEqual([]);
  });

  it("stores a document, its text and its fingerprint — the same file twice is one document", async () => {
    const file = { name: "bail-dupont.txt", type: "text/plain", size: LEASE.length };
    const first = await storeDocument(owner!.id, file, new TextEncoder().encode(LEASE), "lease");
    expect(first.duplicate).toBe(false);
    expect(first.summary).toMatchObject({ title: "bail dupont", kind: "lease", status: "stored", hasText: true, mimeType: "text/plain" });
    const again = await storeDocument(owner!.id, file, new TextEncoder().encode(LEASE), "other");
    expect(again).toMatchObject({ duplicate: true, summary: { id: first.summary.id } });
    expect((await listDocuments(owner!.id)).map((d) => d.id)).toContain(first.summary.id);
    expect((await getFile(owner!.id, first.summary.id)).content.toString()).toBe(LEASE);
  });

  it("keeps a document to its owner: another person gets a 404", async () => {
    const [doc] = await listDocuments(owner!.id);
    await expect(getDocument(stranger!.id, doc!.id)).rejects.toMatchObject({ status: 404 });
    await expect(deleteDocument(stranger!.id, doc!.id)).rejects.toMatchObject({ status: 404 });
    expect(await listDocuments(stranger!.id)).toEqual([]);
  });

  it("derives the document's state from its latest analysis, and searches its findings", async () => {
    const [doc] = await listDocuments(owner!.id);
    const report = { rulesetId: "fr-residential-lease", rulesetVersion: "2026-07-01", jurisdiction: "FR", asOf: "2026-10-14", findings: [{ ruleId: "FR-LEASE-005", severity: "BLOCKING", verdict: "FAIL", explanation: "Le dépôt de garantie excède un mois de loyer.", evidenceSpan: { quote: "Dépôt de garantie : 2 550 €" } }], attention: true };
    await query("INSERT INTO analyses (document_id, studio, status, run_id, report, search_text) VALUES ($1, 'compliance-check', 'succeeded', '8f6b1c2e-1d2c-4b8a-9a55-0d1e2f3a4b5c', $2, $3)", [doc!.id, JSON.stringify(report), "FR-LEASE-005 Le dépôt de garantie excède un mois de loyer."]);
    const detail = await getDocument(owner!.id, doc!.id);
    expect(detail.status).toBe("attention");
    expect(detail.analyses[0]).toMatchObject({ runId: "8f6b1c2e-1d2c-4b8a-9a55-0d1e2f3a4b5c", status: "succeeded" });
    expect(detail.analyses[0]!.report).not.toHaveProperty("attention");
    const hits = await search(owner!.id, "excède");
    expect(hits.some((h) => h.source === "finding" && h.passage.includes("<b>excède</b>"))).toBe(true);
    expect((await search(owner!.id, "loyer mensuel")).some((h) => h.source === "text")).toBe(true);
    expect(await search(stranger!.id, "excède")).toEqual([]);
    expect(await search(owner!.id, "<script>")).toEqual([]);
  });

  it("lists the accounts with their documents for the administration", async () => {
    const users = await listUsers();
    expect(users.find((u) => u.email === email)).toMatchObject({ role: "USER", status: "ACTIVE", documents: 1 });
  });

  it("opens, resolves and ends a session — a suspended account has none", async () => {
    const { token } = await createSession(owner!.id, { ip: "203.0.113.7", userAgent: "vitest" });
    expect((await resolveSession(token))?.account.email).toBe(email);
    await query("UPDATE accounts SET status = 'SUSPENDED' WHERE id = $1", [owner!.id]);
    expect(await resolveSession(token)).toBeNull();
    await query("UPDATE accounts SET status = 'ACTIVE' WHERE id = $1", [owner!.id]);
    await revokeSession(token);
    expect(await resolveSession(token)).toBeNull();
    await query("DELETE FROM accounts WHERE id = ANY($1)", [[owner!.id, stranger!.id]]);
    await pool().end();
  });
});

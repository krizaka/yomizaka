import { memoryStore, type OrazakaRun } from "@yomizaka/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONSENT_MEANS, CONSENT_PURPOSE, type ConsentPurpose, grantConsent, NOTICE_VERSION } from "./applicant-consent";
import { activeConsents } from "./applicant-consent";
import { applicantFileOf, closeApplicantFile, listApplicantFiles, requestApplicantFile, revokeApplicantFile, submitApplicantFile, uploadApplicantDocument,type UploadContext } from "./applicant-file";
import { applicantFileState } from "./applicant-file";
import { fileByToken } from "./applicant-file";
import { loadApplicantPage } from "./applicant-page";
import { migrate, query } from "./db";
import { useOrazakaClient } from "./orazaka";
import { cleanPdf } from "./preflight/fixtures";
import { consent as screeningConsent, requestScreening } from "./screening";

/** yomizaka#127 against the real database (CI's service; locally YOMIZAKA_DB_IT=1 DATABASE_URL=…). Orazaka is a fake that records the runs. */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;
const NOW = new Date("2026-10-24T12:00:00Z");
const DAY_MS = 86_400_000;

describe.runIf(enabled)("the applicant file (yomizaka#127)", () => {
  const runs = new Map<string, string>();
  let n = 0;
  const run = (id: string, status: string): OrazakaRun => ({ id, studioKey: "x", blueprintVersion: "1.0.0", status, outputs: [] });
  const store = memoryStore();
  const stamp = Date.now();
  const ctx = (keepAllowed = true): UploadContext => ({ store, purgeAfterHours: 24, keepAllowed, auditCaps: () => ({ perMonth: 1000, perDay: 0, freeFirst: false }) });
  let landlordA: { id: string; email: string };
  let landlordB: { id: string; email: string };

  beforeAll(async () => {
    await migrate();
    useOrazakaClient({
      startRun: async () => {
        const id = `run-file-${++n}`;
        runs.set(id, "RUNNING");
        return run(id, "RUNNING");
      },
      getRun: async (id: string) => run(id, runs.get(id) ?? "RUNNING"),
    } as never);
    const [a, b] = await Promise.all(
      ["a", "b"].map(async (who) => {
        const email = `file-${who}-${stamp}@yomizaka.test`;
        const [row] = await query<{ id: string }>("INSERT INTO accounts (email, audit_credits) VALUES ($1, 50) RETURNING id", [email]);
        return { id: row!.id, email };
      }),
    );
    landlordA = a!;
    landlordB = b!;
  });
  afterAll(() => useOrazakaClient(null));

  let seq = 0;
  /** A new applicant file for landlord A, with the consent to the document check already given (the applicant read the notice). */
  const askWithConsent = async (types: string[] = ["pay-stub", "employment-letter"], purposes: ConsentPurpose[] = [CONSENT_PURPOSE.DOCUMENT_CHECK]) => {
    const made = await requestApplicantFile(landlordA, { candidateName: "Camille Fictif", candidateEmail: `c${++seq}-${stamp}@exemple.test`, types }, NOW);
    for (const purpose of purposes) await grantConsent(made.id, purpose, { noticeVersion: NOTICE_VERSION, means: CONSENT_MEANS.WEB_FORM }, NOW);
    return made;
  };
  const pdf = async (text: string) => {
    const bytes = await cleanPdf(text);
    return { name: `${text}.pdf`, type: "application/pdf", size: bytes.length, bytes };
  };
  const documentsOf = (id: string) => query<{ id: string; storage: string; content_len: number; text: string; document_type: string; retention_policy: string }>(
    "SELECT id, storage, octet_length(content) AS content_len, text, document_type, retention_policy FROM documents WHERE screening_id = $1 ORDER BY created_at",
    [id],
  );
  const refusal = (promise: Promise<unknown>) => expect(promise).rejects.toMatchObject({ body: expect.objectContaining({ code: expect.any(String) }) });
  const codeOf = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      return (error as { body?: { code?: string }; status?: number }).status + " " + (error as { body?: { code?: string } }).body?.code;
    }
    return "no error";
  };

  it("asks for known documents only: a SIN, a health card, a passport or an unknown type is refused", async () => {
    expect(await codeOf(requestApplicantFile(landlordA, { candidateName: "A", candidateEmail: `x-${stamp}@exemple.test`, types: ["sin"] }, NOW))).toBe("422 TYPE_NOT_NECESSARY");
    expect(await codeOf(requestApplicantFile(landlordA, { candidateName: "A", candidateEmail: `x-${stamp}@exemple.test`, types: ["pay-stub", "health-card"] }, NOW))).toBe("422 TYPE_NOT_NECESSARY");
    expect(await codeOf(requestApplicantFile(landlordA, { candidateName: "A", candidateEmail: `x-${stamp}@exemple.test`, types: ["passport"] }, NOW))).toBe("422 TYPE_NOT_NECESSARY");
    expect(await codeOf(requestApplicantFile(landlordA, { candidateName: "A", candidateEmail: `x-${stamp}@exemple.test`, types: ["no-such-type"] }, NOW))).toBe("422 TYPE_UNKNOWN");
  });

  it("no upload without consent: refused before any byte is stored", async () => {
    const made = await requestApplicantFile(landlordA, { candidateName: "Sans Consentement", candidateEmail: `nc-${stamp}@exemple.test`, types: ["pay-stub"] }, NOW);
    expect(await codeOf(uploadApplicantDocument(made.token, "pay-stub", await pdf("PAY NC"), ctx(), NOW))).toBe("403 CONSENT_REQUIRED");
    expect(await documentsOf(made.id)).toEqual([]);
  });

  it("an expired link is refused, even with the consent given", async () => {
    const made = await askWithConsent(["pay-stub"]);
    const later = new Date(NOW.getTime() + 15 * DAY_MS);
    expect(await codeOf(uploadApplicantDocument(made.token, "pay-stub", await pdf("PAY EXP"), ctx(), later))).toBe("410 LINK_EXPIRED");
    expect(await documentsOf(made.id)).toEqual([]);
  });

  it("a revoked link is refused, and the manager's view says so", async () => {
    const made = await askWithConsent(["pay-stub"]);
    await revokeApplicantFile(landlordA.id, made.id, NOW);
    expect(await codeOf(uploadApplicantDocument(made.token, "pay-stub", await pdf("PAY REV"), ctx(), NOW))).toBe("410 LINK_REVOKED");
    expect(await codeOf(submitApplicantFile(made.token, NOW))).toBe("410 LINK_REVOKED");
    expect((await applicantFileOf(landlordA.id, made.id, NOW)).status).toBe("revoked");
  });

  it("the file is sent once: after the submission the link is used and refuses another document", async () => {
    const made = await askWithConsent(["pay-stub"]);
    expect(await codeOf(submitApplicantFile(made.token, NOW))).toBe("409 NO_DOCUMENT");
    await uploadApplicantDocument(made.token, "pay-stub", await pdf("PAY ONCE"), ctx(), NOW);
    await submitApplicantFile(made.token, NOW);
    expect(await codeOf(uploadApplicantDocument(made.token, "pay-stub", await pdf("PAY TWICE"), ctx(), NOW))).toBe("409 LINK_USED");
    expect(await codeOf(submitApplicantFile(made.token, NOW))).toBe("409 LINK_USED");
  });

  it("a document of a type that was not asked for is refused", async () => {
    const made = await askWithConsent(["pay-stub"]);
    expect(await codeOf(uploadApplicantDocument(made.token, "bank-statement", await pdf("BANK NA"), ctx(), NOW))).toBe("422 TYPE_NOT_REQUESTED");
  });

  it("a pay stub runs its authenticity check; its compliance check is skipped as KIND_NOT_VERIFIED (no lease ruleset), and the purge runs once the check ends", async () => {
    const made = await askWithConsent(["pay-stub"]);
    const sent = await uploadApplicantDocument(made.token, "pay-stub", await pdf("PAY CHECKED"), ctx(), NOW);
    // A pay stub has no compliance ruleset (ADR-089): the lease's rules are never its fallback, so that skip is visible, and the authenticity check runs.
    expect(sent.checks.started).toEqual(["document-authenticity"]);
    expect(sent.checks.skipped).toEqual([{ studio: "compliance-check", code: "KIND_NOT_VERIFIED" }]);
    const [doc] = await documentsOf(made.id);
    expect(doc).toMatchObject({ document_type: "pay-stub", retention_policy: "after-check", storage: "none" });
    expect(doc!.content_len).toBeGreaterThan(0);
    // The checks end: both runs fail at Orazaka here, which is an end of the check all the same.
    for (const id of runs.keys()) runs.set(id, "FAILED");
    const view = await applicantFileOf(landlordA.id, made.id, NOW);
    expect(view.documents[0]).toMatchObject({ purged: true, retention: "after-check" });
    expect(view.documents[0]!.checks.map((c) => c.status)).toEqual(["failed"]);
    const [after] = await documentsOf(made.id);
    expect(after).toMatchObject({ content_len: 0, text: "" });
    const reports = await query("SELECT id FROM analyses WHERE document_id = $1", [doc!.id]);
    expect(reports).toHaveLength(1);
  });

  it("a kept file stays until the manager closes it; the close purges it and closes the link with it", async () => {
    const made = await askWithConsent(["pay-stub"], [CONSENT_PURPOSE.DOCUMENT_CHECK, CONSENT_PURPOSE.DOCUMENT_KEEP]);
    await uploadApplicantDocument(made.token, "pay-stub", await pdf("PAY KEPT"), ctx(), NOW);
    const [kept] = await documentsOf(made.id);
    expect(kept).toMatchObject({ retention_policy: "after-decision" });
    expect(kept!.storage).not.toBe("none");
    expect(kept!.content_len).toBeGreaterThan(0);
    const closed = await closeApplicantFile(landlordA.id, made.id, store, NOW);
    expect(closed.purged).toBe(1);
    const [after] = await documentsOf(made.id);
    expect(after).toMatchObject({ content_len: 0, text: "", storage: "none" });
    expect((await applicantFileOf(landlordA.id, made.id, NOW)).status).toBe("closed");
    expect(await codeOf(uploadApplicantDocument(made.token, "pay-stub", await pdf("PAY LATE"), ctx(), NOW))).toBe("410 FILE_CLOSED");
    expect((await query("SELECT action FROM audit_log WHERE target_id = $1 AND action = 'applicant-file.closed'", [made.id]))).toHaveLength(1);
  });

  it("an identity document is never kept, even with the keeping consent", async () => {
    const made = await askWithConsent(["identity-document"], [CONSENT_PURPOSE.DOCUMENT_CHECK, CONSENT_PURPOSE.DOCUMENT_KEEP]);
    await uploadApplicantDocument(made.token, "identity-document", await pdf("ID KEPT"), ctx(), NOW);
    const [doc] = await documentsOf(made.id);
    expect(doc).toMatchObject({ retention_policy: "after-check", storage: "none" });
  });

  it("a manager sees only their own applicants: another manager's file is not found, and is not listed", async () => {
    const made = await askWithConsent(["pay-stub"]);
    await expect(applicantFileOf(landlordB.id, made.id, NOW)).rejects.toMatchObject({ status: 404 });
    await expect(revokeApplicantFile(landlordB.id, made.id, NOW)).rejects.toMatchObject({ status: 404 });
    await expect(closeApplicantFile(landlordB.id, made.id, store, NOW)).rejects.toMatchObject({ status: 404 });
    expect((await listApplicantFiles(landlordB.id, NOW)).map((f) => f.id)).not.toContain(made.id);
    expect((await listApplicantFiles(landlordA.id, NOW)).map((f) => f.id)).toContain(made.id);
  });

  it("the screening answers refuse an applicant-file token: the two flows never cross", async () => {
    const made = await askWithConsent(["pay-stub"]);
    await refusal(screeningConsent(made.token, NOW));
  });

  it("the applicant's page opens for a file token and not for a screening's (yomizaka#341)", async () => {
    const made = await askWithConsent(["pay-stub"]);
    const deps = { fileByToken, applicantFileState, activeConsents };
    const page = await loadApplicantPage(made.token, NOW, deps);
    expect(page?.state.types.map((t) => t.id)).toEqual(["pay-stub"]);
    expect(page?.consents).toContain(CONSENT_PURPOSE.DOCUMENT_CHECK);
    const screening = await requestScreening(landlordA, { tenantName: "Camille Fictif", tenantEmail: `s-${stamp}@yomizaka.test`, scope: ["payment-history"] }, NOW);
    expect(await loadApplicantPage(screening.token, NOW, deps)).toBeNull();
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { requestApplicantFile } from "./applicant-file";
import { migrate, query } from "./db";
import { createShare, listShares, openShare, revokeShare } from "./owner-report-shares";

/** yomizaka#128 against the real database (CI's service; locally YOMIZAKA_DB_IT=1 DATABASE_URL=…). */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;
const NOW = new Date("2026-10-27T12:00:00Z");
const DAY_MS = 86_400_000;

describe.runIf(enabled)("the owner link of a report (yomizaka#128)", () => {
  const stamp = Date.now();
  const account = async (who: string) => {
    const email = `share-${who}-${stamp}@yomizaka.test`;
    const [row] = await query<{ id: string }>("INSERT INTO accounts (email) VALUES ($1) RETURNING id", [email]);
    return { id: row!.id, email };
  };
  let a: { id: string; email: string };
  let b: { id: string; email: string };
  let fileId: string;
  beforeAll(async () => {
    await migrate();
    a = await account("a");
    b = await account("b");
    fileId = (await requestApplicantFile(a, { candidateName: "Camille Fictif", candidateEmail: `c-${stamp}@exemple.test`, types: ["pay-stub"] }, NOW)).id;
  });
  afterAll(async () => {
    await query("DELETE FROM accounts WHERE id = ANY($1)", [[a.id, b.id]]);
  });

  it("opens while live, records each view and the audit, and never carries the name", async () => {
    const { token } = await createShare(a, fileId, { recipient: "Owner", days: 3 }, NOW);
    const report = await openShare(token, new Date(NOW.getTime() + DAY_MS), new Headers({ "x-forwarded-for": "203.0.113.9" }));
    expect(report?.reference).toHaveLength(8);
    expect(JSON.stringify(report)).not.toContain("Camille");
    const shares = await listShares(a.id, fileId, NOW);
    expect(shares.find((s) => s.recipient === "Owner")).toMatchObject({ state: "live", views: 1 });
  });

  it("refuses an expired link", async () => {
    const { token } = await createShare(a, fileId, { days: 1 }, NOW);
    expect(await openShare(token, new Date(NOW.getTime() + 2 * DAY_MS))).toBeNull();
  });

  it("refuses a revoked link at once", async () => {
    const { id, token } = await createShare(a, fileId, {}, NOW);
    await revokeShare(a, fileId, id);
    expect(await openShare(token, NOW)).toBeNull();
  });

  it("refuses an unknown token", async () => {
    expect(await openShare("sc1.nope", NOW)).toBeNull();
  });

  it("another manager can neither create, list nor revoke the links of this file", async () => {
    const { id } = await createShare(a, fileId, {}, NOW);
    await expect(createShare(b, fileId, {}, NOW)).rejects.toMatchObject({ status: 404 });
    await expect(listShares(b.id, fileId, NOW)).rejects.toMatchObject({ status: 404 });
    await expect(revokeShare(b, fileId, id)).rejects.toMatchObject({ status: 404 });
  });
});

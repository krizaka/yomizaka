import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { requestApplicantFile } from "./applicant-file";
import { migrate, query } from "./db";
import type { AccountMail } from "./mailer";
import { cleanAddress, createShare, emailShare, listShares, openShare, revokeShare } from "./owner-report-shares";

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

  describe("e-mailing the link (yomizaka#130)", () => {
    const deps = (sent: AccountMail[]) => ({ mail: async (m: AccountMail) => void sent.push(m), origin: "https://www.yomizaka.com" });
    const owner = (who: { id: string; email: string }) => ({ ...who, name: "Eric" });

    it("sends the link in the owner's language, keeps the address on the row and logs a hash, never the address", async () => {
      const sent: AccountMail[] = [];
      const { id, token } = await createShare(a, fileId, { days: 3 }, NOW);
      await emailShare(owner(a), fileId, { token, email: "  Owner@Exemple.test ", message: "Voici", locale: "fr" }, deps(sent), NOW);
      expect(sent).toEqual([{ kind: "reportLink", to: "owner@exemple.test", locale: "fr", url: `https://www.yomizaka.com/fr/rapport/${token}`, senderName: "Eric", expiresOn: "2026-10-30", message: "Voici" }]);
      expect((await listShares(a.id, fileId, NOW)).find((s) => s.id === id)?.emailedTo).toBe("owner@exemple.test");
      const [entry] = await query<{ detail: { to: string } }>("SELECT detail FROM audit.entry WHERE action = 'report.emailed' AND detail->>'shareId' = $1", [id]);
      expect(entry?.detail.to).toHaveLength(64);
      expect(JSON.stringify(entry)).not.toContain("exemple.test");
    });

    it("forgets the address when the link is revoked or has expired", async () => {
      const one = await createShare(a, fileId, { days: 1 }, NOW);
      const two = await createShare(a, fileId, { days: 5 }, NOW);
      for (const l of [one, two]) await emailShare(owner(a), fileId, { token: l.token, email: "o@exemple.test", locale: "en" }, deps([]), NOW);
      await revokeShare(a, fileId, two.id);
      const later = new Date(NOW.getTime() + 2 * DAY_MS);
      const shares = await listShares(a.id, fileId, later);
      expect(shares.find((s) => s.id === one.id)?.emailedTo).toBeNull();
      expect(shares.find((s) => s.id === two.id)?.emailedTo).toBeNull();
    });

    it("refuses an expired, a revoked, an unknown link and a bad address: nothing is sent", async () => {
      const sent: AccountMail[] = [];
      const old = await createShare(a, fileId, { days: 1 }, NOW);
      const gone = await createShare(a, fileId, {}, NOW);
      await revokeShare(a, fileId, gone.id);
      const later = new Date(NOW.getTime() + 2 * DAY_MS);
      await expect(emailShare(owner(a), fileId, { token: old.token, email: "o@exemple.test", locale: "en" }, deps(sent), later)).rejects.toMatchObject({ status: 404 });
      await expect(emailShare(owner(a), fileId, { token: gone.token, email: "o@exemple.test", locale: "en" }, deps(sent), NOW)).rejects.toMatchObject({ status: 404 });
      await expect(emailShare(owner(a), fileId, { token: "sc1.nope", email: "o@exemple.test", locale: "en" }, deps(sent), NOW)).rejects.toMatchObject({ status: 404 });
      const live = await createShare(a, fileId, {}, NOW);
      await expect(emailShare(owner(a), fileId, { token: live.token, email: "a@x.test, b@x.test", locale: "en" }, deps(sent), NOW)).rejects.toMatchObject({ status: 400 });
      expect(sent).toEqual([]);
    });

    it("another manager cannot send this file's link, nor send a link of theirs through this file", async () => {
      const sent: AccountMail[] = [];
      const { token } = await createShare(a, fileId, {}, NOW);
      await expect(emailShare(owner(b), fileId, { token, email: "o@exemple.test", locale: "en" }, deps(sent), NOW)).rejects.toMatchObject({ status: 404 });
      expect(sent).toEqual([]);
    });
  });

  it("cleans an address: one plain address, lower case", () => {
    expect(cleanAddress(" A@B.test ")).toBe("a@b.test");
    for (const bad of ["", "a", "a@b", "Eric <a@b.test>", "a@b.test,c@d.test", "a b@c.test"]) expect(cleanAddress(bad), bad).toBeNull();
  });
});

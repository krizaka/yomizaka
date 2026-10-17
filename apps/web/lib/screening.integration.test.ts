import { beforeAll, describe, expect, it } from "vitest";

import { migrate, query } from "./db";
import { consent, contest, decline, listForLandlord, purgeExpired, requestScreening, RETENTION_DAYS, share, viewForTenant } from "./screening";

/** The consent flow against a real PostgreSQL (CI's service; locally `YOMIZAKA_DB_IT=1 DATABASE_URL=… pnpm test`). */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;
const DAY = 86_400_000;

describe.runIf(enabled)("tenant screening (database)", () => {
  const stamp = Date.now();
  const NOW = new Date("2026-10-17T12:00:00Z");
  let landlord: { id: string; email: string };

  beforeAll(async () => {
    await migrate();
    [landlord] = (await query<{ id: string; email: string }>("INSERT INTO accounts (email) VALUES ($1) RETURNING id, email", [`screening-landlord-${stamp}@yomizaka.test`])) as [typeof landlord];
  });

  const ask = (email: string) => requestScreening(landlord, { tenantName: "Camille Fictif", tenantEmail: email, scope: ["payment-history"] }, NOW);
  const actions = async (id: string) => (await query<{ action: string }>("SELECT action FROM audit_log WHERE target_id = $1 ORDER BY id", [id])).map((a) => a.action);

  it("keeps only the token's hash, and the landlord sees a request waiting — no result", async () => {
    const { id, token } = await ask(`a-${stamp}@exemple.test`);
    const [row] = await query<{ token_hash: string }>("SELECT token_hash FROM screenings WHERE id = $1", [id]);
    expect(row!.token_hash).not.toContain(token);
    const list = await listForLandlord(landlord.id, NOW);
    expect(list.find((s) => s.id === id)).toMatchObject({ status: "requested", result: null });
    expect(await actions(id)).toEqual(["screening.requested"]);
  });

  it("a refusal is recorded and checks nothing", async () => {
    const { id, token } = await ask(`b-${stamp}@exemple.test`);
    expect(await decline(token, NOW)).toMatchObject({ status: "declined", result: null });
    const [row] = await query<{ result: unknown }>("SELECT result FROM screenings WHERE id = $1", [id]);
    expect(row!.result).toBeNull();
    await expect(consent(token, NOW)).rejects.toMatchObject({ status: 409 });
    expect(await actions(id)).toEqual(["screening.requested", "screening.declined"]);
  });

  it("consent runs the provider; the tenant sees the result first, the landlord only once it is shared", async () => {
    const { id, token } = await ask(`c-${stamp}@exemple.test`);
    const mine = await consent(token, NOW);
    expect(mine).toMatchObject({ status: "consented", landlord: landlord.email, result: { band: "no-concern", provider: "demo" } });
    expect((await listForLandlord(landlord.id, NOW)).find((s) => s.id === id)).toMatchObject({ status: "consented", result: null });
    await share(token, NOW);
    expect((await listForLandlord(landlord.id, NOW)).find((s) => s.id === id)).toMatchObject({ status: "shared", result: { band: "no-concern" } });
    expect(await actions(id)).toEqual(["screening.requested", "screening.consented", "screening.shared"]);
  });

  it("stores a minimal result: no raw report, no score, no identity beyond the request", async () => {
    const { id, token } = await ask(`d-${stamp}@exemple.test`);
    await consent(token, NOW);
    const [row] = await query<{ result: Record<string, unknown>; result_expires_at: Date }>("SELECT result, result_expires_at FROM screenings WHERE id = $1", [id]);
    expect(Object.keys(row!.result).sort()).toEqual(["band", "generatedAt", "items", "provider"]);
    expect(row!.result_expires_at.getTime() - NOW.getTime()).toBe(RETENTION_DAYS * DAY);
  });

  it("a contested result is never shown to the landlord, who sees « contested »", async () => {
    const { id, token } = await ask(`flag-${stamp}@exemple.test`);
    expect((await consent(token, NOW)).result?.band).toBe("review");
    await contest(token, "Ce n'est pas exact.", NOW);
    const seen = (await listForLandlord(landlord.id, NOW)).find((s) => s.id === id)!;
    expect(seen).toMatchObject({ status: "contested", result: null });
    expect(JSON.stringify(seen)).not.toContain("pas exact");
    expect(await viewForTenant(token, NOW)).toMatchObject({ status: "contested", contestComment: "Ce n'est pas exact." });
    await expect(share(token, NOW)).rejects.toMatchObject({ status: 409 });
  });

  it("deletes the result after the retention window (the fact of the request stays) and expires an unanswered request", async () => {
    const consented = await ask(`e-${stamp}@exemple.test`);
    await consent(consented.token, NOW);
    const unanswered = await ask(`f-${stamp}@exemple.test`);
    const later = new Date(NOW.getTime() + (RETENTION_DAYS + 1) * DAY);
    expect(await purgeExpired(later)).toBeGreaterThanOrEqual(1);
    const [kept] = await query<{ result: unknown; purged_at: Date | null; status: string }>("SELECT result, purged_at, status FROM screenings WHERE id = $1", [consented.id]);
    expect(kept).toMatchObject({ result: null, status: "consented" });
    expect(kept!.purged_at).not.toBeNull();
    const [open] = await query<{ status: string }>("SELECT status FROM screenings WHERE id = $1", [unanswered.id]);
    expect(open!.status).toBe("expired");
    expect(await actions(consented.id)).toContain("screening.purged");
  });

  it("refuses an unknown link, and a scope the law does not allow", async () => {
    await expect(viewForTenant("sc1.not-a-real-token-at-all-0000000000", NOW)).rejects.toMatchObject({ status: 404 });
    await expect(requestScreening(landlord, { tenantName: "X", tenantEmail: "x@x.test", scope: ["criminal-record"] }, NOW)).rejects.toMatchObject({ status: 400 });
  });
});

import { beforeAll, describe, expect, it } from "vitest";

import { migrate, query } from "../db";
import type { Mail } from "../mailer";
import { hashPassword, verifyPassword } from "../password";
import { emailChangeMail, isEmailChangeToken, postgresAccounts } from "./postgres";

/** The account adapter against a real PostgreSQL (skipped without YOMIZAKA_DB_IT=1 and DATABASE_URL). */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;
const NOW = new Date("2026-10-22T12:00:00Z");
const PASSWORD = "correct-horse-battery";

describe("the e-mail change mail", () => {
  it("is in the person's language, goes to the new address and carries the link, valid for a day", () => {
    const fr = emailChangeMail("fr", "https://www.yomizaka.com/fr/confirm-email?token=x");
    expect(fr.subject).toMatch(/adresse/i);
    expect(fr.text).toContain("https://www.yomizaka.com/fr/confirm-email?token=x");
    expect(emailChangeMail("en", "https://u").subject).toMatch(/address/i);
  });
  it("tokens have their own prefix", () => {
    expect(isEmailChangeToken("ye1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe(true);
    expect(isEmailChangeToken("yv1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe(false);
  });
});

describe.runIf(enabled)("account service (Postgres adapter)", () => {
  beforeAll(async () => {
    await migrate();
  });
  const mails: Mail[] = [];
  const issued: string[] = [];
  const service = postgresAccounts({
    query,
    mail: async (m) => void mails.push(m),
    baseUrl: "https://www.yomizaka.com",
    passwords: { hash: hashPassword, verify: verifyPassword },
    token: () => {
      const t = `ye1.${String(issued.length + 1).padStart(43, "A")}`;
      issued.push(t);
      return t;
    },
  });
  const last = () => issued[issued.length - 1]!;
  const account = async () => {
    const email = `p-${Math.random().toString(36).slice(2)}@yomizaka.test`;
    const [row] = await query<{ id: string }>("INSERT INTO accounts (email, password_hash, email_verified_at, locale) VALUES ($1, $2, now(), 'fr') RETURNING id", [email, await hashPassword(PASSWORD)]);
    return { id: row!.id, email };
  };

  it("reads and updates the profile: a trimmed name, the language, an avatar seed", async () => {
    const { id, email } = await account();
    expect(await service.profile(id)).toMatchObject({ email, name: null, locale: "fr", avatarSeed: null, emailVerified: true, pendingEmail: null });
    expect(await service.updateProfile(id, { name: "  Éric   Tremblay ", locale: "en", avatarSeed: "plain-3" })).toMatchObject({ name: "Éric Tremblay", locale: "en", avatarSeed: "plain-3" });
    expect((await service.updateProfile(id, { name: null })).name).toBeNull();
    await expect(service.updateProfile(id, { name: "x".repeat(81) })).rejects.toMatchObject({ status: 400 });
  });

  it("changes the e-mail address only after the new address confirms, and the link works once", async () => {
    const { id } = await account();
    mails.length = 0;
    const next = `n-${Math.random().toString(36).slice(2)}@yomizaka.test`;
    await expect(service.requestEmailChange(id, { newEmail: next, password: "wrong" }, NOW)).rejects.toMatchObject({ status: 403, code: "WRONG_PASSWORD" });
    await service.requestEmailChange(id, { newEmail: next.toUpperCase(), password: PASSWORD }, NOW);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toBe(next);
    expect(mails[0]!.text).toContain("/fr/confirm-email?token=ye1.");
    expect((await service.profile(id)).pendingEmail).toBe(next);
    expect(await service.confirmEmailChange(last(), NOW)).toBe("CHANGED");
    expect(await service.profile(id)).toMatchObject({ email: next, pendingEmail: null, emailVerified: true });
    expect(await service.confirmEmailChange(last(), NOW)).toBe("INVALID");
  });

  it("a link that expired, or that is not a link, changes nothing", async () => {
    const { id, email } = await account();
    await service.requestEmailChange(id, { newEmail: `e-${Math.random().toString(36).slice(2)}@yomizaka.test`, password: PASSWORD }, NOW);
    expect(await service.confirmEmailChange(last(), new Date("2026-10-24T12:00:01Z"))).toBe("INVALID");
    expect(await service.confirmEmailChange("garbage", NOW)).toBe("INVALID");
    expect((await service.profile(id)).email).toBe(email);
  });

  it("an address that is already taken answers the same and mails nothing (no enumeration)", async () => {
    const a = await account();
    const b = await account();
    mails.length = 0;
    await expect(service.requestEmailChange(a.id, { newEmail: b.email, password: PASSWORD }, NOW)).resolves.toBeUndefined();
    expect(mails).toHaveLength(0);
    expect((await service.profile(a.id)).pendingEmail).toBeNull();
  });

  it("changes the password after checking the current one, and signs the other sessions out", async () => {
    const { id } = await account();
    const [keep] = await query<{ id: string }>("INSERT INTO sessions (account_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day') RETURNING id", [id, `k${Math.random()}`]);
    await query("INSERT INTO sessions (account_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')", [id, `o${Math.random()}`]);
    await expect(service.changePassword(id, { current: "wrong", next: "another-long-password" }, keep!.id)).rejects.toMatchObject({ status: 403, code: "WRONG_PASSWORD" });
    await expect(service.changePassword(id, { current: PASSWORD, next: "short" }, keep!.id)).rejects.toMatchObject({ status: 400, code: "PASSWORD_TOO_SHORT" });
    await service.changePassword(id, { current: PASSWORD, next: "another-long-password" }, keep!.id);
    const [row] = await query<{ password_hash: string }>("SELECT password_hash FROM accounts WHERE id = $1", [id]);
    expect(await verifyPassword("another-long-password", row!.password_hash)).toBe(true);
    expect((await query<{ id: string }>("SELECT id FROM sessions WHERE account_id = $1", [id])).map((s) => s.id)).toEqual([keep!.id]);
  });

  it("confirms a password and deletes the identity with everything that hangs on it", async () => {
    const { id } = await account();
    await expect(service.confirmPassword(id, "nope")).rejects.toMatchObject({ status: 403, code: "WRONG_PASSWORD" });
    await service.confirmPassword(id, PASSWORD);
    await query("INSERT INTO documents (owner_id, title, filename, mime_type, size_bytes, sha256, content) VALUES ($1, 't', 'f.txt', 'text/plain', 1, $2, 'x')", [id, Math.random().toString(36)]);
    await service.deleteAccount(id);
    expect(await query("SELECT 1 FROM accounts WHERE id = $1", [id])).toHaveLength(0);
    expect(await query("SELECT 1 FROM documents WHERE owner_id = $1", [id])).toHaveLength(0);
  });
});

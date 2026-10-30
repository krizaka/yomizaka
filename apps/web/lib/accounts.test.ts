import { hashPassword } from "@krizaka/auth";
import { describe, expect, it, vi } from "vitest";

const row = {
  id: "a1",
  email: "eric@example.com",
  status: "ACTIVE",
  email_verified_at: null as Date | null,
  locale: "fr",
  password_hash: "",
};
vi.mock("./db", () => ({ query: vi.fn(async (text: string) => (text.startsWith("SELECT") ? [row] : [])) }));
vi.mock("./audit", () => ({ audit: vi.fn(async () => undefined) }));

import { checkPassword } from "./accounts";

describe("sign-in of a self-serve account", () => {
  it("is refused until the e-mail address is confirmed, once the password is right", async () => {
    row.password_hash = await hashPassword("correct horse battery");
    await expect(checkPassword("eric@example.com", "correct horse battery", new Headers())).rejects.toMatchObject({
      body: { code: "EMAIL_NOT_VERIFIED" },
    });
    await expect(checkPassword("eric@example.com", "wrong password here", new Headers())).rejects.toMatchObject({
      body: { code: "INVALID_CREDENTIALS" },
    });
    row.email_verified_at = new Date();
    await expect(checkPassword("eric@example.com", "correct horse battery", new Headers())).resolves.toMatchObject({
      id: "a1",
    });
  });
});

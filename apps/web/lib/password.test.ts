import { decoyHash, hashPassword, passwordProblem, verifyPassword } from "@krizaka/auth";
import { describe, expect, it } from "vitest";

describe("passwords", () => {
  it("hashes with scrypt and a salt: the right password passes, a wrong one does not", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await hashPassword("correct horse battery")).not.toBe(hash);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterz", hash)).toBe(false);
    expect(await verifyPassword("x", "bcrypt$whatever")).toBe(false);
    expect(await verifyPassword("anything", await decoyHash())).toBe(false);
  });

  it("asks for 12 characters at least", () => {
    expect(passwordProblem("short")).toBe("TOO_SHORT");
    expect(passwordProblem("a".repeat(12))).toBeNull();
    expect(passwordProblem("a".repeat(300))).toBe("TOO_LONG");
  });
});

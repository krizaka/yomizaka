import { describe, expect, it } from "vitest";

import { decoyHash, hashPassword, passwordProblem, verifyPassword } from "./password";
import { hit, limit, resetRateLimits } from "./rate-limit";

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

describe("rate limits", () => {
  it("allows the limit, then refuses with Retry-After until the window ends", () => {
    resetRateLimits();
    const now = 1_000_000;
    expect(hit("k", 2, 60, now).allowed).toBe(true);
    expect(hit("k", 2, 60, now).allowed).toBe(true);
    expect(hit("k", 2, 60, now + 1000)).toEqual({ allowed: false, retryAfter: 59 });
    expect(hit("k", 2, 60, now + 61_000).allowed).toBe(true);
  });

  it("counts per address and per subject: a 429 carries its code", () => {
    resetRateLimits();
    const req = { headers: new Headers({ "x-forwarded-for": "203.0.113.7" }) };
    limit("sign-in", req, "a@b.c", [10, 60], [1, 60]);
    try {
      limit("sign-in", req, "A@B.C", [10, 60], [1, 60]);
      throw new Error("not refused");
    } catch (error) {
      expect((error as { status: number }).status).toBe(429);
      expect((error as { body: { code: string } }).body.code).toBe("RATE_LIMITED");
    }
  });
});

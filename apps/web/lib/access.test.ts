import { describe, expect, it } from "vitest";

import { hostAllowed, ipAllowed } from "./access";
import { isToken, newToken, tokenHash } from "./session";

describe("the administration's address lock", () => {
  const from = (ip: string) => new Headers({ "do-connecting-ip": ip });
  it("lets in only an address of AUTH_ALLOWED_IPS, read from the edge's header", () => {
    const env = { NODE_ENV: "production", AUTH_ALLOWED_IPS: "203.0.113.7", ABUSE_CLIENT_IP_HEADER: "do-connecting-ip" };
    expect(ipAllowed(from("203.0.113.7"), env)).toBe(true);
    expect(ipAllowed(from("198.51.100.9"), env)).toBe(false);
    expect(ipAllowed(new Headers(), env)).toBe(false);
  });
  it("lets nobody in production without a list; anybody in development", () => {
    expect(ipAllowed(from("203.0.113.7"), { NODE_ENV: "production" })).toBe(false);
    expect(ipAllowed(new Headers(), { NODE_ENV: "development" })).toBe(true);
  });
  it("never trusts the left of X-Forwarded-For (the client writes it)", () => {
    const env = { NODE_ENV: "production", AUTH_ALLOWED_IPS: "203.0.113.7" };
    expect(ipAllowed(new Headers({ "x-forwarded-for": "203.0.113.7, 198.51.100.9" }), env)).toBe(false);
  });
});

describe("the administration host", () => {
  const env = { NODE_ENV: "production", AUTH_ALLOWED_IPS: "203.0.113.7", ABUSE_CLIENT_IP_HEADER: "do-connecting-ip" };
  const call = (host: string, ip: string) => new Headers({ host, "do-connecting-ip": ip });
  it("refuses a foreign address everywhere on admin.yomizaka.com, the sign-in included", () => {
    expect(hostAllowed(call("admin.yomizaka.com", "198.51.100.9"), env)).toBe(false);
    expect(hostAllowed(call("admin.yomizaka.com", "203.0.113.7"), env)).toBe(true);
  });
  it("leaves the product host open to everyone", () => {
    expect(hostAllowed(call("dev.yomizaka.com", "198.51.100.9"), env)).toBe(true);
  });
});

describe("session tokens", () => {
  it("are random, shaped, and kept only as a keyed hash", () => {
    const a = newToken();
    expect(isToken(a)).toBe(true);
    expect(a).not.toBe(newToken());
    expect(isToken("ys1.short")).toBe(false);
    expect(tokenHash(a, "s".repeat(32))).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash(a, "s".repeat(32))).not.toBe(tokenHash(a, "t".repeat(32)));
  });
});

describe("run durations", async () => {
  const { durationSeconds } = await import("./admin");
  it("are finished − created, null while running", () => {
    expect(durationSeconds(new Date("2026-10-15T00:00:00Z"), new Date("2026-10-15T00:00:42Z"))).toBe(42);
    expect(durationSeconds(new Date("2026-10-15T00:00:00Z"), null)).toBeNull();
  });
});

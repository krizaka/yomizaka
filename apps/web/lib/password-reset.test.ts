import { readFileSync } from "node:fs";

import { AccountError } from "@krizaka/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "./http";
import { applyReset, requestReset,type ResetDeps } from "./password-reset";
import { resetRateLimits } from "./rate-limit";
import { defOf } from "./settings/registry";

/** A deployment with one account, `known@example.test`. The service is the package's: it answers the same either way, mails only the known one. */
function world(overrides: { reset?: (token: string, next: string, now: Date) => Promise<"CHANGED" | "INVALID"> } = {}) {
  const mails: string[] = [];
  const audits: Parameters<ResetDeps["audit"]>[0][] = [];
  const deps: ResetDeps = {
    accounts: {
      requestPasswordReset: async (email) => {
        if (email.trim().toLowerCase() === "known@example.test") mails.push(email);
      },
      resetPassword: overrides.reset ?? (async () => "CHANGED"),
    },
    audit: async (entry) => void audits.push(entry),
  };
  return { deps, mails, audits };
}
const request = (ip = "203.0.113.7") => ({ headers: new Headers({ "x-forwarded-for": ip }) });
const NOW = new Date("2026-10-24T12:00:00.000Z");
const TOKEN = `ye1.${"A".repeat(43)}`;
const PASSWORD = "a-very-secret-new-password";

beforeEach(() => resetRateLimits());

describe("asking for a reset link", () => {
  it("answers the same for a known and an unknown address — and writes the same audit line", async () => {
    const { deps, mails, audits } = world();
    const known = await requestReset(deps, { email: "known@example.test" }, request(), NOW);
    const unknown = await requestReset(deps, { email: "nobody@example.test" }, request("203.0.113.8"), NOW);
    expect(known).toEqual(unknown);
    expect(mails).toHaveLength(1);
    expect(audits).toHaveLength(2);
    expect(audits[0]).toEqual({ ...audits[1], headers: audits[0]!.headers });
  });

  it("still answers when the mail cannot leave: a failure would tell a stranger the account exists", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { deps, audits } = world();
    deps.accounts.requestPasswordReset = async () => {
      throw new Error("Mail provider refused: invalid recipient known@example.test");
    };
    await expect(requestReset(deps, { email: "known@example.test" }, request(), NOW)).resolves.toEqual({ ok: true });
    expect(audits).toHaveLength(1);
    expect(error).toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/known@example\.test|example\.test|recipient/);
    error.mockRestore();
  });

  it("is limited: 3 a time per address, then 429 with the time to wait — known or not", async () => {
    const { deps } = world();
    for (const email of ["known@example.test", "nobody@example.test"]) {
      for (let i = 0; i < 3; i += 1) await requestReset(deps, { email }, request(`198.51.100.${email.length}`), NOW);
      const refused = await requestReset(deps, { email }, request(`198.51.100.${email.length}`), NOW).catch((e: unknown) => e);
      expect(refused).toBeInstanceOf(HttpError);
      expect(refused).toMatchObject({ status: 429, body: { code: "RATE_LIMITED" } });
      expect((refused as HttpError).headers["Retry-After"]).toBeDefined();
    }
  });

  it("is limited per client address too: 10 an hour whatever the addresses asked", async () => {
    const { deps } = world();
    for (let i = 0; i < 10; i += 1) await requestReset(deps, { email: `p${i}@example.test` }, request("192.0.2.9"), NOW);
    await expect(requestReset(deps, { email: "p11@example.test" }, request("192.0.2.9"), NOW)).rejects.toMatchObject({ status: 429 });
    await expect(requestReset(deps, { email: "p11@example.test" }, request("192.0.2.10"), NOW)).resolves.toEqual({ ok: true });
  });

  it("an audit line per request, naming neither the address nor any token", async () => {
    const { deps, audits } = world();
    await requestReset(deps, { email: "known@example.test" }, request(), NOW);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "auth.password_reset_requested", actorId: null });
    expect(JSON.stringify({ ...audits[0], headers: undefined })).not.toContain("known@example.test");
  });
});

describe("choosing the new password", () => {
  it("changes it, and writes one audit line with neither the token nor the password", async () => {
    const { deps, audits } = world();
    await expect(applyReset(deps, { token: TOKEN, password: PASSWORD }, request(), NOW)).resolves.toEqual({ ok: true });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "auth.password_reset", detail: { result: "changed" } });
    const written = JSON.stringify({ ...audits[0], headers: undefined });
    expect(written).not.toContain(TOKEN);
    expect(written).not.toContain(PASSWORD);
  });

  it("refuses an expired or already used link (the package says INVALID for both) with a stable code, and audits it without the token", async () => {
    const { deps, audits } = world({ reset: async () => "INVALID" });
    const refused = await applyReset(deps, { token: TOKEN, password: PASSWORD }, request(), NOW).catch((e: unknown) => e);
    expect(refused).toMatchObject({ status: 400, body: { code: "RESET_INVALID" } });
    expect(audits[0]).toMatchObject({ action: "auth.password_reset", detail: { result: "invalid" } });
    expect(JSON.stringify({ ...audits[0], headers: undefined })).not.toContain(TOKEN);
  });

  it("passes the clock and both values through, and nothing else", async () => {
    const reset = vi.fn(async () => "CHANGED" as const);
    await applyReset(world({ reset }).deps, { token: TOKEN, password: PASSWORD }, request(), NOW);
    expect(reset).toHaveBeenCalledWith(TOKEN, PASSWORD, NOW);
  });

  it("answers a password the package refuses with its code, and does not audit a change", async () => {
    const { deps, audits } = world({
      reset: async () => {
        throw new AccountError(400, "PASSWORD_TOO_SHORT", "At least 12 characters");
      },
    });
    await expect(applyReset(deps, { token: TOKEN, password: "short" }, request(), NOW)).rejects.toMatchObject({ status: 400, body: { code: "PASSWORD_TOO_SHORT" } });
    expect(audits).toHaveLength(0);
  });

  it("is limited too: a guess of links is refused after 20 tries an hour", async () => {
    const { deps } = world({ reset: async () => "INVALID" });
    for (let i = 0; i < 20; i += 1) await applyReset(deps, { token: TOKEN, password: PASSWORD }, request("192.0.2.50"), NOW).catch(() => undefined);
    await expect(applyReset(deps, { token: TOKEN, password: PASSWORD }, request("192.0.2.50"), NOW)).rejects.toMatchObject({ status: 429 });
  });
});

describe("the lifetime of the link is a setting", () => {
  it("lives in the registry from 5 to 1440 minutes, 30 by default", () => {
    const def = defOf("auth.passwordResetMinutes");
    expect(def.default).toBe(30);
    for (const ok of [5, 30, 1440]) expect(def.schema.safeParse(ok).success).toBe(true);
    for (const bad of [4, 1441, 0, -1, 30.5]) expect(def.schema.safeParse(bad).success).toBe(false);
  });
});

describe("the forms that run in the browser", () => {
  it.each(["../components/console/ResetPasswordForm.tsx", "../components/console/SignUpForm.tsx", "../components/console/ForgotPasswordForm.tsx"])("%s does not pull the hashing (node:crypto) into the bundle", (file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    expect(source).not.toMatch(/from "@\/lib\/password"/);
  });
});

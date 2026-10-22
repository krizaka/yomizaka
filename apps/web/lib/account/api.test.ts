import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimits } from "../rate-limit";
import { AccountError } from "./port";

const state = vi.hoisted(() => ({ session: null as null | { id: string; account: { id: string; email: string; perspective: null; role: "USER"; locale: "fr"; name: null; avatarSeed: null } }, service: {} as Record<string, unknown>, mail: true }));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, delete: () => undefined }) }));
vi.mock("../session", async (orig) => ({ ...(await orig<typeof import("../session")>()), resolveSession: async () => state.session }));
vi.mock("../audit", () => ({ audit: async () => undefined }));
vi.mock("../db", () => ({ query: async () => [] }));
vi.mock("@/app/accounts-edge", () => ({ accountService: () => state.service, mailConfigured: () => state.mail }));

const json = (method: string, body?: unknown) => new Request("https://dev.yomizaka.com/x", { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "x-forwarded-for": "203.0.113.11", "content-type": "application/json" } });

beforeEach(() => {
  resetRateLimits();
  state.mail = true;
  state.service = {};
  state.session = { id: "s1", account: { id: "22222222-2222-4222-8222-222222222222", email: "eric@yomizaka.test", perspective: null, role: "USER", locale: "fr", name: null, avatarSeed: null } };
});

describe("the account routes", () => {
  it("refuse a signed-out caller", async () => {
    state.session = null;
    const { PATCH } = await import("../../app/api/me/profile/route");
    expect((await PATCH(json("PATCH", { name: "Éric" }))).status).toBe(401);
  });

  it("answer a port refusal with its stable code (a wrong password is a 403 the page translates)", async () => {
    state.service = {
      changePassword: async () => {
        throw new AccountError(403, "WRONG_PASSWORD", "no");
      },
    };
    const { PUT } = await import("../../app/api/me/password/route");
    const res = await PUT(json("PUT", { current: "x", next: "another-long-password" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "WRONG_PASSWORD" });
  });

  it("the e-mail change fails closed while mail is not configured", async () => {
    state.mail = false;
    const { POST } = await import("../../app/api/me/email/route");
    const res = await POST(json("POST", { newEmail: "new@yomizaka.test", password: "x" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "MAIL_OFF" });
  });

  it("deleting the account asks for the typed address first, before anything is touched", async () => {
    let touched = false;
    state.service = {
      confirmPassword: async () => {
        touched = true;
      },
    };
    const { POST } = await import("../../app/api/me/delete/route");
    const res = await POST(json("POST", { password: "x", email: "someone-else@yomizaka.test" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "EMAIL_MISMATCH" });
    expect(touched).toBe(false);
  });
});

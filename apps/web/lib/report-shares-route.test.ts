import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: null as null | { id: string; account: Record<string, unknown> }, calls: [] as unknown[][] }));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("./session", async (orig) => ({ ...(await orig<typeof import("./session")>()), resolveSession: async () => state.session }));
vi.mock("./settings/guards", () => ({ assertOpen: async () => undefined }));
vi.mock("./settings/instance", () => ({ appSettings: () => ({ get: async () => undefined }) }));
vi.mock("./log", () => ({ logError: () => undefined, logInfo: () => undefined, logWarn: () => undefined }));
vi.mock("./owner-report-shares", () => ({
  createShare: async (...a: unknown[]) => (state.calls.push(["create", ...a]), { id: "s1", token: "tok", expiresAt: "2026-11-03T00:00:00.000Z" }),
  listShares: async (...a: unknown[]) => (state.calls.push(["list", ...a]), [{ id: "s1", recipient: "", state: "live", createdAt: "x", expiresAt: "y", views: 2 }]),
  revokeShare: async (...a: unknown[]) => void state.calls.push(["revoke", ...a]),
}));

import { DELETE, GET, POST } from "../app/api/applications/[id]/report-shares/route";
import { resetRateLimits } from "./limits";

const FILE = "22222222-2222-4222-8222-222222222222";
const ERIC = { id: "11111111-1111-4111-8111-111111111111", email: "eric@yomizaka.test", role: "USER", locale: "fr", perspective: "landlord" };
const ctx = { params: Promise.resolve({ id: FILE }) };
const req = (method: string, body?: unknown) => new Request(`https://dev.yomizaka.com/api/applications/${FILE}/report-shares`, { method, headers: { "x-forwarded-for": "203.0.113.9", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

beforeEach(() => {
  resetRateLimits();
  state.session = { id: "s", account: ERIC };
  state.calls = [];
});

describe("the owner links of a file (yomizaka#128)", () => {
  it("creates a link with the chosen days: 201, the token once, never cached", async () => {
    const res = await POST(req("POST", { days: 30 }), ctx);
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toMatchObject({ id: "s1", token: "tok" });
    expect(state.calls[0]?.slice(0, 4)).toMatchObject(["create", { id: ERIC.id }, FILE, { days: 30 }]);
  });

  it("lists the links of the file with their views", async () => {
    const res = await GET(req("GET"), ctx);
    expect((await res.json()).shares[0]).toMatchObject({ id: "s1", state: "live", views: 2 });
    expect(state.calls[0]?.slice(0, 3)).toEqual(["list", ERIC.id, FILE]);
  });

  it("revokes one link of the file", async () => {
    const res = await DELETE(req("DELETE", { shareId: "s1" }), ctx);
    expect(await res.json()).toEqual({ revoked: true });
    expect(state.calls[0]?.slice(0, 4)).toMatchObject(["revoke", { id: ERIC.id }, FILE, "s1"]);
  });

  it("signed out, none of the three answers", async () => {
    state.session = null;
    for (const res of [await GET(req("GET"), ctx), await POST(req("POST", {}), ctx), await DELETE(req("DELETE", { shareId: "s1" }), ctx)]) expect(res.status).toBe(401);
    expect(state.calls).toEqual([]);
  });
});

import { describe, expect, it, vi } from "vitest";

import { refuse } from "@/lib/http";

const gate = vi.hoisted(() => ({ session: null as null | { account: { id: string; email: string } } }));
vi.mock("@/lib/access", () => ({
  requireAdmin: async () => {
    if (!gate.session) throw refuse(401, "UNAUTHENTICATED", "Sign in first");
    if (gate.session.account.email.startsWith("user")) throw refuse(403, "FORBIDDEN", "Administrators only");
    return gate.session;
  },
}));
const calls = vi.hoisted(() => ({ touched: 0 }));
vi.mock("@/app/storage-providers", () => ({
  storageRuntime: () => "dev",
  providers: () => (calls.touched++, null),
}));

import { POST as setDefault } from "./[id]/default/route";
import { PUT as changeKey } from "./[id]/key/route";
import { DELETE as disable } from "./[id]/route";
import { POST as retest } from "./[id]/test/route";
import { GET as list, POST as add } from "./route";

const ctx = { params: Promise.resolve({ id: "p1" }) };
const body = (b: unknown) => new Request("http://x/api/admin/storage", { method: "POST", body: JSON.stringify(b) });

describe("the storage providers API is for administrators only", () => {
  it("answers 401 without a session and 403 to a non-administrator, and touches no provider", async () => {
    for (const session of [null, { account: { id: "u", email: "user@x.test" } }]) {
      gate.session = session;
      const status = session ? 403 : 401;
      expect((await list(new Request("http://x"))).status).toBe(status);
      expect((await add(body({}))).status).toBe(status);
      expect((await retest(body({}), ctx)).status).toBe(status);
      expect((await setDefault(body({ dataKind: "documents" }), ctx)).status).toBe(status);
      expect((await changeKey(body({ credentials: { accessKey: "x" } }), ctx)).status).toBe(status);
      expect((await disable(body({}), ctx)).status).toBe(status);
    }
    expect(calls.touched).toBe(0);
  });

  it("answers 503 STORAGE_VAULT_MISSING to an administrator when no vault key is deployed (nothing can be sealed)", async () => {
    gate.session = { account: { id: "a", email: "admin@x.test" } };
    const answer = await list(new Request("http://x"));
    expect(answer.status).toBe(503);
    expect(await answer.json()).toMatchObject({ code: "STORAGE_VAULT_MISSING" });
  });

  it("validates the body before it reaches the vault: 400 for a bad default kind or an empty key change", async () => {
    gate.session = { account: { id: "a", email: "admin@x.test" } };
    expect((await setDefault(body({ dataKind: "passwords" }), ctx)).status).toBe(400);
    expect((await changeKey(body({ credentials: { encryptionKey: "x" } }), ctx)).status).toBe(400);
    expect((await add(body({ kind: "", label: "" }))).status).toBe(400);
  });
});

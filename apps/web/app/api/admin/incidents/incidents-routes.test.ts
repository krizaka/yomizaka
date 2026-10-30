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
const calls = vi.hoisted(() => ({ opened: 0, stepped: 0, exported: 0, listed: 0 }));
vi.mock("@/lib/incidents", () => ({
  incidentRegister: async () => (calls.listed++, []),
  openIncident: async () => (calls.opened++, { id: "i1" }),
  stepIncident: async () => (calls.stepped++, { id: "i1" }),
  exportIncidentRegister: async () => (
    calls.exported++,
    { body: "a,b", type: "text/csv; charset=utf-8", filename: "r.csv" }
  ),
}));

import { POST as step } from "./[id]/route";
import { GET as exportRegister } from "./export/route";
import { GET as list, POST as open } from "./route";

const json = (body: unknown) =>
  new Request("http://x/api/admin/incidents", { method: "POST", body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({ id: "i1" }) };
const valid = { kind: "loss", description: "A laptop was lost.", information: ["lease"] };

describe("the incident register API is for administrators only", () => {
  it("answers 401 without a session and 403 to a non-administrator, and does nothing", async () => {
    for (const session of [null, { account: { id: "u", email: "user@x.test" } }]) {
      gate.session = session;
      const status = session ? 403 : 401;
      expect((await list(new Request("http://x"))).status).toBe(status);
      expect((await open(json(valid))).status).toBe(status);
      expect((await step(json({ action: "close" }), ctx)).status).toBe(status);
      expect((await exportRegister(new Request("http://x?format=csv"))).status).toBe(status);
    }
    expect(calls).toEqual({ opened: 0, stepped: 0, exported: 0, listed: 0 });
  });

  it("lets an administrator list, open (201), step and export", async () => {
    gate.session = { account: { id: "a", email: "admin@x.test" } };
    expect((await list(new Request("http://x"))).status).toBe(200);
    expect((await open(json(valid))).status).toBe(201);
    expect((await step(json({ action: "close" }), ctx)).status).toBe(200);
    const file = await exportRegister(new Request("http://x?format=csv"));
    expect(file.headers.get("content-disposition")).toContain("r.csv");
  });

  it("refuses a malformed body or format with 400", async () => {
    gate.session = { account: { id: "a", email: "admin@x.test" } };
    expect((await open(json({ ...valid, information: [] }))).status).toBe(400);
    expect((await step(json({ action: "explode" }), ctx)).status).toBe(400);
    expect((await exportRegister(new Request("http://x?format=xml"))).status).toBe(400);
  });
});

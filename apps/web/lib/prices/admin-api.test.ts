import { memoryPriceStore, priceCatalogue } from "@krizaka/settings";
import { addDays } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PRICE, PRICES } from "../pricing";
import { resetRateLimits } from "../rate-limit";

const state = vi.hoisted(() => ({ role: "ADMIN" as "ADMIN" | "USER" | null, trail: [] as string[] }));
const prices = vi.hoisted(() => ({ catalogue: null as unknown }));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
vi.mock("../session", async (orig) => ({
  ...(await orig<typeof import("../session")>()),
  resolveSession: async () => (state.role ? { id: "s1", account: { id: "22222222-2222-4222-8222-222222222222", email: "admin@yomizaka.test", role: state.role, locale: "fr", perspective: null, name: null, avatarSeed: null } } : null),
}));
vi.mock("../audit", () => ({ audit: async (e: { action: string }) => void state.trail.push(e.action) }));
vi.mock("../db", () => ({ query: async () => [] }));
vi.mock("./catalogue", () => ({ appPrices: () => prices.catalogue }));

const req = (method: string, body?: unknown) => new Request("https://admin.yomizaka.com/api/admin/prices", { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "x-forwarded-for": "203.0.113.20", "content-type": "application/json" } });
const LATER = addDays(new Date(), 30).toISOString();

beforeEach(() => {
  resetRateLimits();
  state.role = "ADMIN";
  state.trail = [];
  prices.catalogue = priceCatalogue(PRICES, memoryPriceStore());
});

describe("the price catalogue's admin API (yomizaka#367)", () => {
  it.each([null, "USER"] as const)("refuses %s", async (role) => {
    state.role = role;
    const { GET, POST } = await import("../../app/api/admin/prices/route");
    expect((await GET(req("GET"))).status).toBe(role ? 403 : 401);
    expect((await POST(req("POST", { key: PRICE.agency, amountCents: 6900 }))).status).toBe(role ? 403 : 401);
    expect(state.trail).toEqual([]);
  });

  it("lists every entry, the internal one included, with its history", async () => {
    const { GET } = await import("../../app/api/admin/prices/route");
    const body = await (await GET(req("GET"))).json();
    expect(body.entries.map((e: { key: string }) => e.key)).toContain(PRICE.api);
    expect(body.history[PRICE.agency].at(-1)).toMatchObject({ actorLabel: "seed", after: { amountCents: 5900 } });
    expect(body.processor).toEqual({ mode: null, amounts: {} });
  });

  it("schedules a change from a date: in force from then, kept in the history, one line in the trail", async () => {
    const { GET, POST } = await import("../../app/api/admin/prices/route");
    const res = await POST(req("POST", { key: PRICE.agency, amountCents: 6900, effectiveFrom: LATER }));
    expect(res.status).toBe(200);
    expect(state.trail).toEqual(["prices.scheduled"]);
    const body = await (await GET(req("GET"))).json();
    const agency = body.entries.find((e: { key: string }) => e.key === PRICE.agency);
    expect(agency.amountCents).toBe(5900);
    expect(agency.upcoming).toEqual([expect.objectContaining({ amountCents: 6900, effectiveFrom: LATER })]);
    expect(body.history[PRICE.agency][0]).toMatchObject({ actorLabel: "admin@yomizaka.test", before: { amountCents: 5900 }, after: { amountCents: 6900 } });
  });

  it.each([
    ["a date in the past", { key: PRICE.agency, amountCents: 6900, effectiveFrom: "2020-01-01T00:00:00Z" }, 400, "BAD_DATE"],
    ["an unknown entry", { key: "yomizaka.gold", amountCents: 100 }, 404, "UNKNOWN_PRICE"],
    ["an entry on sale without a figure", { key: PRICE.document, amountCents: null }, 400, "BAD_VALUE"],
  ])("refuses %s with its code", async (_, body, status, code) => {
    const { POST } = await import("../../app/api/admin/prices/route");
    const res = await POST(req("POST", body));
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
    expect(state.trail).toEqual([]);
  });
});

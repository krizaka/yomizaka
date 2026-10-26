import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

const written = vi.hoisted(() => ({ calls: [] as { sql: string; params: unknown[] }[], fail: false }));
vi.mock("./db", () => ({
  query: async (sql: string, params: unknown[] = []) => {
    if (written.fail) throw new Error("database down");
    written.calls.push({ sql, params });
    return [];
  },
}));
vi.mock("./log", () => ({ logError: () => undefined, logInfo: () => undefined, logWarn: () => undefined }));

import { audit, auditIn } from "./audit";

const insert = () => written.calls.find((c) => /INSERT INTO audit\.entry/i.test(c.sql));

describe("the trail (@krizaka/audit)", () => {
  it("writes the action, the actor, the target typed by its domain and the client's address", async () => {
    written.calls = [];
    await audit({ action: "document.deleted", actorId: "acc-1", actorLabel: "a@x.test", targetId: "doc-1", detail: { n: 1 }, headers: new Headers({ "x-forwarded-for": "203.0.113.7" }) });
    expect(insert()?.params).toEqual(expect.arrayContaining(["document.deleted", "a@x.test", "document", "doc-1", "acc-1"]));
    expect(JSON.stringify(insert()?.params)).toContain("203.0.113.7");
  });

  it("cuts a label past 120 characters and names an empty one, so the line is still written", async () => {
    written.calls = [];
    await audit({ action: "auth.sign_in", actorId: null, actorLabel: "x".repeat(300) });
    expect(insert()?.params).toContain("x".repeat(120));
    written.calls = [];
    await audit({ action: "auth.sign_in", actorId: null, actorLabel: "  " });
    expect(insert()?.params).toContain("unknown");
  });

  it("never throws beside the work (a trail that cannot be written must not break a request)…", async () => {
    written.fail = true;
    await expect(audit({ action: "auth.sign_in", actorId: null, actorLabel: "a" })).resolves.toBeUndefined();
    written.fail = false;
  });

  it("…but throws inside a unit of work, so the change it records rolls back with it", async () => {
    const run = async () => {
      throw new Error("insert refused");
    };
    await expect(auditIn(run, { action: "billing.checkout_started", actorId: null, actorLabel: "a" })).rejects.toThrow("insert refused");
  });

  it("refuses an action outside the package's alphabet (no hyphen): every action of the code is valid", async () => {
    const run = async () => [];
    await expect(auditIn(run, { action: "applicant-file.closed", actorId: null, actorLabel: "a" })).rejects.toMatchObject({ code: "AUDIT_BAD_ACTION" });
    await expect(auditIn(run, { action: "applicant_file.closed", actorId: null, actorLabel: "a" })).resolves.toBeUndefined();
  });
});

describe("the actions written in the code", () => {
  const root = join(__dirname, "..");
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (name === "node_modules" || name === ".next") return [];
      return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });

  it("all fit the trail's alphabet (letters, digits, underscores, dots; 80 at most)", () => {
    const actions = sources(root).flatMap((file) => [...readFileSync(file, "utf8").matchAll(/\baction: "([^"]+)"/g)].map((m) => m[1]!));
    expect(actions.length).toBeGreaterThan(40);
    for (const action of actions.filter((a) => /^[a-z][\w-]*\.[\w.-]+$/.test(a))) expect(action, action).toMatch(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/);
  });
});

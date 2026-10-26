import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { testConnection } from "./connection-test";
import { checkEndpoint, isPrivateAddress } from "./endpoint";
import { memoryStore } from "./memory";
import { residencyOf } from "./regions";
import { open, parseSettingsKey, seal } from "./vault";

describe("a workspace's own endpoint is a request to an address a user chose", () => {
  const publicHost = async () => ["93.184.216.34"];
  it("accepts a public https address and returns its origin", async () => {
    expect(await checkEndpoint("https://s3.example.com/bucket?x=1", { allowLocal: false, resolve: publicHost })).toBe("https://s3.example.com");
  });
  it("refuses plain http, credentials in the address and anything that is not an address", async () => {
    await expect(checkEndpoint("http://s3.example.com", { allowLocal: false, resolve: publicHost })).rejects.toMatchObject({ code: "ENDPOINT_INVALID" });
    await expect(checkEndpoint("https://user:pass@s3.example.com", { allowLocal: false, resolve: publicHost })).rejects.toMatchObject({ code: "ENDPOINT_INVALID" });
    await expect(checkEndpoint("not a url", { allowLocal: false, resolve: publicHost })).rejects.toMatchObject({ code: "ENDPOINT_INVALID" });
  });
  it("refuses private, loopback, link-local and metadata addresses, written as an IP or reached by a name", async () => {
    for (const bad of ["https://127.0.0.1", "https://10.1.2.3", "https://192.168.0.5", "https://172.20.0.1", "https://169.254.169.254", "https://[::1]", "https://localhost", "https://db.internal", "https://intranet"]) {
      await expect(checkEndpoint(bad, { allowLocal: false, resolve: publicHost }), bad).rejects.toMatchObject({ code: "ENDPOINT_NOT_ALLOWED" });
    }
    await expect(checkEndpoint("https://sneaky.example.com", { allowLocal: false, resolve: async () => ["10.0.0.7"] })).rejects.toMatchObject({ code: "ENDPOINT_NOT_ALLOWED" });
    await expect(checkEndpoint("https://gone.example.com", { allowLocal: false, resolve: async () => [] })).rejects.toMatchObject({ code: "ENDPOINT_INVALID" });
  });
  it("lets a local test server through over http in development only", async () => {
    expect(await checkEndpoint("http://localhost:9000", { allowLocal: true })).toBe("http://localhost:9000");
    await expect(checkEndpoint("http://localhost:9000", { allowLocal: false })).rejects.toMatchObject({ code: "ENDPOINT_INVALID" });
  });
  it("knows the private ranges", () => {
    expect(isPrivateAddress("100.64.0.1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
    expect(isPrivateAddress("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
  });
});

describe("credentials are sealed for the database", () => {
  const key = crypto.randomBytes(32);
  it("round-trips, differs each time and never contains the secret", () => {
    const a = seal("s3-secret-value", key);
    expect(open(a, key)).toBe("s3-secret-value");
    expect(seal("s3-secret-value", key)).not.toBe(a);
    expect(a).not.toContain("s3-secret-value");
  });
  it("opens only with its key, and refuses a tampered value", () => {
    const a = seal("x", key);
    expect(() => open(a, crypto.randomBytes(32))).toThrow();
    // flip every bit of the last byte: always a different value (replacing characters by a fixed pair sometimes changed nothing)
    const raw = Buffer.from(a.slice(3), "base64url");
    raw[raw.length - 1] = raw.at(-1)! ^ 0xff;
    expect(() => open(`v1.${raw.toString("base64url")}`, key)).toThrow();
    expect(() => parseSettingsKey(Buffer.alloc(8).toString("base64"))).toThrow();
  });
});

describe("residency is read from the region", () => {
  it("says Canada for a Canadian region and elsewhere for the rest", () => {
    expect(residencyOf("tor1")).toBe("canada");
    expect(residencyOf("CA-CENTRAL-1")).toBe("canada");
    expect(residencyOf("eu-west-3")).toBe("elsewhere");
  });
});

describe("the connection test: write, read back, delete", () => {
  let t = 0;
  const clock = () => (t += 5);
  it("passes on a store that works, and leaves nothing behind", async () => {
    const store = memoryStore();
    const out = await testConnection(store, "abc", clock);
    expect(out.ok).toBe(true);
    expect(out.steps.map((s) => [s.name, s.ok])).toEqual([["write", true], ["read", true], ["delete", true]]);
    expect(store.size()).toBe(0);
  });
  it("stops at the write when the store refuses it, and reports why without a secret", async () => {
    const store = {
      ...memoryStore(),
      put: async () => {
        throw new Error("Storage refused the write (403)");
      },
    };
    const out = await testConnection(store, "abc", clock);
    expect(out.ok).toBe(false);
    expect(out.steps).toHaveLength(1);
    expect(out.steps[0]).toMatchObject({ name: "write", ok: false, error: "Storage refused the write (403)" });
  });
  it("fails when what is read is not what was written, or the probe survives the delete", async () => {
    const lying = memoryStore();
    const origGet = lying.get;
    const wrong = { ...lying, get: async (k: string) => ({ ...(await origGet(k))!, bytes: new Uint8Array([1]) }) };
    expect((await testConnection(wrong, "a", clock)).steps[1]).toMatchObject({ name: "read", ok: false });
    const sticky = { ...memoryStore(), delete: async () => undefined };
    expect((await testConnection(sticky, "b", clock)).steps[2]).toMatchObject({ name: "delete", ok: false });
  });
});

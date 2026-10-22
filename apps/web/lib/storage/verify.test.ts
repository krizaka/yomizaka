import { describe, expect, it } from "vitest";

import { memoryStore } from "./memory";
import { verifyS3 } from "./verify";

const candidate = { endpoint: "https://s3.example.com", region: "ca-central-1", bucket: "docs", accessKeyId: "id", secretAccessKey: "key" };
const deps = { allowLocal: false, resolve: async () => ["93.184.216.34"], now: () => new Date("2026-10-22T12:00:00Z"), probeId: "p1" };

describe("verifying a workspace's own S3 before it is used", () => {
  it("passes on a working bucket and says where the data would live", async () => {
    const v = await verifyS3(candidate, { ...deps, makeStore: () => memoryStore() });
    expect(v).toMatchObject({ ok: true, origin: "https://s3.example.com", host: "s3.example.com", region: "ca-central-1", residency: "canada", error: null });
    expect(v.steps.map((s) => s.name)).toEqual(["write", "read", "delete"]);
  });
  it("says « elsewhere » for a region outside Canada", async () => {
    expect((await verifyS3({ ...candidate, region: "eu-west-3" }, { ...deps, makeStore: () => memoryStore() })).residency).toBe("elsewhere");
  });
  it("does not even connect to an address on Krizaka's own network", async () => {
    let connected = false;
    const v = await verifyS3({ ...candidate, endpoint: "https://169.254.169.254" }, { ...deps, makeStore: () => { connected = true; return memoryStore(); } });
    expect(v).toMatchObject({ ok: false, error: "ENDPOINT_NOT_ALLOWED", steps: [] });
    expect(connected).toBe(false);
  });
  it("reports a store that refuses the write, step by step", async () => {
    const refusing = { ...memoryStore(), put: async () => { throw new Error("Storage refused the write (403)"); } };
    const v = await verifyS3(candidate, { ...deps, makeStore: () => refusing });
    expect(v.ok).toBe(false);
    expect(v.steps).toEqual([{ name: "write", ok: false, ms: 0, error: "Storage refused the write (403)" }]);
  });
});

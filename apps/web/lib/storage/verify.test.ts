import { memoryObjectStore, type ObjectStore } from "@krizaka/storage";
import { describe, expect, it } from "vitest";

import { verifyS3 } from "./verify";

const NOW = new Date("2026-10-22T12:00:00Z");
const candidate = {
  endpoint: "https://s3.example.com",
  region: "ca-central-1",
  bucket: "docs",
  accessKeyId: "id",
  secretAccessKey: "key",
};
const deps = {
  ctx: {
    runtime: "server" as const,
    environment: "prod" as const,
    fetch: async () => {
      throw new Error("no network in a unit test");
    },
    clock: { now: () => NOW },
  },
  resolve: async () => ["93.184.216.34"],
  probeId: "p1",
};

/** The endpoint rules (written form, DNS answer) and the probe are @krizaka/storage's; this checks what the product answers a person from them. */
describe("verifying a person's own S3 before it is saved", () => {
  it("passes on a working bucket and says where the data would live", async () => {
    const v = await verifyS3(candidate, { ...deps, store: memoryObjectStore() });
    expect(v).toMatchObject({
      ok: true,
      origin: "https://s3.example.com",
      host: "s3.example.com",
      region: "ca-central-1",
      residency: "canada",
      error: null,
    });
    expect(v.steps.map((s) => s.name)).toEqual(["write", "read", "delete"]);
  });
  it("says « elsewhere » for a region outside Canada", async () => {
    expect(
      (await verifyS3({ ...candidate, region: "eu-west-3" }, { ...deps, store: memoryObjectStore() })).residency,
    ).toBe("elsewhere");
  });
  it("does not even connect to an address on Krizaka's own network, written or reached by a name", async () => {
    for (const endpoint of [
      "https://169.254.169.254",
      "https://127.0.0.1",
      "http://s3.example.com",
      "https://user:pass@s3.example.com",
      "https://intranet",
    ]) {
      expect(await verifyS3({ ...candidate, endpoint }, deps), endpoint).toMatchObject({
        ok: false,
        error: "ENDPOINT_NOT_ALLOWED",
        steps: [],
      });
    }
    expect(
      await verifyS3(
        { ...candidate, endpoint: "https://sneaky.example.com" },
        { ...deps, resolve: async () => ["10.0.0.7"] },
      ),
    ).toMatchObject({ ok: false, error: "ENDPOINT_NOT_ALLOWED" });
  });
  it("has no local exception: a development server is on a cloud network too", async () => {
    for (const endpoint of [
      "http://localhost:9000",
      "http://169.254.169.254",
      "https://10.0.0.5",
      "http://192.168.1.2:9000",
    ]) {
      expect(await verifyS3({ ...candidate, endpoint }, deps), endpoint).toMatchObject({
        ok: false,
        error: "ENDPOINT_NOT_ALLOWED",
        steps: [],
      });
    }
  });
  it("refuses something that is not an address", async () => {
    expect(await verifyS3({ ...candidate, endpoint: "not a url" }, deps)).toMatchObject({
      ok: false,
      error: "ENDPOINT_INVALID",
      steps: [],
    });
  });
  it("reports a store that refuses the write, step by step", async () => {
    const refusing: ObjectStore = {
      ...memoryObjectStore(),
      put: async () => {
        throw new Error("Storage refused the write (403)");
      },
    };
    const v = await verifyS3(candidate, { ...deps, store: refusing });
    expect(v.ok).toBe(false);
    expect(v.steps).toEqual([{ name: "write", ok: false, ms: 0, error: "Storage refused the write (403)" }]);
  });
});

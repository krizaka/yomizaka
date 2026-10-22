import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { documentStoreContract } from "./contract.testkit";
import { encrypted } from "./encrypted";
import { s3Store } from "./s3";

/**
 * The S3 adapter against a real S3-compatible server — a local MinIO, never a paid service. Set STORAGE_IT_S3_ENDPOINT
 * (`http://localhost:9000`), STORAGE_IT_S3_USER, STORAGE_IT_S3_PASS and STORAGE_IT_S3_BUCKET to run it.
 */
const e = process.env;
const enabled = !!e.STORAGE_IT_S3_ENDPOINT && !!e.STORAGE_IT_S3_USER && !!e.STORAGE_IT_S3_PASS && !!e.STORAGE_IT_S3_BUCKET;
const make = (pass = e.STORAGE_IT_S3_PASS!) => s3Store({ endpoint: e.STORAGE_IT_S3_ENDPOINT!, region: "us-east-1", bucket: e.STORAGE_IT_S3_BUCKET!, accessKeyId: e.STORAGE_IT_S3_USER!, secretAccessKey: pass, prefix: "yomizaka-it", residency: "unknown", now: () => new Date() });

describe.runIf(enabled)("s3 adapter (MinIO)", () => {
  documentStoreContract("s3", () => make());
  documentStoreContract("s3 + encryption", () => encrypted(make(), crypto.randomBytes(32)));

  it("hands out a presigned link the browser can follow", async () => {
    const store = make();
    await store.put("it/presigned/doc.txt", new TextEncoder().encode("bonjour"), { contentType: "text/plain" });
    const link = (await store.signedUrl("it/presigned/doc.txt", 60))!;
    const res = await fetch(link);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("bonjour");
    await store.delete("it/presigned/doc.txt");
  });

  it("refuses a wrong credential", async () => {
    await expect(make("wrong").put("it/x/doc.txt", new Uint8Array([1]), { contentType: "text/plain" })).rejects.toMatchObject({ status: 502 });
  });
});

describe("s3 adapter (description)", () => {
  it("says where it lives: the host, the region, Canadian residency as configured, encryption when asked of the provider", () => {
    const d = s3Store({ endpoint: "https://tor1.digitaloceanspaces.com", region: "tor1", bucket: "b", accessKeyId: "a", secretAccessKey: "s", prefix: "yomizaka", residency: "canada", serverSideEncryption: true, now: () => new Date() }).describe();
    expect(d).toEqual({ kind: "s3", endpoint: "tor1.digitaloceanspaces.com", region: "tor1", residency: "canada", encrypted: true, owner: "krizaka", devOnly: false });
  });
});

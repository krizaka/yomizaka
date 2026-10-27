import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { storageFrom } from "./config";
import { documentStoreContract } from "./contract.testkit";

/**
 * The S3 store (`@krizaka/storage`'s bucketStore) against a real S3-compatible server — a local S3 server (scripts/ci-s3.sh), never a paid
 * service. Set STORAGE_IT_S3_ENDPOINT (`http://localhost:9000`), STORAGE_IT_S3_USER, STORAGE_IT_S3_PASS and STORAGE_IT_S3_BUCKET to run it.
 */
const e = process.env;
const enabled = !!e.STORAGE_IT_S3_ENDPOINT && !!e.STORAGE_IT_S3_USER && !!e.STORAGE_IT_S3_PASS && !!e.STORAGE_IT_S3_BUCKET;
const env = (pass = e.STORAGE_IT_S3_PASS!, extra: Record<string, string> = {}) => ({
  APP_ENVIRONMENT: "dev" as const,
  MEDIA_DOCUMENTS_PROVIDER: "s3" as const,
  MEDIA_DOCUMENTS_PREFIX: "yomizaka-it",
  MEDIA_STORAGE_ENDPOINT: "storage.bunnycdn.com",
  MEDIA_S3_ENDPOINT: e.STORAGE_IT_S3_ENDPOINT,
  MEDIA_S3_REGION: "us-east-1",
  MEDIA_S3_BUCKET: e.STORAGE_IT_S3_BUCKET,
  MEDIA_S3_ACCESS_KEY_ID: e.STORAGE_IT_S3_USER,
  MEDIA_S3_SECRET_ACCESS_KEY: pass,
  ...extra,
});
const make = (pass?: string) => storageFrom(env(pass), () => new Date());

/** In CI the job sets STORAGE_IT_S3_REQUIRED: a missing variable is a failure, not a silent skip (krizaka/yomizaka#198). */
describe.runIf(!!e.STORAGE_IT_S3_REQUIRED)("s3 adapter (S3 server) is required here", () => {
  it("has its S3 variables", () => expect(enabled).toBe(true));
});

describe.runIf(enabled)("s3 adapter (S3 server)", () => {
  documentStoreContract("s3", () => make());
  documentStoreContract("s3 + encryption", () => storageFrom(env(undefined, { MEDIA_DOCUMENTS_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64") }), () => new Date()));

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

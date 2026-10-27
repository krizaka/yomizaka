import crypto from "node:crypto";

import type { FetchLike } from "@krizaka/storage";
import { describe, expect, it } from "vitest";

import { objectKey } from "../retention";
import { type AdminChoice, type StorageEnv,storageFrom } from "./config";
import { documentStoreContract } from "./contract.testkit";
import { storageNotice } from "./where";

/**
 * Yomizaka keeps its documents through `@krizaka/storage` (ADR-010, yomizaka#445): same keys, same links as before the swap, and the
 * personal-data rules (encrypted at rest, short-lived links, purge) still hold. A fake S3 and a fake Bunny zone record every request.
 */
const NOW = new Date("2026-10-27T12:00:00Z");

interface Held {
  bytes: Uint8Array;
  contentType: string;
}

/** A tiny S3 (path-style): PUT, GET, DELETE on `<origin>/<bucket>/<key>`; every request must be signed (Signature V4). */
function fakeBucket() {
  const objects = new Map<string, Held>();
  const calls: { method: string; url: string; signed: boolean }[] = [];
  const fetchLike: FetchLike = async (url, init) => {
    const target = new URL(url);
    const key = `${target.origin}${target.pathname}`;
    calls.push({ method: init.method, url, signed: (init.headers.authorization ?? init.headers.Authorization ?? "").startsWith("AWS4-HMAC-SHA256") });
    const reply = (status: number, body?: Held) => ({ ok: status < 300, status, headers: { get: (n: string) => (n.toLowerCase() === "content-type" ? (body?.contentType ?? null) : null) }, arrayBuffer: async () => new Uint8Array(body?.bytes ?? []).buffer, text: async () => "" });
    if (init.method === "PUT") {
      objects.set(key, { bytes: init.body!, contentType: init.headers["content-type"] ?? "application/octet-stream" });
      return reply(200);
    }
    if (init.method === "GET") return objects.has(key) ? reply(200, objects.get(key)) : reply(404);
    if (init.method === "DELETE") return reply(objects.delete(key) ? 204 : 404);
    return reply(405);
  };
  return { objects, calls, fetchLike };
}

const S3: StorageEnv = {
  APP_ENVIRONMENT: "prod",
  MEDIA_DOCUMENTS_PROVIDER: "s3",
  MEDIA_DOCUMENTS_PREFIX: "yomizaka",
  MEDIA_STORAGE_ENDPOINT: "storage.bunnycdn.com",
  MEDIA_S3_ENDPOINT: "https://tor1.digitaloceanspaces.com",
  MEDIA_S3_REGION: "tor1",
  MEDIA_S3_BUCKET: "yomizaka-documents",
  MEDIA_S3_ACCESS_KEY_ID: "id",
  MEDIA_S3_SECRET_ACCESS_KEY: "fake-credential",
};
const KEY = objectKey("0f1e2d3c-aaaa-4bbb-8ccc-111122223333", "9a8b7c6d-dddd-4eee-8fff-444455556666", "application/pdf");

describe("the adapters pass the contract of a document store", () => {
  const bucket = fakeBucket();
  documentStoreContract("storageFrom(s3)", () => storageFrom(S3, () => NOW, null, bucket.fetchLike));
  documentStoreContract("storageFrom(s3) + encryption", () => storageFrom({ ...S3, MEDIA_DOCUMENTS_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64") }, () => NOW, null, bucket.fetchLike));
});

describe("documents kept before the swap stay readable", () => {
  it("reads an object stored under the old key layout (bucket/prefix/owner/document/original.ext), signed", async () => {
    const bucket = fakeBucket();
    const body = new TextEncoder().encode("%PDF-1.7 bail");
    // What the previous module wrote: path-style URL, the deployment's prefix, the app's key.
    bucket.objects.set(`https://tor1.digitaloceanspaces.com/yomizaka-documents/yomizaka/${KEY}`, { bytes: body, contentType: "application/pdf" });
    const store = storageFrom(S3, () => NOW, null, bucket.fetchLike);
    expect(await store.get(KEY)).toEqual({ bytes: body, contentType: "application/pdf" });
    expect(bucket.calls.every((c) => c.signed)).toBe(true);
  });

  it("reads an object of the Bunny zone at the same path, and hands out the same link shape", async () => {
    const seen: string[] = [];
    const zone: FetchLike = async (url, init) => {
      seen.push(`${init.method} ${new URL(url).pathname}`);
      return { ok: true, status: 200, headers: { get: () => "application/pdf" }, arrayBuffer: async () => new Uint8Array([1, 2]).buffer, text: async () => "" };
    };
    const env: StorageEnv = { ...S3, APP_ENVIRONMENT: "dev", MEDIA_DOCUMENTS_PROVIDER: "bunny", MEDIA_STORAGE_ZONE: "krizaka-assets", MEDIA_STORAGE_API_KEY: "fake-zone-credential", MEDIA_DOCUMENTS_PULL_HOSTNAME: "cdn.test", MEDIA_DOCUMENTS_TOKEN_KEY: "fake-token-key" };
    const store = storageFrom(env, () => NOW, null, zone);
    await store.get("o1/d1/original.pdf");
    expect(seen).toEqual(["GET /krizaka-assets/yomizaka/o1/d1/original.pdf"]);
    const link = (await store.signedUrl("o1/d1/original.pdf", 60))!;
    const expires = Math.floor(NOW.getTime() / 1000) + 60;
    // the token of before the swap: sha256(tokenKey + path + expires), url-safe base64
    const token = crypto.createHash("sha256").update(`fake-token-key/yomizaka/o1/d1/original.pdf${expires}`).digest("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    expect(link).toBe(`https://cdn.test/yomizaka/o1/d1/original.pdf?token=${token}&expires=${expires}`);
    expect(link).not.toContain("fake-token-key");
    expect(link).not.toContain("fake-zone-credential");
  });

  it("keeps the refusal of a provider that says no: a StorageError 502", async () => {
    const store = storageFrom(S3, () => NOW, null, async () => ({ ok: false, status: 403, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0), text: async () => "" }));
    await expect(store.put(KEY, new Uint8Array([1]), { contentType: "application/pdf" })).rejects.toMatchObject({ status: 502, name: "StorageError" });
  });
});

describe("data paths are personal data", () => {
  it("encrypted at rest: the provider holds ciphertext, the plain text comes back through the store, and no link points at ciphertext", async () => {
    const bucket = fakeBucket();
    const store = storageFrom({ ...S3, MEDIA_DOCUMENTS_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64") }, () => NOW, null, bucket.fetchLike);
    const text = new TextEncoder().encode("Loyer mensuel : 1 450 $ — Sophie Gagnon");
    await store.put(KEY, text, { contentType: "text/plain" });
    const held = [...bucket.objects.values()][0]!;
    expect(Buffer.from(held.bytes).includes(Buffer.from("Sophie"))).toBe(false);
    expect(held.contentType).toBe("application/octet-stream");
    expect(Buffer.from((await store.get(KEY))!.bytes).toString()).toContain("Sophie Gagnon");
    expect(await store.signedUrl(KEY, 60)).toBeNull();
    expect(store.describe().encrypted).toBe(true);
  });

  it("signed links are short-lived: never longer than 15 minutes, whatever is asked or the admin sets", async () => {
    const lived = async (admin: AdminChoice, ttl: number) => {
      const link = (await storageFrom(S3, () => NOW, admin, fakeBucket().fetchLike).signedUrl(KEY, ttl))!;
      return Number(new URL(link).searchParams.get("X-Amz-Expires"));
    };
    expect(await lived(null, 60)).toBe(60);
    expect(await lived(null, 86400)).toBe(900);
    expect(await lived(admin({ signedUrlSeconds: 86400 }), 86400)).toBe(900);
  });

  it("retention purge: deleting a kept document removes its object at its key, and a second purge is harmless", async () => {
    const bucket = fakeBucket();
    const store = storageFrom(S3, () => NOW, null, bucket.fetchLike);
    await store.put(KEY, new Uint8Array([1, 2, 3]), { contentType: "application/pdf" });
    expect(bucket.objects.size).toBe(1);
    await store.delete(KEY);
    expect(bucket.objects.size).toBe(0);
    expect(await store.get(KEY)).toBeNull();
    await expect(store.delete(KEY)).resolves.toBeUndefined();
    expect(bucket.calls.filter((c) => c.method === "DELETE").every((c) => c.url.endsWith(`/yomizaka-documents/yomizaka/${KEY}`))).toBe(true);
  });
});

function admin(over: Partial<NonNullable<AdminChoice>>): NonNullable<AdminChoice> {
  return { provider: "s3", maxMegabytes: 25, signedUrlSeconds: 300, endpoint: "", region: "", bucket: "", zone: "", prefix: "", pullHostname: "", publicBaseUrl: "", ...over };
}

describe("the admin chooses; the residency text follows the configuration", () => {
  it("`local` (the default) follows the deployment's environment", () => {
    expect(storageFrom(S3, () => NOW, admin({ provider: "local" }), fakeBucket().fetchLike).describe()).toMatchObject({ kind: "s3", region: "tor1", residency: "canada" });
  });
  it("an admin who picks another region moves the claim with it: Canada only if the region table proves it", () => {
    const eu = storageFrom(S3, () => NOW, admin({ endpoint: "https://s3.eu-west-3.amazonaws.com", region: "eu-west-3" }), fakeBucket().fetchLike);
    expect(eu.describe()).toMatchObject({ region: "eu-west-3", endpoint: "s3.eu-west-3.amazonaws.com", residency: "elsewhere" });
    expect(storageNotice(eu.describe()).key).toBe("krizakaElsewhere");
    const ca = storageFrom(S3, () => NOW, admin({ endpoint: "https://s3.ca-central-1.amazonaws.com", region: "ca-central-1" }), fakeBucket().fetchLike);
    expect(ca.describe().residency).toBe("canada");
    expect(storageNotice(ca.describe()).key).toBe("krizakaCanada");
  });
  it("an unmapped region is never called Canadian", () => {
    expect(storageFrom(S3, () => NOW, admin({ region: "mars-1" }), fakeBucket().fetchLike).describe().residency).toBe("elsewhere");
  });
  it("an admin cannot switch keeping on: the environment's `none` stays off", () => {
    expect(storageFrom({ ...S3, MEDIA_DOCUMENTS_PROVIDER: "none" }, () => NOW, admin({}), fakeBucket().fetchLike).describe().kind).toBe("none");
  });
  it("an admin-typed endpoint on Krizaka's own network is refused", () => {
    expect(() => storageFrom(S3, () => NOW, admin({ endpoint: "https://169.254.169.254" }), fakeBucket().fetchLike)).toThrow(/private/);
  });
});

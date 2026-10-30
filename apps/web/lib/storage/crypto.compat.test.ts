import crypto from "node:crypto";

import { encryptedStore, memoryObjectStore, open, parseEncryptionKey, parseVaultKey, seal } from "@krizaka/storage";
import { describe, expect, it } from "vitest";

import { documentStoreOver } from "./adapter";
import { documentStoreContract } from "./contract.testkit";

/**
 * Documents and sealed credentials written BEFORE the adoption of `@krizaka/storage` 0.3 (by the local copies, same envelope) must
 * open with the package, under the same key and the same object key. The literals below were produced by the former local code.
 */
const KEY = Buffer.alloc(32, 7);
const OBJECT_KEY = "owner-1/doc-1/lease.pdf";
const OLD_OBJECT = "AQMDAwMDAwMDAwMDA80ZBTgYSsWM66u7qwlZdrQl8cJzKkQ3IRs0KjOFeI9oi3CPltHntB1KsPTEholggpGWXRauy4Vk";
const OLD_SEALED = "v1.BQUFBQUFBQUFBQUFwqs2Lsa5DC958EhT-YVONJHCqlu0_g1WlFo2Ffw";

const descriptor = {
  kind: "s3",
  endpoint: null,
  region: "tor1",
  residency: "canada",
  encrypted: true,
  owner: "krizaka",
  devOnly: false,
} as const;

describe("what was kept before the package stays readable", () => {
  it("opens a document encrypted by the former local wrapper, same key, same object key", async () => {
    const inner = memoryObjectStore();
    await inner.put(OBJECT_KEY, Buffer.from(OLD_OBJECT, "base64"), { contentType: "application/octet-stream" });
    const found = await documentStoreOver(encryptedStore(inner, KEY), descriptor, 900).get(OBJECT_KEY);
    expect(found?.contentType).toBe("application/pdf");
    expect(Buffer.from(found!.bytes).toString()).toBe("Loyer mensuel : 1 450 $");
  });

  it("still binds a document to its object key: moved under another name, it does not open", async () => {
    const inner = memoryObjectStore();
    await inner.put("owner-1/doc-2/lease.pdf", Buffer.from(OLD_OBJECT, "base64"), {
      contentType: "application/octet-stream",
    });
    await expect(
      documentStoreOver(encryptedStore(inner, KEY), descriptor, 900).get("owner-1/doc-2/lease.pdf"),
    ).rejects.toThrow();
  });

  it("writes the same envelope: version 1, 12-byte IV, 16-byte tag, then the ciphertext", async () => {
    const inner = memoryObjectStore();
    await encryptedStore(inner, KEY).put(OBJECT_KEY, Buffer.from("x"), { contentType: "text/plain" });
    const held = Buffer.from((await inner.get(OBJECT_KEY))!.bytes);
    expect(held[0]).toBe(1);
    expect(held).toHaveLength(1 + 12 + 16 + 2 + "text/plain".length + 1);
  });

  it("opens a credential sealed by the former vault, and seals in the same `v1.` form", () => {
    expect(open(OLD_SEALED, KEY)).toBe("s3-secret-key");
    expect(seal("s3-secret-key", KEY)).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    expect(open(seal("another", KEY), KEY)).toBe("another");
  });

  it("parses the same base64 keys, and wants 32 bytes", () => {
    const base64 = crypto.randomBytes(32).toString("base64");
    expect(Buffer.from(parseEncryptionKey(base64)).toString("base64")).toBe(base64);
    expect(Buffer.from(parseVaultKey(base64)).toString("base64")).toBe(base64);
    expect(() => parseEncryptionKey(Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("the encryption wrapper behind the product's port", () =>
  documentStoreContract("encryptedStore(memory)", () =>
    documentStoreOver(encryptedStore(memoryObjectStore(), KEY), descriptor, 900),
  ));

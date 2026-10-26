import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { documentStoreContract } from "./contract.testkit";
import { encrypted, parseEncryptionKey } from "./encrypted";
import { memoryStore } from "./memory";

const KEY = crypto.randomBytes(32);

describe("encryption decorator", () => documentStoreContract("encrypted(memory)", () => encrypted(memoryStore(), KEY)));

describe("what the provider holds is ciphertext, bound to its key", () => {
  it("never holds the plain bytes, and says it is encrypted", async () => {
    const inner = memoryStore();
    const store = encrypted(inner, KEY);
    const secret = new TextEncoder().encode("Loyer mensuel : 1 450 $ — Sophie Gagnon");
    await store.put("o/a/doc.txt", secret, { contentType: "text/plain" });
    const held = (await inner.get("o/a/doc.txt"))!;
    expect(Buffer.from(held.bytes).includes(Buffer.from("Sophie"))).toBe(false);
    expect(store.describe().encrypted).toBe(true);
  });
  it("refuses an object moved under another name, a tampered one and a wrong key", async () => {
    const inner = memoryStore();
    const store = encrypted(inner, KEY);
    await store.put("o/a/doc.txt", new Uint8Array([1, 2, 3]), { contentType: "text/plain" });
    const held = (await inner.get("o/a/doc.txt"))!;
    await inner.put("o/b/doc.txt", held.bytes, { contentType: held.contentType });
    await expect(store.get("o/b/doc.txt")).rejects.toMatchObject({ status: 500 });
    const flipped = new Uint8Array(held.bytes);
    flipped[flipped.length - 1] ^= 1;
    await inner.put("o/c/doc.txt", flipped, { contentType: held.contentType });
    await expect(store.get("o/c/doc.txt")).rejects.toMatchObject({ status: 500 });
    await expect(encrypted(inner, crypto.randomBytes(32)).get("o/a/doc.txt")).rejects.toMatchObject({ status: 500 });
  });
  it("wants a 32-byte key", () => {
    expect(() => parseEncryptionKey(Buffer.alloc(16).toString("base64"))).toThrow();
    expect(parseEncryptionKey(KEY.toString("base64"))).toHaveLength(32);
  });
});

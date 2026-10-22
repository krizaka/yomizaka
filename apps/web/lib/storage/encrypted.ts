import crypto from "node:crypto";

import type { DocumentStore } from "./port";
import { assertKey, StorageError } from "./port";

/**
 * Encrypts what an adapter keeps (AES-256-GCM, a fresh IV per object, the object's key as authenticated data, so a file moved
 * under another name does not open). Envelope: `1 | iv(12) | tag(16) | ciphertext(contentTypeLength(2) | contentType | bytes)`.
 * The key is the owner's (`MEDIA_DOCUMENTS_ENCRYPTION_KEY`, 32 bytes in base64); the provider only ever holds ciphertext.
 */
const VERSION = 1;

export function parseEncryptionKey(base64: string): Buffer {
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw new Error("The documents encryption key must be 32 bytes in base64");
  return key;
}

export function encrypted(inner: DocumentStore, key: Buffer): DocumentStore {
  return {
    async put(k, bytes, meta) {
      assertKey(k);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from(k));
      const type = Buffer.from(meta.contentType);
      const head = Buffer.alloc(2);
      head.writeUInt16BE(type.length);
      const body = Buffer.concat([cipher.update(Buffer.concat([head, type, Buffer.from(bytes)])), cipher.final()]);
      await inner.put(k, Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), body]), { contentType: "application/octet-stream" });
    },
    async get(k) {
      assertKey(k);
      const found = await inner.get(k);
      if (!found) return null;
      const raw = Buffer.from(found.bytes);
      if (raw.length < 30 || raw[0] !== VERSION) throw new StorageError(500, "Unreadable stored object");
      try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(1, 13));
        decipher.setAAD(Buffer.from(k));
        decipher.setAuthTag(raw.subarray(13, 29));
        const plain = Buffer.concat([decipher.update(raw.subarray(29)), decipher.final()]);
        const typeLength = plain.readUInt16BE(0);
        return { contentType: plain.subarray(2, 2 + typeLength).toString(), bytes: new Uint8Array(plain.subarray(2 + typeLength)) };
      } catch {
        throw new StorageError(500, "The stored object failed its integrity check");
      }
    },
    // A link to ciphertext is useless to a browser: the application decrypts and serves the bytes itself.
    signedUrl: async () => null,
    delete: (k) => inner.delete(assertKey(k)),
    describe: () => ({ ...inner.describe(), encrypted: true }),
  };
}

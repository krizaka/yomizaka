import crypto from "node:crypto";

/**
 * Seals a credential for the database (AES-256-GCM, a fresh IV, `v1.<iv|tag|ciphertext>` in base64url). The key is the
 * deployment's (`APP_SETTINGS_ENCRYPTION_KEY`, 32 bytes in base64); a leaked table opens nothing, and a sealed value is never
 * sent back to the browser.
 */
export function parseSettingsKey(base64: string): Buffer {
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw new Error("The settings encryption key must be 32 bytes in base64");
  return key;
}

export function seal(secret: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")}`;
}

export function open(sealed: string, key: Buffer): string {
  if (!sealed.startsWith("v1.")) throw new Error("Unreadable sealed value");
  const raw = Buffer.from(sealed.slice(3), "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

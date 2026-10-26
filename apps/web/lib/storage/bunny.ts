import crypto from "node:crypto";

import type { DocumentStore } from "./port";
import { assertKey, StorageError } from "./port";

export interface BunnyConfig {
  /** The storage API host (`storage.bunnycdn.com`). */
  endpoint: string;
  zone: string;
  /** The zone's password. Never logged, never in a URL we hand out. */
  accessKey: string;
  /** Every object lives under this prefix (`yomizaka`), private to Yomizaka. */
  prefix: string;
  /** The pull zone and its token-authentication key: only with both can the adapter hand out signed links. */
  pullHostname?: string;
  tokenKey?: string;
  fetch?: typeof fetch;
  /** The clock, injected (it dates signed links). */
  now: () => Date;
}

const TYPES: Record<string, string> = { pdf: "application/pdf", txt: "text/plain" };
const typeOf = (key: string) => TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream";

/**
 * Bunny Storage, for the DEVELOPMENT phase and FICTIONAL data only: Bunny has no Canadian region (ADR-0007), so a production
 * deployment refuses it (lib/storage/config.ts). Reads and writes go through the authenticated storage API, never the public
 * pull zone; a signed link exists only when the pull zone has token authentication.
 */
export function bunnyStore(config: BunnyConfig): DocumentStore {
  const call = config.fetch ?? fetch;
  const url = (key: string) => `https://${config.endpoint}/${config.zone}/${config.prefix}/${assertKey(key)}`;
  const headers = { AccessKey: config.accessKey };
  return {
    async put(key, bytes) {
      const res = await call(url(key), { method: "PUT", headers: { ...headers, "content-type": "application/octet-stream" }, body: bytes as unknown as BodyInit });
      if (!res.ok) throw new StorageError(502, `Storage refused the write (${res.status})`);
    },
    async get(key) {
      const res = await call(url(key), { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new StorageError(502, `Storage refused the read (${res.status})`);
      return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: typeOf(key) };
    },
    async signedUrl(key, ttlSeconds) {
      if (!config.pullHostname || !config.tokenKey) return null;
      const path = `/${config.prefix}/${assertKey(key)}`;
      const expires = Math.floor(config.now().getTime() / 1000) + ttlSeconds;
      const token = crypto.createHash("sha256").update(`${config.tokenKey}${path}${expires}`).digest("base64").replaceAll("\n", "").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      return `https://${config.pullHostname}${path}?token=${token}&expires=${expires}`;
    },
    async delete(key) {
      const res = await call(url(key), { method: "DELETE", headers });
      if (!res.ok && res.status !== 404) throw new StorageError(502, `Storage refused the delete (${res.status})`);
    },
    describe: () => ({ kind: "bunny", endpoint: config.endpoint, region: null, residency: "elsewhere", encrypted: false, owner: "krizaka", devOnly: true }),
  };
}

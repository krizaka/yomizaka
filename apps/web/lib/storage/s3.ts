import type { CloudOwner } from "@yomizaka/core";

import type { DocumentStore } from "./port";
import { assertKey, StorageError } from "./port";
import { type Credentials, hashPayload, presignGet, signRequest } from "./sigv4";

export interface S3Config {
  /** The provider's origin: `https://tor1.digitaloceanspaces.com`, `https://s3.example.com`, `http://localhost:9000` (MinIO). */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Every object lives under this prefix. */
  prefix: string;
  /** Whether the region is in Canada (read from lib/storage/config.ts's table, or said by the workspace). */
  residency: "canada" | "elsewhere" | "unknown";
  /** Krizaka's own bucket (default) or a workspace's (bring your own cloud). */
  owner?: CloudOwner;
  /** Server-side encryption asked from the provider (`AES256`), in addition to ours. */
  serverSideEncryption?: boolean;
  fetch?: typeof fetch;
  /** The clock, injected (it signs requests and links). */
  now: () => Date;
}

/**
 * Any S3-compatible provider (DigitalOcean Spaces `tor1`, a customer's own bucket, a local MinIO) through one adapter: path-style
 * URLs, Signature V4, no SDK. Production runs on Spaces `tor1` (Canada); a workspace may bring its own provider.
 */
export function s3Store(config: S3Config): DocumentStore {
  const call = config.fetch ?? fetch;
  const { now } = config;
  const creds: Credentials = { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, region: config.region, service: "s3" };
  const url = (key: string) => `${config.endpoint.replace(/\/$/, "")}/${config.bucket}/${config.prefix}/${assertKey(key)}`;
  const send = async (method: string, key: string, body?: Uint8Array, extra: Record<string, string> = {}) => {
    const target = url(key);
    const headers = signRequest(creds, { method, url: target, headers: extra, payloadHash: hashPayload(body ?? new Uint8Array()), now: now() });
    return call(target, { method, headers, body: body as unknown as BodyInit | undefined });
  };
  return {
    async put(key, bytes, meta) {
      const res = await send("PUT", key, bytes, { "content-type": meta.contentType, ...(config.serverSideEncryption ? { "x-amz-server-side-encryption": "AES256" } : {}) });
      if (!res.ok) throw new StorageError(502, `Storage refused the write (${res.status})`);
    },
    async get(key) {
      const res = await send("GET", key);
      if (res.status === 404) return null;
      if (!res.ok) throw new StorageError(502, `Storage refused the read (${res.status})`);
      return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
    },
    async signedUrl(key, ttlSeconds) {
      return presignGet(creds, url(key), ttlSeconds, now());
    },
    async delete(key) {
      const res = await send("DELETE", key);
      if (!res.ok && res.status !== 404) throw new StorageError(502, `Storage refused the delete (${res.status})`);
    },
    describe: () => ({ kind: "s3", endpoint: new URL(config.endpoint).host, region: config.region, residency: config.residency, encrypted: !!config.serverSideEncryption, owner: config.owner ?? "krizaka", devOnly: false }),
  };
}

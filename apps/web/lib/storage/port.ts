/**
 * The DocumentStore PORT (ADR-0007). The application keeps a document through it and never names a vendor: the adapter is
 * chosen in configuration (lib/storage/config.ts) — nothing kept (the default), Bunny (development and fictional data only),
 * any S3-compatible provider (DigitalOcean Spaces tor1, a customer's own bucket, a local MinIO), the Mac or the phone later.
 */
export interface StoredObject {
  bytes: Uint8Array;
  contentType: string;
}

/** Where a document lives, as the info panel says it (#164). */
export interface StoreDescriptor {
  kind: "none" | "database" | "bunny" | "s3" | "device";
  /** The host the files go to (`tor1.digitaloceanspaces.com`, `s3.example.com`), when there is one. */
  endpoint: string | null;
  region: string | null;
  residency: "canada" | "elsewhere" | "unknown" | "device";
  encrypted: boolean;
  /** Whose storage it is: Krizaka's, the workspace's own cloud (bring your own), or the person's device. */
  owner: "krizaka" | "workspace" | "device";
  /** True when the adapter must never hold real personal data (no Canadian region). */
  devOnly: boolean;
}

export interface DocumentStore {
  put(key: string, bytes: Uint8Array, meta: { contentType: string }): Promise<void>;
  /** The object, or null when there is none. */
  get(key: string): Promise<StoredObject | null>;
  /** A short-lived link the browser can follow, or null when the adapter has none (the app then serves the bytes itself). */
  signedUrl(key: string, ttlSeconds: number): Promise<string | null>;
  /** Idempotent: deleting what is not there succeeds. */
  delete(key: string): Promise<void>;
  describe(): StoreDescriptor;
}

export class StorageError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "StorageError";
  }
}

const KEY = /^[a-z0-9][a-z0-9/_.-]{0,254}$/;
/** An object key: lowercase path made of letters, digits and `/_.-`, never a `..` or an empty segment (no escaping the prefix). */
export function assertKey(key: string): string {
  if (!KEY.test(key) || key.includes("..") || key.includes("//") || key.endsWith("/")) throw new StorageError(400, "Not a valid object key");
  return key;
}

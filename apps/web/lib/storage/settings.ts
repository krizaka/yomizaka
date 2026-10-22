import type { QueryResultRow } from "pg";

import { refuse } from "../http";
import { noneStore } from "./none";
import type { DocumentStore } from "./port";
import { residencyOf } from "./regions";
import { s3Store } from "./s3";
import { open, seal } from "./vault";

/**
 * Where an owner's kept documents live (ADR-0007): `none` (nothing can be kept), `krizaka` (the store this deployment
 * configures), or `s3` (the owner's own S3-compatible cloud: endpoint, region, bucket and credentials, the secret sealed with the
 * deployment's key). Today the owner is the account; it becomes the workspace when workspaces land (#126).
 */
type Query = <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<T[]>;

export const STORAGE_MODES = ["none", "krizaka", "s3"] as const;
export type StorageMode = (typeof STORAGE_MODES)[number];

export interface OwnS3 {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
}

export interface StorageSettings {
  mode: StorageMode;
  keepDefault: boolean;
  s3: (OwnS3 & { hasSecret: boolean }) | null;
  testedAt: string | null;
}

interface Row extends QueryResultRow {
  mode: StorageMode;
  keep_default: boolean;
  s3_endpoint: string | null;
  s3_region: string | null;
  s3_bucket: string | null;
  s3_access_key_id: string | null;
  s3_secret_sealed: string | null;
  tested_at: Date | null;
}

const COLUMNS = "mode, keep_default, s3_endpoint, s3_region, s3_bucket, s3_access_key_id, s3_secret_sealed, tested_at";

const publicView = (r: Row | undefined): StorageSettings =>
  !r
    ? { mode: "krizaka", keepDefault: false, s3: null, testedAt: null }
    : { mode: r.mode, keepDefault: r.keep_default, s3: r.s3_endpoint ? { endpoint: r.s3_endpoint, region: r.s3_region ?? "", bucket: r.s3_bucket ?? "", accessKeyId: r.s3_access_key_id ?? "", hasSecret: !!r.s3_secret_sealed } : null, testedAt: r.tested_at?.toISOString() ?? null };

/** What the page may see: never the secret. */
export async function loadSettings(q: Query, owner: string): Promise<StorageSettings> {
  const [row] = await q<Row>(`SELECT ${COLUMNS} FROM storage_settings WHERE owner_id = $1`, [owner]);
  return publicView(row);
}

export interface SettingsInput {
  mode: StorageMode;
  keepDefault: boolean;
  s3?: OwnS3 & { secretAccessKey?: string };
}

/** Saves the settings. A new secret is sealed; none given keeps the one already stored. `s3` mode needs all its fields. */
export async function saveSettings(q: Query, owner: string, input: SettingsInput, key: Buffer | null, now: Date): Promise<StorageSettings> {
  if (input.keepDefault && input.mode === "none") throw refuse(400, "BAD_REQUEST", "Nothing can be kept by default when keeping is off");
  if (input.mode !== "s3") {
    await q(
      `INSERT INTO storage_settings (owner_id, mode, keep_default, updated_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (owner_id) DO UPDATE SET mode = excluded.mode, keep_default = excluded.keep_default, updated_at = excluded.updated_at`,
      [owner, input.mode, input.keepDefault, now],
    );
    return loadSettings(q, owner);
  }
  const s3 = input.s3;
  if (!s3?.endpoint || !s3.region || !s3.bucket || !s3.accessKeyId) throw refuse(400, "BAD_REQUEST", "Endpoint, region, bucket and access key are required");
  if (!key) throw refuse(503, "SETTINGS_KEY_MISSING", "Storing credentials is not available on this deployment");
  const [existing] = await q<Row>(`SELECT ${COLUMNS} FROM storage_settings WHERE owner_id = $1`, [owner]);
  const sealed = s3.secretAccessKey ? seal(s3.secretAccessKey, key) : (existing?.s3_secret_sealed ?? null);
  if (!sealed) throw refuse(400, "BAD_REQUEST", "The secret access key is required");
  await q(
    `INSERT INTO storage_settings (owner_id, mode, keep_default, s3_endpoint, s3_region, s3_bucket, s3_access_key_id, s3_secret_sealed, tested_at, updated_at)
     VALUES ($1, 's3', $2, $3, $4, $5, $6, $7, $8, $8)
     ON CONFLICT (owner_id) DO UPDATE SET mode = 's3', keep_default = excluded.keep_default, s3_endpoint = excluded.s3_endpoint, s3_region = excluded.s3_region,
       s3_bucket = excluded.s3_bucket, s3_access_key_id = excluded.s3_access_key_id, s3_secret_sealed = excluded.s3_secret_sealed, tested_at = excluded.tested_at, updated_at = excluded.updated_at`,
    [owner, input.keepDefault, s3.endpoint, s3.region, s3.bucket, s3.accessKeyId, sealed, now],
  );
  return loadSettings(q, owner);
}

/** The owner's own S3 as a store (the secret opened here and nowhere else), or null when the owner has none. */
export async function ownS3Store(q: Query, owner: string, key: Buffer | null, now: () => Date): Promise<DocumentStore | null> {
  const [row] = await q<Row>(`SELECT ${COLUMNS} FROM storage_settings WHERE owner_id = $1`, [owner]);
  if (!row || row.mode !== "s3" || !row.s3_endpoint || !row.s3_secret_sealed || !key) return null;
  return s3Store({ endpoint: row.s3_endpoint, region: row.s3_region ?? "", bucket: row.s3_bucket ?? "", accessKeyId: row.s3_access_key_id ?? "", secretAccessKey: open(row.s3_secret_sealed, key), prefix: "yomizaka", residency: residencyOf(row.s3_region ?? ""), owner: "workspace", now });
}

/** The store an owner's documents use: nothing (kept off), the deployment's own (Krizaka), or the owner's S3. */
export async function storeForOwner(q: Query, owner: string, key: Buffer | null, krizaka: DocumentStore, now: () => Date): Promise<{ store: DocumentStore; settings: StorageSettings }> {
  const settings = await loadSettings(q, owner);
  if (settings.mode === "none") return { store: noneStore(), settings };
  if (settings.mode === "s3") {
    const own = await ownS3Store(q, owner, key, now);
    if (!own) throw refuse(503, "STORAGE_UNAVAILABLE", "The workspace's storage is not available");
    return { store: own, settings };
  }
  return { store: krizaka, settings };
}

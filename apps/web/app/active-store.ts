import { parseVaultKey } from "@krizaka/storage";
import { readStorageSettings } from "@krizaka/storage/settings";
import { type CloudOwner, STORAGE_OWNER } from "@yomizaka/core";

import { query } from "@/lib/db";
import type { HeldObject } from "@/lib/document-objects";
import { env } from "@/lib/env";
import { EXTERNAL } from "@/lib/retention";
import { appSettings } from "@/lib/settings/instance";
import { storageFrom } from "@/lib/storage/config";
import { databaseStore } from "@/lib/storage/database";
import { localStore } from "@/lib/storage/local";
import { noneStore } from "@/lib/storage/none";
import type { DocumentStore, StoreDescriptor } from "@/lib/storage/port";
import { ownS3Store, type StorageSettings, storeForOwner } from "@/lib/storage/settings";
import { workingStoreFor } from "@/lib/storage/working";

/** The key that seals a workspace's S3 credentials (null when the deployment has none: storing credentials is then unavailable). */
export const settingsKey = () => {
  const k = env().APP_SETTINGS_ENCRYPTION_KEY;
  return k ? parseVaultKey(k) : null;
};

/** The documents store this deployment configures (Krizaka's): the admin's choice in the settings (`storage.*`) over the environment's. The edge reads both and the clock; the domain receives them. */
const adminStorage = () => readStorageSettings((key) => appSettings().get(key) as Promise<string | number>);

export const krizakaStore = async () => storageFrom(env(), () => new Date(), await adminStorage());

export interface OwnerStores {
  /** Where new kept documents go: nothing, Krizaka's store or the owner's own cloud, from their settings. */
  write: DocumentStore;
  settings: StorageSettings;
  /** The store that holds a document of this owner (by who owns that store); null when it is not available. */
  of: (owner: CloudOwner) => DocumentStore | null;
  describe: (owner: CloudOwner) => StoreDescriptor;
}

/** The stores of an account: its own settings decide where new documents go; each kept document is read from the store that holds it. */
export async function storesOf(ownerId: string): Promise<OwnerStores> {
  const now = () => new Date();
  const key = settingsKey();
  const krizaka = await krizakaStore();
  const own = await ownS3Store(query, ownerId, key, now);
  const { store: write, settings } = await storeForOwner(query, ownerId, key, krizaka, now).catch(() => ({ store: noneStore(), settings: { mode: "none", keepDefault: false, s3: null, testedAt: null } as StorageSettings }));
  const of = (o: CloudOwner) => (o === STORAGE_OWNER.workspace ? own : krizaka);
  return { write, settings, of, describe: (o) => (of(o) ?? noneStore()).describe() };
}

/**
 * The store that holds the bytes of every document that is not kept in a store of its own (ADR-0012), chosen by `APP_DOCUMENTS_STORE`:
 * the database for a deployed environment without a bucket, the deployment's bucket (`spaces`; none configured: null, uploads are refused),
 * or a folder on disk on a laptop and in the tests (a deployed app refuses to start with it).
 */
export async function workingStore(): Promise<DocumentStore | null> {
  return workingStoreFor(env().APP_DOCUMENTS_STORE, {
    spaces: async () => {
      const krizaka = await krizakaStore();
      return krizaka.describe().kind === "none" ? null : krizaka;
    },
    database: () => databaseStore(query),
    folder: () => localStore(),
  });
}

/** The store that holds one document: its owner's cloud or Krizaka's for a kept one, the working store for the rest; undefined when it has none to ask. */
export async function storeForDocument(ownerId: string, documentId: string): Promise<DocumentStore | undefined> {
  const [row] = await query<{ storage: string; storage_owner: CloudOwner }>("SELECT storage, storage_owner FROM documents WHERE owner_id = $1 AND id = $2", [ownerId, documentId]).catch(() => []);
  if (row && !EXTERNAL.has(row.storage as never)) return (await workingStore()) ?? undefined;
  const stores = await storesOf(ownerId);
  return stores.of(row?.storage_owner ?? "krizaka") ?? undefined;
}

/** The holder of a stored file, for the purge: the owner's own cloud when it is theirs, else Krizaka's (kept) or the working store (not kept). */
export async function holderOf(row: HeldObject): Promise<DocumentStore | null> {
  if (!EXTERNAL.has(row.storage as never)) return workingStore();
  return (await storesOf(row.owner_id)).of(row.storage_owner as CloudOwner);
}

/** Where uploaded avatars live: the same provider as the documents (the admin's settings first, through `resolveStorage`), under a prefix of their own (`<prefix>-avatars`); null when no store is configured (avatars are then picked from the set only). */
export async function avatarStore(): Promise<DocumentStore | null> {
  const e = env();
  if (e.MEDIA_DOCUMENTS_PROVIDER === "none") return null;
  try {
    const store = storageFrom({ ...e, MEDIA_DOCUMENTS_PREFIX: `${e.MEDIA_DOCUMENTS_PREFIX}-avatars` }, () => new Date(), await adminStorage());
    return store.describe().kind === "none" ? null : store;
  } catch {
    return null;
  }
}

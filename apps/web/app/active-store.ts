import { type CloudOwner, STORAGE_OWNER } from "@yomizaka/core";

import { query } from "@/lib/db";
import { env } from "@/lib/env";
import { storageFrom } from "@/lib/storage/config";
import { noneStore } from "@/lib/storage/none";
import type { DocumentStore, StoreDescriptor } from "@/lib/storage/port";
import { ownS3Store, type StorageSettings, storeForOwner } from "@/lib/storage/settings";
import { parseSettingsKey } from "@/lib/storage/vault";

/** The key that seals a workspace's S3 credentials (null when the deployment has none: storing credentials is then unavailable). */
export const settingsKey = () => {
  const k = env().APP_SETTINGS_ENCRYPTION_KEY;
  return k ? parseSettingsKey(k) : null;
};

/** The documents store this deployment configures (Krizaka's). The edge reads the environment and the clock; the domain receives them. */
export const krizakaStore = () => storageFrom(env(), () => new Date());

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
  const krizaka = krizakaStore();
  const own = await ownS3Store(query, ownerId, key, now);
  const { store: write, settings } = await storeForOwner(query, ownerId, key, krizaka, now).catch(() => ({ store: noneStore(), settings: { mode: "none", keepDefault: false, s3: null, testedAt: null } as StorageSettings }));
  const of = (o: CloudOwner) => (o === STORAGE_OWNER.workspace ? own : krizaka);
  return { write, settings, of, describe: (o) => (of(o) ?? noneStore()).describe() };
}

/** The store that holds one document (its own owner's cloud or Krizaka's), or undefined when it has none to ask. */
export async function storeForDocument(ownerId: string, documentId: string): Promise<DocumentStore | undefined> {
  const [row] = await query<{ storage_owner: CloudOwner }>("SELECT storage_owner FROM documents WHERE owner_id = $1 AND id = $2", [ownerId, documentId]).catch(() => []);
  const stores = await storesOf(ownerId);
  return stores.of(row?.storage_owner ?? "krizaka") ?? undefined;
}

/** Where uploaded avatars live: the same provider as the documents, under a prefix of their own (`<prefix>-avatars`); null when no store is configured (avatars are then picked from the set only). */
export function avatarStore(): DocumentStore | null {
  const e = env();
  if (e.MEDIA_DOCUMENTS_PROVIDER === "none") return null;
  try {
    return storageFrom({ ...e, MEDIA_DOCUMENTS_PREFIX: `${e.MEDIA_DOCUMENTS_PREFIX}-avatars` }, () => new Date());
  } catch {
    return null;
  }
}

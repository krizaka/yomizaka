import { bunnyStore } from "./bunny";
import { encrypted, parseEncryptionKey } from "./encrypted";
import { noneStore } from "./none";
import type { DocumentStore } from "./port";
import { residencyOf } from "./regions";
import { s3Store } from "./s3";

/** The settings the store needs — read from the environment by the edge, passed in (lib/env.ts's `Env` satisfies it). */
export interface StorageSettings {
  APP_ENVIRONMENT: "dev" | "prod";
  MEDIA_DOCUMENTS_PROVIDER: "none" | "bunny" | "s3";
  MEDIA_DOCUMENTS_PREFIX: string;
  MEDIA_DOCUMENTS_ENCRYPTION_KEY?: string;
  MEDIA_STORAGE_ENDPOINT: string;
  MEDIA_STORAGE_ZONE?: string;
  MEDIA_STORAGE_API_KEY?: string;
  MEDIA_S3_ENDPOINT?: string;
  MEDIA_S3_REGION?: string;
  MEDIA_S3_BUCKET?: string;
  MEDIA_S3_ACCESS_KEY_ID?: string;
  MEDIA_S3_SECRET_ACCESS_KEY?: string;
}

const need = (provider: string, values: Record<string, string | undefined>) => {
  const missing = Object.entries(values).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`MEDIA_DOCUMENTS_PROVIDER=${provider} needs ${missing.join(", ")}`);
};

/** The only place a documents store is chosen. Nothing kept is the default; Bunny is refused outside development. */
export function storageFrom(e: StorageSettings, now: () => Date): DocumentStore {
  let store: DocumentStore;
  if (e.MEDIA_DOCUMENTS_PROVIDER === "bunny") {
    if (e.APP_ENVIRONMENT === "prod") throw new Error("Bunny has no Canadian region: it is for development and fictional data only");
    need("bunny", { MEDIA_STORAGE_ZONE: e.MEDIA_STORAGE_ZONE, MEDIA_STORAGE_API_KEY: e.MEDIA_STORAGE_API_KEY });
    store = bunnyStore({ endpoint: e.MEDIA_STORAGE_ENDPOINT, zone: e.MEDIA_STORAGE_ZONE!, accessKey: e.MEDIA_STORAGE_API_KEY!, prefix: e.MEDIA_DOCUMENTS_PREFIX, now });
  } else if (e.MEDIA_DOCUMENTS_PROVIDER === "s3") {
    need("s3", { MEDIA_S3_ENDPOINT: e.MEDIA_S3_ENDPOINT, MEDIA_S3_REGION: e.MEDIA_S3_REGION, MEDIA_S3_BUCKET: e.MEDIA_S3_BUCKET, MEDIA_S3_ACCESS_KEY_ID: e.MEDIA_S3_ACCESS_KEY_ID, MEDIA_S3_SECRET_ACCESS_KEY: e.MEDIA_S3_SECRET_ACCESS_KEY });
    store = s3Store({
      endpoint: e.MEDIA_S3_ENDPOINT!,
      region: e.MEDIA_S3_REGION!,
      bucket: e.MEDIA_S3_BUCKET!,
      accessKeyId: e.MEDIA_S3_ACCESS_KEY_ID!,
      secretAccessKey: e.MEDIA_S3_SECRET_ACCESS_KEY!,
      prefix: e.MEDIA_DOCUMENTS_PREFIX,
      now,
      residency: residencyOf(e.MEDIA_S3_REGION!),
    });
  } else return noneStore();
  return e.MEDIA_DOCUMENTS_ENCRYPTION_KEY ? encrypted(store, parseEncryptionKey(e.MEDIA_DOCUMENTS_ENCRYPTION_KEY)) : store;
}

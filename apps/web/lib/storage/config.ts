import { type FetchLike } from "@krizaka/storage";
import { type StorageSettings as AdminStorage, storeFromSettings } from "@krizaka/storage/settings";
import { STORAGE_KIND, type StorageProvider } from "@yomizaka/core";

import { documentStoreOver } from "./adapter";
import { encrypted, parseEncryptionKey } from "./encrypted";
import { noneStore } from "./none";
import type { DocumentStore, StoreDescriptor } from "./port";
import { residencyOf } from "./regions";

/** The settings the store needs from the environment — read by the edge, passed in (lib/env.ts's `Env` satisfies it). */
export interface StorageEnv {
  APP_ENVIRONMENT: "dev" | "prod";
  MEDIA_DOCUMENTS_PROVIDER: StorageProvider;
  MEDIA_DOCUMENTS_PREFIX: string;
  MEDIA_DOCUMENTS_ENCRYPTION_KEY?: string;
  MEDIA_STORAGE_ENDPOINT: string;
  MEDIA_STORAGE_ZONE?: string;
  MEDIA_STORAGE_API_KEY?: string;
  MEDIA_DOCUMENTS_PULL_HOSTNAME?: string;
  MEDIA_DOCUMENTS_TOKEN_KEY?: string;
  MEDIA_S3_ENDPOINT?: string;
  MEDIA_S3_REGION?: string;
  MEDIA_S3_BUCKET?: string;
  MEDIA_S3_ACCESS_KEY_ID?: string;
  MEDIA_S3_SECRET_ACCESS_KEY?: string;
}

/** What the admin chose in the settings (`storage.*`, `@krizaka/storage/settings`); null or `local` leaves the deployment's environment in charge. */
export type AdminChoice = AdminStorage | null;

/** A signed link lives at most this long, whatever the admin asks: a document is personal data. */
// @fixed: a link to personal data that outlives a reading session is a leak
export const MAX_SIGNED_URL_SECONDS = 900;

/** The provider that applies: the admin's when they chose one, else the environment's (`none` = keeping is off, and only the environment can say so). */
function effective(e: StorageEnv, admin: AdminChoice): { provider: "none" | "http" | "s3"; settings: AdminStorage } {
  const env: "none" | "http" | "s3" = e.MEDIA_DOCUMENTS_PROVIDER === STORAGE_KIND.bunny ? "http" : e.MEDIA_DOCUMENTS_PROVIDER === STORAGE_KIND.s3 ? "s3" : "none";
  const provider = env === "none" ? "none" : admin && admin.provider !== "local" ? admin.provider : env;
  const pick = (own: string | undefined, fallback: string | undefined) => (own ? own : (fallback ?? ""));
  const http = provider === "http";
  return {
    provider,
    settings: {
      provider: provider === "none" ? "local" : provider,
      maxMegabytes: admin?.maxMegabytes ?? 25,
      signedUrlSeconds: Math.min(admin?.signedUrlSeconds ?? MAX_SIGNED_URL_SECONDS, MAX_SIGNED_URL_SECONDS),
      endpoint: http ? pick(admin?.endpoint, e.MEDIA_STORAGE_ENDPOINT) : pick(admin?.endpoint, e.MEDIA_S3_ENDPOINT),
      region: pick(admin?.region, e.MEDIA_S3_REGION),
      bucket: pick(admin?.bucket, e.MEDIA_S3_BUCKET),
      zone: pick(admin?.zone, e.MEDIA_STORAGE_ZONE),
      prefix: e.MEDIA_DOCUMENTS_PREFIX,
      pullHostname: pick(admin?.pullHostname, e.MEDIA_DOCUMENTS_PULL_HOSTNAME),
      publicBaseUrl: "",
    },
  };
}

/** Where the files are, said from the configuration alone (the region table decides « Canada »; an unmapped region is « elsewhere », never a guess). */
export function describeConfigured(provider: "http" | "s3", s: AdminStorage): StoreDescriptor {
  if (provider === "http") return { kind: STORAGE_KIND.bunny, endpoint: s.endpoint, region: null, residency: "elsewhere", encrypted: false, owner: "krizaka", devOnly: true };
  return { kind: STORAGE_KIND.s3, endpoint: new URL(s.endpoint).host, region: s.region, residency: residencyOf(s.region), encrypted: false, owner: "krizaka", devOnly: false };
}

const need = (provider: string, values: Record<string, string | undefined>) => {
  const missing = Object.entries(values).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`MEDIA_DOCUMENTS_PROVIDER=${provider} needs ${missing.join(", ")}`);
};

/**
 * The only place a documents store is chosen. Nothing kept is the default; the admin's choice (settings) wins over the environment's
 * provider; Bunny (the `http` zone) is refused outside development. Credentials stay in the environment.
 */
export function storageFrom(e: StorageEnv, now: () => Date, admin: AdminChoice = null, call: FetchLike = fetch as unknown as FetchLike): DocumentStore {
  const { provider, settings } = effective(e, admin);
  if (provider === "none") return noneStore();
  if (provider === "http") {
    if (e.APP_ENVIRONMENT === "prod") throw new Error("Bunny has no Canadian region: it is for development and fictional data only");
    need("bunny", { MEDIA_STORAGE_ZONE: settings.zone, MEDIA_STORAGE_API_KEY: e.MEDIA_STORAGE_API_KEY });
  } else need("s3", { MEDIA_S3_ENDPOINT: settings.endpoint, MEDIA_S3_REGION: settings.region, MEDIA_S3_BUCKET: settings.bucket, MEDIA_S3_ACCESS_KEY_ID: e.MEDIA_S3_ACCESS_KEY_ID, MEDIA_S3_SECRET_ACCESS_KEY: e.MEDIA_S3_SECRET_ACCESS_KEY });
  const objects = storeFromSettings(
    settings,
    { accessKeyId: e.MEDIA_S3_ACCESS_KEY_ID, secretAccessKey: e.MEDIA_S3_SECRET_ACCESS_KEY, accessKey: e.MEDIA_STORAGE_API_KEY, tokenKey: e.MEDIA_DOCUMENTS_TOKEN_KEY },
    { fetch: call, clock: { now }, allowLocalEndpoint: e.APP_ENVIRONMENT === "dev" },
  );
  const sealed = !!e.MEDIA_DOCUMENTS_ENCRYPTION_KEY;
  const store = documentStoreOver(objects, describeConfigured(provider, settings), settings.signedUrlSeconds);
  return sealed ? encrypted(store, parseEncryptionKey(e.MEDIA_DOCUMENTS_ENCRYPTION_KEY!)) : store;
}

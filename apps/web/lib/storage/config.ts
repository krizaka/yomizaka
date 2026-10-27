import { describeStore, type FetchLike, STORAGE_CODE, StorageError } from "@krizaka/storage";
import { type DeploymentStorage, openResolved, resolveStorage } from "@krizaka/storage/resolve";
import { type StorageSettings as AdminStorage } from "@krizaka/storage/settings";
import { STORAGE_KIND, type StorageProvider } from "@yomizaka/core";

import { documentStoreOver } from "./adapter";
import { noneStore } from "./none";
import type { DocumentStore } from "./port";
import { asDescriptor } from "./where";

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

/** What the deployment's environment says about the documents (read by the edge, passed in): the shape `resolveStorage` takes. */
export function deploymentOf(e: StorageEnv): DeploymentStorage {
  const provider = e.MEDIA_DOCUMENTS_PROVIDER === STORAGE_KIND.bunny ? "http" : e.MEDIA_DOCUMENTS_PROVIDER === STORAGE_KIND.s3 ? "s3" : "none";
  return {
    environment: e.APP_ENVIRONMENT,
    provider,
    prefix: e.MEDIA_DOCUMENTS_PREFIX,
    encryptionKey: e.MEDIA_DOCUMENTS_ENCRYPTION_KEY,
    http: { endpoint: e.MEDIA_STORAGE_ENDPOINT, zone: e.MEDIA_STORAGE_ZONE, accessKey: e.MEDIA_STORAGE_API_KEY, pullHostname: e.MEDIA_DOCUMENTS_PULL_HOSTNAME, tokenKey: e.MEDIA_DOCUMENTS_TOKEN_KEY },
    s3: { endpoint: e.MEDIA_S3_ENDPOINT, region: e.MEDIA_S3_REGION, bucket: e.MEDIA_S3_BUCKET, accessKeyId: e.MEDIA_S3_ACCESS_KEY_ID, secretAccessKey: e.MEDIA_S3_SECRET_ACCESS_KEY },
  };
}

/** The admin's choice as this product applies it: the prefix is the deployment's (the keys of the kept documents never move) and a document is never public. */
const adminOf = (admin: AdminChoice): AdminChoice => (admin ? { ...admin, prefix: "", publicBaseUrl: "" } : null);

const need = (provider: string, values: Record<string, string | undefined>) => {
  const missing = Object.entries(values).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`MEDIA_DOCUMENTS_PROVIDER=${provider} needs ${missing.join(", ")}`);
};

/**
 * The only place a documents store is chosen. Nothing kept is the default; the admin's choice (settings) wins over the environment's
 * provider; Bunny (the `http` zone) is refused outside development. Credentials stay in the environment.
 */
export function storageFrom(e: StorageEnv, now: () => Date, admin: AdminChoice = null, call: FetchLike = fetch as unknown as FetchLike): DocumentStore {
  const env = deploymentOf(e);
  const chosen = adminOf(admin);
  const provider = env.provider === "none" ? "none" : chosen && chosen.provider !== "local" ? chosen.provider : env.provider;
  // What is missing is said by its environment name before the package looks at the values (it would only say « invalid address »).
  if (provider === "http") {
    if (e.APP_ENVIRONMENT === "prod") throw new Error("Bunny has no Canadian region: it is for development and fictional data only");
    need("bunny", { MEDIA_STORAGE_ZONE: chosen?.zone || e.MEDIA_STORAGE_ZONE, MEDIA_STORAGE_API_KEY: e.MEDIA_STORAGE_API_KEY });
  } else if (provider === "s3") {
    need("s3", { MEDIA_S3_ENDPOINT: chosen?.endpoint || e.MEDIA_S3_ENDPOINT, MEDIA_S3_REGION: chosen?.region || e.MEDIA_S3_REGION, MEDIA_S3_BUCKET: chosen?.bucket || e.MEDIA_S3_BUCKET, MEDIA_S3_ACCESS_KEY_ID: e.MEDIA_S3_ACCESS_KEY_ID, MEDIA_S3_SECRET_ACCESS_KEY: e.MEDIA_S3_SECRET_ACCESS_KEY });
  }
  let resolved;
  try {
    resolved = resolveStorage(env, chosen, { maxSignedSeconds: MAX_SIGNED_URL_SECONDS });
  } catch (error) {
    // The admin chose a provider on a deployment that keeps nothing: the environment wins, nothing is kept (the settings screen refuses it earlier).
    if (error instanceof StorageError && error.code === STORAGE_CODE.keepingOff) return noneStore();
    throw error;
  }
  if (resolved.provider === "none") return noneStore();
  const { settings } = resolved;
  const opened = openResolved(resolved, env, { fetch: call, clock: { now } });
  if (!opened) return noneStore();
  // The product's name for the Bunny-shaped zone is `bunny` (it is recorded with each document); Canada is claimed only when the region and the endpoint agree.
  const descriptor = describeStore({ provider: resolved.provider, endpoint: settings.endpoint, region: settings.region }, { encrypted: !!e.MEDIA_DOCUMENTS_ENCRYPTION_KEY, httpKind: STORAGE_KIND.bunny });
  return documentStoreOver(opened.store, asDescriptor(descriptor), settings.signedUrlSeconds);
}

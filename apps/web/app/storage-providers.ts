import { randomUUID } from "node:crypto";

import { type FetchLike } from "@krizaka/storage";
import { createProviderService, dbProviderStore, type ProviderService, type ProviderStore } from "@krizaka/storage/provider-admin";

import { audit } from "@/lib/audit";
import { query } from "@/lib/db";
import { env } from "@/lib/env";
import type { DocumentStore } from "@/lib/storage/port";
import { bootstrapStorage, DATA_KIND, documentsStoreOver, vaultFrom } from "@/lib/storage/providers";

import { systemClock } from "./system-clock";

/** The documents that name a provider: while some do, it can be neither disabled nor retired. */
const referencesOf = async (providerId: string) => Number((await query<{ n: string }>("SELECT count(*)::text AS n FROM documents WHERE provider_id = $1", [providerId]))[0]?.n ?? 0);

const holder = globalThis as unknown as { __yomizakaProviders?: { service: ProviderService; store: ProviderStore } | null };

/** A deployed server (`NODE_ENV=production`) opens only the cloud kinds; a developer's machine and the tests may also open a folder. */
export const storageRuntime = (): "server" | "dev" => (process.env.NODE_ENV === "production" ? "server" : "dev");

/** The provider service and its store, one per process (pages and routes are bundled apart); null when no vault key is deployed. */
export function providers(): { service: ProviderService; store: ProviderStore } | null {
  if (holder.__yomizakaProviders !== undefined) return holder.__yomizakaProviders;
  const e = env();
  const vault = vaultFrom(e);
  if (!vault) {
    holder.__yomizakaProviders = null;
    return null;
  }
  const store = dbProviderStore(query);
  // A deployed server never writes its own disk (ADR-005 §5): the registry opens `folder` only in a development runtime.
  const runtime = storageRuntime();
  const service = createProviderService({
    store,
    vault,
    clock: systemClock,
    newId: randomUUID,
    open: { runtime, environment: e.APP_ENVIRONMENT, fetch: fetch as unknown as FetchLike, clock: systemClock },
    probeId: randomUUID,
    references: referencesOf,
    audit: (note) => audit({ action: note.action, actorId: note.actor.id, actorLabel: note.actor.label, targetId: note.target.id, detail: note.detail }),
  });
  holder.__yomizakaProviders = { service, store };
  return holder.__yomizakaProviders;
}

/** For tests: forget the cached service. */
export const resetProviders = () => {
  holder.__yomizakaProviders = undefined;
};

/** The default store for a kind of data, or null (no vault key, no provider, or one that cannot be opened). */
export async function defaultStore(dataKind: string = DATA_KIND.documents): Promise<DocumentStore | null> {
  const p = providers();
  return p ? ((await documentsStoreOver(p.service, p.store, dataKind))?.store ?? null) : null;
}


/** At start, after the migrations: imports the environment's provider once and gives the documents already in it their `provider_id`. */
export async function bootstrapFromEnvironment(): Promise<string | null> {
  const p = providers();
  if (!p) return null;
  const imported = await bootstrapStorage(p.service, env());
  if (!imported) return null;
  await query("UPDATE documents SET provider_id = $1 WHERE object_key IS NOT NULL AND provider_id IS NULL AND storage_owner = 'krizaka'", [imported.id]);
  return imported.id;
}

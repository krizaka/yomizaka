import { type ObjectStore } from "@krizaka/storage";
import { type ProviderService, readDual } from "@krizaka/storage/provider-admin";

const RETIRING = "retiring";

/**
 * The store of the default provider while a move is running (ADR-005 §3): writes go to the new default; a read goes new-then-old, so a
 * document not yet moved is still served from the provider that is retiring. The old provider keeps reading until no row reaches it.
 * A delete reaches every provider that may still hold the file (it is idempotent). With nothing retiring this is the default store itself.
 */
export async function dualObjectStore(
  service: Pick<ProviderService, "list" | "open">,
  primaryId: string,
  scope: string,
): Promise<ObjectStore> {
  const primary = await service.open(primaryId);
  const retiring = (await service.list(scope))
    .filter((p) => p.status === RETIRING && p.id !== primaryId)
    .map((p) => p.id);
  if (retiring.length === 0) return primary;
  const open = (id: string) => service.open(id);
  const holders = async (key: string): Promise<ObjectStore | null> => {
    for (const id of [primaryId, ...retiring]) {
      const store = await open(id);
      if (await store.head(key)) return store;
    }
    return null;
  };
  return {
    ...primary,
    get: async (key) => {
      const found = await readDual({ key, providerId: primaryId, fallbackIds: retiring, open });
      return found ? { bytes: found.bytes, contentType: found.contentType } : null;
    },
    head: async (key) => (await (await holders(key))?.head(key)) ?? null,
    signedUrl: async (key, ttlSeconds) => (await (await holders(key))?.signedUrl(key, ttlSeconds)) ?? null,
    delete: async (key) => {
      for (const id of [primaryId, ...retiring]) await (await open(id)).delete(key);
    },
  };
}

import { STORAGE_KIND, type StorageKind } from "@yomizaka/core";

import type { StoreDescriptor } from "./port";

/**
 * The managed PostgreSQL where a document's bytes live today: DigitalOcean's Toronto region (deploy/digitalocean/dev.app.yaml,
 * next to the cluster), encrypted at rest by the provider. Not a configurable store: the legacy and current home of a document.
 */
const DATABASE: StoreDescriptor = { kind: "database", endpoint: null, region: "tor1", residency: "canada", encrypted: true, owner: "krizaka", devOnly: false };

/** The descriptor of a stored document, from its kind and the store configured now. */
const DEV_ONLY = new Set<StorageKind>([STORAGE_KIND.bunny]);

export function storedAs(kind: StorageKind, active: StoreDescriptor): StoreDescriptor {
  switch (kind) {
    case STORAGE_KIND.database:
      return DATABASE;
    case STORAGE_KIND.none:
      return { ...active, kind, endpoint: null, region: null, residency: "unknown", encrypted: false, devOnly: false };
    case STORAGE_KIND.device:
      return { kind, endpoint: null, region: null, residency: "device", encrypted: false, owner: "device", devOnly: false };
    default:
      return kind === active.kind ? active : { kind, endpoint: null, region: null, residency: "unknown", encrypted: false, owner: "krizaka", devOnly: DEV_ONLY.has(kind) };
  }
}

export type NoticeKey = "none" | "krizakaCanadaEncrypted" | "krizakaCanada" | "krizakaElsewhere" | "workspace" | "devOnly" | "device";

/** Which sentence of the info panel says where this document lives (« Non conservé », « Conservé : Krizaka (Canada, chiffré) », …), with its variables. */
export function storageNotice(d: StoreDescriptor): { key: NoticeKey; vars: Record<string, string> } {
  const fixed: Partial<Record<StorageKind, NoticeKey>> = { [STORAGE_KIND.none]: "none", [STORAGE_KIND.device]: "device" };
  const key = fixed[d.kind];
  if (key) return { key, vars: {} };
  if (d.devOnly) return { key: "devOnly", vars: {} };
  if (d.owner === "workspace") return { key: "workspace", vars: { endpoint: d.endpoint ?? "", region: d.region ?? "" } };
  if (d.residency === "canada") return { key: d.encrypted ? "krizakaCanadaEncrypted" : "krizakaCanada", vars: {} };
  return { key: "krizakaElsewhere", vars: { region: d.region ?? "" } };
}

import type { StoreDescriptor } from "./port";

/** What a document row says about where it lives (the `documents.storage` column). */
export type StoredKind = StoreDescriptor["kind"];

/**
 * The managed PostgreSQL where a document's bytes live today: DigitalOcean's Toronto region (deploy/digitalocean/dev.app.yaml,
 * next to the cluster), encrypted at rest by the provider. Not a configurable store: the legacy and current home of a document.
 */
const DATABASE: StoreDescriptor = { kind: "database", endpoint: null, region: "tor1", residency: "canada", encrypted: true, owner: "krizaka", devOnly: false };

/** The descriptor of a stored document, from its kind and the store configured now. */
const DEV_ONLY = new Set<StoredKind>(["bunny"]);

export function storedAs(kind: StoredKind, active: StoreDescriptor): StoreDescriptor {
  switch (kind) {
    case "database":
      return DATABASE;
    case "none":
      return { ...active, kind, endpoint: null, region: null, residency: "unknown", encrypted: false, devOnly: false };
    case "device":
      return { kind, endpoint: null, region: null, residency: "device", encrypted: false, owner: "device", devOnly: false };
    default:
      return kind === active.kind ? active : { kind, endpoint: null, region: null, residency: "unknown", encrypted: false, owner: "krizaka", devOnly: DEV_ONLY.has(kind) };
  }
}

export type NoticeKey = "none" | "krizakaCanadaEncrypted" | "krizakaCanada" | "krizakaElsewhere" | "workspace" | "devOnly" | "device";

/** Which sentence of the info panel says where this document lives (« Non conservé », « Conservé : Krizaka (Canada, chiffré) », …), with its variables. */
export function storageNotice(d: StoreDescriptor): { key: NoticeKey; vars: Record<string, string> } {
  const fixed: Partial<Record<StoredKind, NoticeKey>> = { none: "none", device: "device" };
  const key = fixed[d.kind];
  if (key) return { key, vars: {} };
  if (d.devOnly) return { key: "devOnly", vars: {} };
  if (d.owner === "workspace") return { key: "workspace", vars: { endpoint: d.endpoint ?? "", region: d.region ?? "" } };
  if (d.residency === "canada") return { key: d.encrypted ? "krizakaCanadaEncrypted" : "krizakaCanada", vars: {} };
  return { key: "krizakaElsewhere", vars: { region: d.region ?? "" } };
}

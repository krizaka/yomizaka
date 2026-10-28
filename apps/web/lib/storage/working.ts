import type { DocumentStore } from "./port";

/**
 * What holds the bytes of a document when no provider is configured (ADR-0012): `none` (the default: nothing, uploads are refused with a
 * clear message and the app still starts) or `folder` (opt-in, a laptop and the tests only: the startup refuses it when the app runs
 * deployed, `productionProblems`). No document bytes ever go to PostgreSQL. The provider itself (Bunny, admin-configured) comes with
 * the admin storage settings (krizaka-ts#216).
 */
export const DOCUMENTS_STORES = ["none", "folder"] as const;
export type DocumentsStoreMode = (typeof DOCUMENTS_STORES)[number];

/** What the choice can open: each is built only when it is the one used. */
export interface WorkingStores {
  /** The store a provider configured (the deployment's environment or the admin's settings); null when none is. */
  configured: () => Promise<DocumentStore | null>;
  folder: () => DocumentStore;
}

/** The working store: the configured provider's, else the local folder when opted in, else none (null: uploads are refused). */
export async function workingStoreFor(mode: DocumentsStoreMode, stores: WorkingStores): Promise<DocumentStore | null> {
  return (await stores.configured()) ?? (mode === "folder" ? stores.folder() : null);
}

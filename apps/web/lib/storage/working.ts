import type { DocumentStore } from "./port";

/** Where the bytes of a document that is not kept live (ADR-0012), chosen by `APP_DOCUMENTS_STORE`. */
export const DOCUMENTS_STORES = ["database", "folder", "spaces"] as const;
export type DocumentsStoreMode = (typeof DOCUMENTS_STORES)[number];

/** What the choice can open: each is built only when it is the one chosen. */
export interface WorkingStores {
  /** The deployment's bucket (Spaces, an S3-compatible bucket); null when none is configured. */
  spaces: () => Promise<DocumentStore | null>;
  database: () => DocumentStore;
  folder: () => DocumentStore;
}

/**
 * The working store of the deployment, by its mode: `database` (a deployed environment without a bucket), `folder` (a laptop and the
 * tests only: the startup refuses it when the app runs deployed, `productionProblems`), `spaces` (the deployment's bucket; null when
 * it has none, and uploads are refused).
 */
export async function workingStoreFor(mode: DocumentsStoreMode, stores: WorkingStores): Promise<DocumentStore | null> {
  switch (mode) {
    case "database":
      return stores.database();
    case "folder":
      return stores.folder();
    case "spaces":
      return stores.spaces();
  }
}

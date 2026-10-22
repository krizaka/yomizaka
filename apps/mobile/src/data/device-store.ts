import { isId, STORAGE_KIND, STORAGE_OWNER, STORAGE_RESIDENCY } from "@yomizaka/core";

/** What the device store needs from the file system: the app's sandbox, never a path outside it. */
export interface FilePort {
  ensureDirectory(uri: string): void;
  copy(from: string, to: string): void;
  /** The names of the files in a directory, empty when it does not exist yet. */
  names(directoryUri: string): string[];
  remove(uri: string): void;
}

/** What the info panel says of where the documents live. */
export const DEVICE_PLACE = { kind: STORAGE_KIND.device, owner: STORAGE_OWNER.device, residency: STORAGE_RESIDENCY.device } as const;

/**
 * The `DocumentStore` port of ADR-0007 for the phone: the file stays in the app's sandbox, named by the id of the document
 * the server knows, and leaves the device only for the one check that needs it. The default of the app.
 */
export interface DeviceStore {
  keep(documentId: string, sourceName: string, sourceUri: string): void;
  uriOf(documentId: string): string | null;
  remove(documentId: string): void;
  describe(): typeof DEVICE_PLACE;
}

/** The extension of the kept copy, so the share sheet and the viewers know the type. */
export function extensionOf(name: string): string {
  return /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toLowerCase() ?? "bin";
}

const guard = (id: string): string => {
  if (!isId(id)) throw new Error("not a document id");
  return id;
};

export function createDeviceStore(files: FilePort, root: string): DeviceStore {
  const directory = `${root.replace(/\/$/, "")}/documents`;
  const nameOf = (id: string) => files.names(directory).find((n) => n.startsWith(`${id}.`));
  return {
    keep(documentId, sourceName, sourceUri) {
      const id = guard(documentId);
      files.ensureDirectory(directory);
      files.copy(sourceUri, `${directory}/${id}.${extensionOf(sourceName)}`);
    },
    uriOf(documentId) {
      const name = nameOf(guard(documentId));
      return name ? `${directory}/${name}` : null;
    },
    remove(documentId) {
      const name = nameOf(guard(documentId));
      if (name) files.remove(`${directory}/${name}`);
    },
    describe: () => DEVICE_PLACE,
  };
}

import { Directory, File, Paths } from "expo-file-system";

import { createDeviceStore, type FilePort } from "./device-store";

/** The phone's file system behind the device store's port: the app's document directory, nothing else. */
const files: FilePort = {
  ensureDirectory: (uri) => new Directory(uri).create({ idempotent: true, intermediates: true }),
  copy: (from, to) => new File(from).copy(new File(to)),
  names: (directoryUri) => {
    const directory = new Directory(directoryUri);
    return directory.exists ? directory.list().map((entry) => entry.name) : [];
  },
  remove: (uri) => new File(uri).delete(),
};

export const deviceStore = createDeviceStore(files, Paths.document.uri);

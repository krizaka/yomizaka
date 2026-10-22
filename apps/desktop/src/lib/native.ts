import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface FolderEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  /** Seconds since the epoch. */
  modified: number;
  kind: string;
}

export interface Listing {
  entries: FolderEntry[];
  truncated: boolean;
}

export interface DocumentBytes {
  name: string;
  mime: string;
  size: number;
  /** base64 */
  data: string;
}

/**
 * The Rust side, typed: everything that touches the disk or the Keychain. The page has no `fs`, no shell, no opener; each
 * call below goes through the folder scope (a granted folder, or a file dropped on the window this session).
 */
export const native = {
  folders: () => invoke<string[]>("folders"),
  grantFolder: () => invoke<string | null>("grant_folder"),
  revokeFolder: (path: string) => invoke<string[]>("revoke_folder", { path }),
  listFolder: (path: string) => invoke<Listing>("list_folder", { path }),
  readDocument: (path: string) => invoke<DocumentBytes>("read_document", { path }),
  saveReport: (document: string, name: string, data: string) => invoke<string>("save_report", { document, name, data }),
  sessionToken: () => invoke<string | null>("session_token"),
  storeSessionToken: (token: string) => invoke<void>("store_session_token", { token }),
  clearSessionToken: () => invoke<void>("clear_session_token"),
};

/** The paths the system reports as dropped on the window (already allowed on the Rust side). */
export const onDropped = (handler: (paths: string[]) => void) => listen<string[]>("documents-dropped", (event) => handler(event.payload));

/** The bytes of a base64 string, for a `Blob` part. */
export function bytesOf(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function base64Of(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

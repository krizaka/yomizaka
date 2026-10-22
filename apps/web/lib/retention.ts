import { STORAGE_KIND, type StorageKind } from "@yomizaka/core";
import { addHours } from "date-fns";
import type { QueryResultRow } from "pg";

import type { StoreDescriptor } from "./storage/port";

/**
 * Keep or purge (ADR-0007). By default a document is NOT kept: once its check has run, its file and its text are purged and
 * only the report stays. The person chooses « conserver » to keep it — on the configured store (Bunny in development, S3), or
 * in Krizaka's database when none is configured. A document that is never checked is purged after a window (configuration).
 */
type Query = <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<T[]>;

/** The stores that hold a document's file outside the database. */
export const EXTERNAL = new Set<StorageKind>([STORAGE_KIND.bunny, STORAGE_KIND.s3]);

/** Where a new document goes, from the person's choice and the store configured now. */
export function storageFor(keep: boolean, active: StoreDescriptor): StorageKind {
  if (!keep) return STORAGE_KIND.none;
  return EXTERNAL.has(active.kind) ? active.kind : STORAGE_KIND.database;
}

const EXTENSION: Record<string, string> = { "application/pdf": "pdf", "text/plain": "txt" };

/** The object key of a kept document on an external store. */
export const objectKey = (owner: string, document: string, mimeType: string) => `${owner}/${document}/original.${EXTENSION[mimeType] ?? "bin"}`.toLowerCase();

/** When a not-kept document that was never checked is purged. */
export const purgeDeadline = (now: Date, hours: number): Date => addHours(now, hours);

/** Purges one not-kept document: its file and its text go, its title, hash and reports stay. True when something was purged. */
export async function purgeDocument(q: Query, documentId: string): Promise<boolean> {
  const rows = await q("UPDATE documents SET content = ''::bytea, text = '', retain_until = NULL WHERE id = $1 AND storage = 'none' AND (octet_length(content) > 0 OR text <> '') RETURNING id", [documentId]);
  return rows.length > 0;
}

/** After a check: purges the document when it is not kept and no other check of it is still running. */
export async function purgeIfDone(q: Query, documentId: string): Promise<boolean> {
  const running = await q("SELECT 1 FROM analyses WHERE document_id = $1 AND status = 'running' LIMIT 1", [documentId]);
  return running.length === 0 && (await purgeDocument(q, documentId));
}

/** The sweep: not-kept documents past their deadline (never checked). Returns how many were purged. */
export async function purgeExpired(q: Query, now: Date): Promise<number> {
  const rows = await q("UPDATE documents SET content = ''::bytea, text = '', retain_until = NULL WHERE storage = 'none' AND retain_until IS NOT NULL AND retain_until <= $1 AND (octet_length(content) > 0 OR text <> '') RETURNING id", [now]);
  return rows.length;
}

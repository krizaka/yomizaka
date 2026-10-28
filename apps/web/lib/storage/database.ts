import type { Query } from "@krizaka/db";

import type { DocumentStore, StoredObject } from "./port";
import { assertKey } from "./port";

/**
 * The database adapter of the working store (ADR-0012, yomizaka#17): the bytes of a document in a dedicated table, `document_blobs`,
 * behind the same port as a folder or a bucket. It is for a deployed environment that has no bucket (the dev deployment today, whose
 * filesystem is lost at each redeploy and not shared between instances): the bytes then live where the rest of the data lives, and
 * leave with the purge like any other object. It is the only code (with its seed twin, which cannot import TypeScript) that writes
 * document bytes to PostgreSQL: `lib/document-bytes-guard.test.ts` names it as the adapter.
 */
export function databaseStore(run: Query): DocumentStore {
  return {
    async put(key, bytes, meta) {
      await run("INSERT INTO document_blobs (object_key, content_type, bytes) VALUES ($1, $2, $3) ON CONFLICT (object_key) DO UPDATE SET content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes", [assertKey(key), meta.contentType, Buffer.from(bytes)]);
    },
    async get(key): Promise<StoredObject | null> {
      const [row] = await run<{ content_type: string; bytes: Buffer }>("SELECT content_type, bytes FROM document_blobs WHERE object_key = $1", [assertKey(key)]);
      return row ? { bytes: new Uint8Array(row.bytes), contentType: row.content_type } : null;
    },
    async signedUrl() {
      return null;
    },
    async delete(key) {
      await run("DELETE FROM document_blobs WHERE object_key = $1", [assertKey(key)]);
    },
    describe: () => ({ kind: "none", endpoint: null, region: null, residency: "unknown", encrypted: false, owner: "krizaka", devOnly: false }),
  };
}

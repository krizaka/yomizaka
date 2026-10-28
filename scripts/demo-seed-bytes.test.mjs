// The demo seed writes the bytes of its PDFs to the working store the app is configured with (APP_DOCUMENTS_STORE, ADR-0012):
// the database on a deployed environment without a bucket, a folder on a laptop; never a bucket from here.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it as test } from "vitest";

import { bytesWriter } from "./demo-seed/seed.mjs";

test("database: one upsert into document_blobs, keyed by the object key, with the bytes", async () => {
  const calls = [];
  const write = bytesWriter({ APP_DOCUMENTS_STORE: "database" }, async (sql, values) => calls.push({ sql, values }));
  await write("owner/doc/original.pdf", new Uint8Array([1, 2, 3]));
  expect(calls).toHaveLength(1);
  expect(calls[0].sql).toMatch(/^INSERT INTO document_blobs \(object_key, content_type, bytes\)/);
  expect(calls[0].sql).toMatch(/ON CONFLICT \(object_key\) DO UPDATE/);
  expect(calls[0].values[0]).toBe("owner/doc/original.pdf");
  expect([...calls[0].values[1]]).toEqual([1, 2, 3]);
});

test("folder (the default): the file under the working folder, nothing sent to the database", async () => {
  const key = `seed-test-${Date.now()}/doc/original.pdf`;
  const calls = [];
  const write = bytesWriter({}, async (...args) => calls.push(args));
  await write(key, new Uint8Array([9, 8]));
  const path = join(tmpdir(), "yomizaka-documents", key);
  expect(existsSync(path)).toBe(true);
  expect([...readFileSync(path)]).toEqual([9, 8]);
  expect(calls).toHaveLength(0);
  rmSync(join(tmpdir(), "yomizaka-documents", key.split("/")[0]), { recursive: true, force: true });
});

test("a bucket is not seeded from here: the mode is refused, named", () => {
  expect(() => bytesWriter({ APP_DOCUMENTS_STORE: "spaces" }, async () => [])).toThrow(/database or folder, not spaces/);
});

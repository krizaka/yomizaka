// The demo seed puts the bytes of its PDFs in the working store only when one exists (APP_DOCUMENTS_STORE=folder, a laptop and the tests,
// ADR-0012). Anywhere else it seeds the metadata, skips the bytes and says why: never PostgreSQL, never a deployed server's disk.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it as test } from "vitest";

import { bytesWriter } from "./demo-seed/seed.mjs";

test("folder (opt-in): the file under the working folder", async () => {
  const key = `seed-test-${Date.now()}/doc/original.pdf`;
  const log = [];
  const write = bytesWriter({ APP_DOCUMENTS_STORE: "folder" }, (m) => log.push(m));
  expect(write.stores).toBe(true);
  await write(key, new Uint8Array([9, 8]));
  const path = join(tmpdir(), "yomizaka-documents", key);
  expect(existsSync(path)).toBe(true);
  expect([...readFileSync(path)]).toEqual([9, 8]);
  expect(log).toEqual([]);
  rmSync(join(tmpdir(), "yomizaka-documents", key.split("/")[0]), { recursive: true, force: true });
});

test("no variable (a deployed environment): the bytes are skipped and the reason is logged once", async () => {
  const log = [];
  const write = bytesWriter({}, (m) => log.push(m));
  expect(write.stores).toBe(false);
  await write("owner/doc/original.pdf", new Uint8Array([1]));
  expect(log).toHaveLength(1);
  expect(log[0]).toMatch(/APP_DOCUMENTS_STORE=none.*metadata is seeded, their bytes are not/);
});

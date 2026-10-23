import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { BRAND, ICONS, LOCK, sha256 } from "./sync-brand-icons.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Anti-drift guard, offline: every committed icon is, byte for byte, the CDN file its lock names (`node scripts/sync-brand-icons.mjs`
// re-downloads them and rewrites the lock). The lock is held to the CDN manifest by CI (`--check`, scripts/ci-after-build.sh).
describe(`brand icons (${BRAND})`, () => {
  it("each committed icon matches its locked CDN hash", async () => {
    const locked = JSON.parse(await readFile(LOCK, "utf8"));
    for (const [file, dest] of Object.entries(ICONS)) {
      const expected = locked[`brand/${BRAND}/${file}`];
      expect(expected, `brand/${BRAND}/${file} in scripts/brand-icons.lock.json`).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256(await readFile(path.join(ROOT, dest))), dest).toBe(expected);
    }
  });
});

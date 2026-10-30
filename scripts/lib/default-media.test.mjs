import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

// Default media URLs (avatars, banners, logos) come from the Krizaka org JSON (@krizaka/org), never hard-coded or bundled here
// (krizaka/.github docs/standards/default-media.md). No source of the app names a default-media path.
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SKIP = new Set(["node_modules", ".next", "dist", ".turbo", "coverage", "ios", "android"]);
const sources = (dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? SKIP.has(e.name)
        ? []
        : sources(join(dir, e.name))
      : /\.(tsx?|mjs|css)$/.test(e.name) && !/\.test\.[a-z]+$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
const FORBIDDEN = /people\/defaults|krizaka-defaults|krizaka-assets[^/"'\s]*\/defaults\/|\/defaults\/v\d+\//;

describe("default media are read from the Krizaka org JSON", () => {
  const files = ["apps", "packages"].flatMap((d) => sources(d));
  it("scans the sources (the guard is not vacuous)", () => assert.ok(files.length > 100, String(files.length)));
  it("hard-codes no default-media path", () => {
    const hits = files.filter((f) => FORBIDDEN.test(readFileSync(join(ROOT, f), "utf8")));
    assert.deepEqual(hits, [], "read the URL from @krizaka/org (listDefaults / defaultFor), never write it");
  });
});

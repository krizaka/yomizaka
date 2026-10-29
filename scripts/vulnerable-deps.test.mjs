import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

// The guard of « fix(deps): known vulnerabilities » (#505): the lockfile never goes back below the version that fixed an advisory.
// The Scorecard / OSV scan finds new advisories; this keeps the ones already fixed fixed (a rebase or a regenerated lockfile can undo them).
const FIXED = { vitest: "4.1.12", seroval: "1.6.11" };

const lock = readFileSync(fileURLToPath(new URL("../pnpm-lock.yaml", import.meta.url)), "utf8");

const parse = (v) => v.split(".").map(Number);
export const atLeast = (version, minimum) => {
  const [a, b] = [parse(version), parse(minimum)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};

describe("dependencies fixed for a known advisory stay fixed", () => {
  for (const [name, minimum] of Object.entries(FIXED)) {
    it(`${name} is resolved at ${minimum} or later, everywhere in the lockfile`, () => {
      const found = [...lock.matchAll(new RegExp(`^ {2}'?${name}@(\\d+\\.\\d+\\.\\d+)[:(']`, "gm"))].map((m) => m[1]);
      assert.ok(found.length > 0, `${name} is not in the lockfile: remove it from FIXED`);
      for (const version of found) assert.ok(atLeast(version, minimum), `${name}@${version} is below ${minimum} (advisory)`);
    });
  }

  it("compares versions numerically", () => {
    assert.equal(atLeast("1.6.12", "1.6.11"), true);
    assert.equal(atLeast("1.6.9", "1.6.11"), false);
    assert.equal(atLeast("4.2.0", "4.1.12"), true);
  });
});

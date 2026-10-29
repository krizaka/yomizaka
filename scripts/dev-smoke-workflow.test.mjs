import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

// The first run of the Dev smoke died on MODULE_NOT_FOUND (pdf-lib, a dependency of apps/web): the workflow installed nothing. The workflow
// installs the workspace before it runs a script that renders the lease.
const workflow = readFileSync(new URL("../.github/workflows/dev-smoke.yml", import.meta.url), "utf8");

test("the Dev smoke installs the workspace before running the script", () => {
  const install = workflow.indexOf("pnpm install --frozen-lockfile");
  const run = workflow.indexOf("node scripts/smoke-lease-check.mjs");
  assert.ok(install > 0, "no pnpm install in dev-smoke.yml");
  assert.ok(install < run, "the install comes after the script");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

import { byTestId, CHECK_TEST_IDS } from "./check-selectors.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("every test id the take uses is drawn by its component", () => {
  for (const [key, { id, source }] of Object.entries(CHECK_TEST_IDS)) {
    assert.ok(readFileSync(path.join(root, source), "utf8").includes(`data-testid="${id}"`), `${key}: ${id} is gone from ${source}`);
  }
});

test("the take reads its test ids from the shared list, never as literals", () => {
  const take = readFileSync(path.join(root, "scripts/landing-take.mjs"), "utf8");
  assert.doesNotMatch(take, /data-testid=/);
  assert.equal(byTestId("kind"), '[data-testid="kind-choice"]');
});

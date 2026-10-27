// The pre-commit hook runs the ast-grep ratchet on staged TypeScript, so agents see the rules before pushing.
import { accessSync, constants, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hook = new URL("../.githooks/pre-commit", import.meta.url);
const text = () => readFileSync(hook, "utf8");

describe("pre-commit hook", () => {
  it("exists and is executable", () => {
    expect(() => accessSync(hook, constants.X_OK)).not.toThrow();
  });
  it("runs the ast-grep ratchet and never advises --no-verify as a way through", () => {
    expect(text()).toContain("node scripts/sg-ratchet.mjs");
    expect(text()).toContain("never --no-verify");
  });
  it("is skipped when no TypeScript file is staged", () => {
    expect(text()).toMatch(/grep -E .*ts\|tsx\|mts.*\|\| exit 0/);
  });
});

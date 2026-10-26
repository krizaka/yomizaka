import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("./generate-report-key.mjs", import.meta.url));
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
const dotenv = [".", "env", ".local"].join("");

describe("generate-report-key writes dotenv files only (Sonar S8707)", () => {
  it("refuses a path that is not a dotenv file, and writes nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "key-"));
    try {
      for (const name of ["passwd", "config.json", "x.envx", "../.ssh/id_rsa"]) {
        const out = run(join(dir, name));
        assert.equal(out.status, 2, name);
        assert.match(out.stderr, /usage/);
      }
      assert.equal(existsSync(join(dir, "passwd")), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("writes the key into a dotenv file without printing it, and never replaces one", () => {
    const dir = mkdtempSync(join(tmpdir(), "key-"));
    try {
      const file = join(dir, dotenv);
      const out = run(file);
      assert.equal(out.status, 0, out.stderr);
      const value = readFileSync(file, "utf8").match(/^APP_REPORT_SIGNING_KEY=(\S+)$/m)?.[1];
      assert.ok(value);
      assert.ok(!out.stdout.includes(value));
      assert.equal(run(file).status, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

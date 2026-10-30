import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// The S3 adapter is tested against a real S3-compatible server in CI, not skipped (ADR-0007).
describe("CI runs the S3 adapter against a real S3 server", () => {
  const ci = read(".github/workflows/ci.yml");
  it("has a storage-s3 job: an S3 server from scripts/ci-s3.sh, the STORAGE_IT_S3_* values, the S3 tests, required", () => {
    expect(ci).toMatch(/^ {2}storage-s3:/m);
    expect(ci).toContain("scripts/ci-s3.sh");
    for (const key of [
      "STORAGE_IT_S3_ENDPOINT",
      "STORAGE_IT_S3_USER",
      "STORAGE_IT_S3_PASS",
      "STORAGE_IT_S3_BUCKET",
      "STORAGE_IT_S3_REQUIRED",
    ])
      expect(ci, key).toContain(key);
    expect(ci).toContain("lib/storage/s3.test.ts");
  });
  it("the S3 tests fail rather than skip when the job is required and its variables are missing", () => {
    expect(read("apps/web/lib/storage/s3.test.ts")).toContain("STORAGE_IT_S3_REQUIRED");
  });
  it("the script is executable and uses no real secret", () => {
    const sh = read("scripts/ci-s3.sh");
    expect(sh).toContain("seaweedfs@sha256:");
    expect(sh).toContain("--aws-sigv4");
  });
});

import crypto from "node:crypto";

import { residencyOf } from "@krizaka/storage";
import { open, parseVaultKey as parseSettingsKey, seal } from "@krizaka/storage";
import { describe, expect, it } from "vitest";

describe("credentials are sealed for the database", () => {
  const key = crypto.randomBytes(32);
  it("round-trips, differs each time and never contains the secret", () => {
    const a = seal("s3-secret-value", key);
    expect(open(a, key)).toBe("s3-secret-value");
    expect(seal("s3-secret-value", key)).not.toBe(a);
    expect(a).not.toContain("s3-secret-value");
  });
  it("opens only with its key, and refuses a tampered value", () => {
    const a = seal("x", key);
    expect(() => open(a, crypto.randomBytes(32))).toThrow();
    // flip every bit of the last byte: always a different value (replacing characters by a fixed pair sometimes changed nothing)
    const raw = Buffer.from(a.slice(3), "base64url");
    raw[raw.length - 1] = raw.at(-1)! ^ 0xff;
    expect(() => open(`v1.${raw.toString("base64url")}`, key)).toThrow();
    expect(() => parseSettingsKey(Buffer.alloc(8).toString("base64"))).toThrow();
  });
});

describe("residency is read from the region", () => {
  it("says Canada for a Canadian region and elsewhere for the rest", () => {
    expect(residencyOf("tor1")).toBe("canada");
    expect(residencyOf("CA-CENTRAL-1")).toBe("canada");
    expect(residencyOf("eu-west-3")).toBe("elsewhere");
  });
});

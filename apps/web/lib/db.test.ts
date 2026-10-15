import { describe, expect, it } from "vitest";

import { poolConfig } from "./db";
import { MIGRATIONS } from "./migrations";

describe("db", () => {
  it("verifies the cluster's certificate against its CA, never blindly", () => {
    const config = poolConfig({ DATABASE_URL: "postgresql://u:p@db.example:25060/yomizaka_db?sslmode=require", DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\\nX" });
    expect(config.connectionString).not.toContain("sslmode");
    expect(config.ssl).toEqual({ ca: "-----BEGIN CERTIFICATE-----\nX", rejectUnauthorized: true });
  });

  it("speaks plain TCP to a local database", () => {
    expect(poolConfig({ DATABASE_URL: "postgresql://u:p@localhost:5432/yomizaka_db" }).ssl).toBeUndefined();
  });

  it("keeps ordered, unique migrations", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect([...versions].sort()).toEqual(versions);
  });
});

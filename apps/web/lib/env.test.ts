import { describe, expect, it } from "vitest";

import { assertProductionEnv, consoleAllowedIps, productionProblems, readEnv } from "./env";

const PROD = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://yomizaka_db:x@db.example:25060/yomizaka_db?sslmode=require",
  DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----",
  AUTH_SESSION_SECRET: "a".repeat(40),
  AI_API_KEY: "oz_live_key",
};

describe("env", () => {
  it("closes sign-up unless AUTH_SIGNUP_ENABLED is exactly true", () => {
    expect(readEnv({}).AUTH_SIGNUP_ENABLED).toBe(false);
    expect(readEnv({ AUTH_SIGNUP_ENABLED: "yes" }).AUTH_SIGNUP_ENABLED).toBe(false);
    expect(readEnv({ AUTH_SIGNUP_ENABLED: "TRUE" }).AUTH_SIGNUP_ENABLED).toBe(true);
  });

  it("runs the analyses on Orazaka only", () => {
    expect(readEnv({}).AI_PROVIDER).toBe("orazaka");
    expect(() => readEnv({ AI_PROVIDER: "openai" })).toThrow();
    expect(readEnv({}).AI_API_URL).toBe("https://dev.orazaka.com/edge");
  });

  it("refuses a production start without its secrets, naming them, never showing them", () => {
    expect(() => assertProductionEnv(PROD)).not.toThrow();
    const problems = productionProblems(readEnv({ NODE_ENV: "production", AI_API_KEY: "sk-not-orazaka", DATABASE_URL: PROD.DATABASE_URL }));
    expect(problems).toEqual([
      "AUTH_SESSION_SECRET must be at least 32 characters",
      "AI_API_KEY must be an Orazaka key (oz_…)",
      "DATABASE_CA_CERT is required for a TLS database",
    ]);
    expect(problems.join(" ")).not.toContain("sk-not-orazaka");
    expect(productionProblems(readEnv({}))).toEqual([]);
  });

  it("lets nobody into the administration in production without an allow-list", () => {
    expect(consoleAllowedIps({ NODE_ENV: "production" })).toEqual([]);
    expect(consoleAllowedIps({ NODE_ENV: "production", AUTH_ALLOWED_IPS: "203.0.113.7, 198.51.100.2" })).toEqual(["203.0.113.7", "198.51.100.2"]);
    expect(consoleAllowedIps({ NODE_ENV: "development" })).toBeNull();
  });
});

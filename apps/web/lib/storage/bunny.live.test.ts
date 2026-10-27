import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { storageFrom } from "./config";
import { documentStoreContract } from "./contract.testkit";

/**
 * The HTTP (Bunny-shaped) store against the REAL storage zone, with fictional data only, under `yomizaka/it/` (opt-in: set
 * STORAGE_IT_BUNNY_ZONE, STORAGE_IT_BUNNY_ACCESS and optionally STORAGE_IT_BUNNY_ENDPOINT; every object is deleted after the test).
 */
const e = process.env;
const enabled = !!e.STORAGE_IT_BUNNY_ZONE && !!e.STORAGE_IT_BUNNY_ACCESS;
const env = (extra: Record<string, string> = {}) => ({
  APP_ENVIRONMENT: "dev" as const,
  MEDIA_DOCUMENTS_PROVIDER: "bunny" as const,
  MEDIA_DOCUMENTS_PREFIX: "yomizaka/it",
  MEDIA_STORAGE_ENDPOINT: e.STORAGE_IT_BUNNY_ENDPOINT ?? "storage.bunnycdn.com",
  MEDIA_STORAGE_ZONE: e.STORAGE_IT_BUNNY_ZONE,
  MEDIA_STORAGE_API_KEY: e.STORAGE_IT_BUNNY_ACCESS,
  ...extra,
});
const make = () => storageFrom(env(), () => new Date());

describe.runIf(enabled)("http store (real zone, fictional data)", () => {
  documentStoreContract("bunny live", make);
  documentStoreContract("bunny live + encryption", () => storageFrom(env({ MEDIA_DOCUMENTS_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64") }), () => new Date()));

  it("what it holds is not publicly readable through the pull zone without the zone's authentication", async () => {
    const store = make();
    await store.put("it/public-check/doc.txt", new TextEncoder().encode("fictional"), { contentType: "text/plain" });
    const anonymous = await fetch(`https://${e.STORAGE_IT_BUNNY_ENDPOINT ?? "storage.bunnycdn.com"}/${e.STORAGE_IT_BUNNY_ZONE}/yomizaka/it/it/public-check/doc.txt`);
    expect(anonymous.status).toBe(401);
    await store.delete("it/public-check/doc.txt");
  });
});

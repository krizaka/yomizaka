import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { bunnyStore } from "./bunny";
import { documentStoreContract } from "./contract.testkit";
import { encrypted } from "./encrypted";

/**
 * The Bunny adapter against the REAL storage zone, with fictional data only, under `yomizaka/it/` (opt-in: set
 * STORAGE_IT_BUNNY_ZONE, STORAGE_IT_BUNNY_ACCESS and optionally STORAGE_IT_BUNNY_ENDPOINT; every object is deleted after the test).
 */
const e = process.env;
const enabled = !!e.STORAGE_IT_BUNNY_ZONE && !!e.STORAGE_IT_BUNNY_ACCESS;
const make = () => bunnyStore({ endpoint: e.STORAGE_IT_BUNNY_ENDPOINT ?? "storage.bunnycdn.com", zone: e.STORAGE_IT_BUNNY_ZONE!, accessKey: e.STORAGE_IT_BUNNY_ACCESS!, prefix: "yomizaka/it", now: () => new Date() });

describe.runIf(enabled)("bunny adapter (real zone, fictional data)", () => {
  documentStoreContract("bunny live", make);
  documentStoreContract("bunny live + encryption", () => encrypted(make(), crypto.randomBytes(32)));

  it("what it holds is not publicly readable through the pull zone without the zone's authentication", async () => {
    const store = make();
    await store.put("it/public-check/doc.txt", new TextEncoder().encode("fictional"), { contentType: "text/plain" });
    const anonymous = await fetch(`https://${e.STORAGE_IT_BUNNY_ENDPOINT ?? "storage.bunnycdn.com"}/${e.STORAGE_IT_BUNNY_ZONE}/yomizaka/it/it/public-check/doc.txt`);
    expect(anonymous.status).toBe(401);
    await store.delete("it/public-check/doc.txt");
  });
});

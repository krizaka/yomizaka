import { beforeAll, describe, expect, it } from "vitest";

import { migrate, query } from "../db";
import { documentStoreContract } from "./contract.testkit";
import { databaseStore } from "./database";

/** The database working store (ADR-0012): the shared DocumentStore contract, on PostgreSQL (skipped without the database test switch). */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("databaseStore", () => {
  beforeAll(async () => {
    await migrate();
  });
  documentStoreContract("database", () => databaseStore(query));

  it("keeps nothing for the person, has no link to give, and replaces the bytes of a key", async () => {
    const store = databaseStore(query);
    expect(store.describe()).toMatchObject({ kind: "none", owner: "krizaka" });
    const key = `o-${Math.random().toString(36).slice(2)}/d/original.txt`;
    await store.put(key, new TextEncoder().encode("un"), { contentType: "text/plain" });
    await store.put(key, new TextEncoder().encode("deux"), { contentType: "text/plain" });
    expect(await store.signedUrl(key, 60)).toBeNull();
    expect(new TextDecoder().decode((await store.get(key))!.bytes)).toBe("deux");
    const [count] = await query<{ n: number }>("SELECT count(*)::int AS n FROM document_blobs WHERE object_key = $1", [key]);
    expect(count?.n).toBe(1);
    await store.delete(key);
    await store.delete(key);
    expect(await store.get(key)).toBeNull();
  });
});

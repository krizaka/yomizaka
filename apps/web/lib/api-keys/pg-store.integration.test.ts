import { beforeAll, describe } from "vitest";

import { migrate, query } from "../db";
import { apiKeyStoreContract } from "./contract.testkit";
import { pgApiKeyStore } from "./pg-store";

/** The PostgreSQL adapter against a real PostgreSQL (CI's service; locally YOMIZAKA_DB_IT=1 DATABASE_URL=…): the same contract as the memory one. */
const enabled = process.env.YOMIZAKA_DB_IT === "1" && !!process.env.DATABASE_URL;

describe.runIf(enabled)("api key store: PostgreSQL", () => {
  beforeAll(async () => {
    await migrate();
  });
  const owners = new Map<number, string>();
  const owner = async (n: number) => {
    if (!owners.has(n)) {
      const [row] = await query<{ id: string }>("INSERT INTO accounts (email) VALUES ($1) RETURNING id", [`apikeys-${n}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@yomizaka.test`]);
      owners.set(n, row!.id);
    }
    return owners.get(n)!;
  };
  apiKeyStoreContract("pg", () => pgApiKeyStore(query), owner);
});

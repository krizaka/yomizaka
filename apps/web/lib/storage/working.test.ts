import { describe, expect, it } from "vitest";

import { readEnv } from "../env";
import { memoryStore } from "./memory";
import { DOCUMENTS_STORES, workingStoreFor } from "./working";

const opened = (configured: ReturnType<typeof memoryStore> | null = null) => {
  const calls: string[] = [];
  return { calls, stores: { configured: async () => configured, folder: () => (calls.push("folder"), memoryStore()) } };
};

describe("workingStoreFor (APP_DOCUMENTS_STORE)", () => {
  it("with no variable and no provider there is no store: uploads are refused, nothing is written anywhere", async () => {
    const mode = readEnv({}).APP_DOCUMENTS_STORE;
    expect(mode).toBe("none");
    const { calls, stores } = opened();
    expect(await workingStoreFor(mode, stores)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("folder (opt-in) opens the local folder only when no provider is configured", async () => {
    const { calls, stores } = opened();
    expect(await workingStoreFor("folder", stores)).not.toBeNull();
    expect(calls).toEqual(["folder"]);
    const bucket = memoryStore();
    const withProvider = opened(bucket);
    expect(await workingStoreFor("folder", withProvider.stores)).toBe(bucket);
    expect(withProvider.calls).toEqual([]);
  });

  it("a configured provider wins over the default", async () => {
    const bucket = memoryStore();
    expect(await workingStoreFor("none", opened(bucket).stores)).toBe(bucket);
  });

  it("knows exactly two modes", () => {
    expect([...DOCUMENTS_STORES]).toEqual(["none", "folder"]);
  });
});

import { describe, expect, it } from "vitest";

import { memoryStore } from "./memory";
import { DOCUMENTS_STORES, workingStoreFor } from "./working";

const opened = () => {
  const calls: string[] = [];
  const mk = (name: string) => () => {
    calls.push(name);
    return memoryStore();
  };
  return {
    calls,
    stores: {
      spaces: async () => {
        mk("spaces")();
        return null;
      },
      database: mk("database"),
      folder: mk("folder"),
    },
  };
};

describe("workingStoreFor (APP_DOCUMENTS_STORE)", () => {
  it("opens only the store that was chosen", async () => {
    for (const mode of ["database", "folder"] as const) {
      const { calls, stores } = opened();
      expect(await workingStoreFor(mode, stores)).not.toBeNull();
      expect(calls).toEqual([mode]);
    }
  });

  it("spaces answers the deployment's bucket, or null when it has none (uploads are then refused)", async () => {
    const bucket = memoryStore();
    expect(await workingStoreFor("spaces", { ...opened().stores, spaces: async () => bucket })).toBe(bucket);
    const { calls, stores } = opened();
    expect(await workingStoreFor("spaces", stores)).toBeNull();
    expect(calls).toEqual(["spaces"]);
  });

  it("knows exactly three modes", () => {
    expect([...DOCUMENTS_STORES]).toEqual(["database", "folder", "spaces"]);
  });
});

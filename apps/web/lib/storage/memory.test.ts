import { describe, expect, it } from "vitest";

import { documentStoreContract } from "./contract.testkit";
import { memoryStore } from "./memory";
import { noneStore } from "./none";

describe("memory store", () => documentStoreContract("memory", () => memoryStore()));

describe("the none adapter (the default)", () => {
  it("keeps nothing: it refuses to put, answers null, deletes quietly and says « none »", async () => {
    const s = noneStore();
    await expect(s.put("a/b", new Uint8Array([1]), { contentType: "text/plain" })).rejects.toMatchObject({
      status: 409,
    });
    expect(await s.get("a/b")).toBeNull();
    await s.delete("a/b");
    expect(s.describe()).toMatchObject({ kind: "none", encrypted: false, devOnly: false });
  });
});

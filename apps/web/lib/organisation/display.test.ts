import { describe, expect, it } from "vitest";

import { collectionLabel } from "./display";

describe("collectionLabel", () => {
  it("shows the default collection in the language being read", () => {
    expect(collectionLabel("My documents", true, "Mes documents")).toBe("Mes documents");
    expect(collectionLabel("Mes documents", true, "My documents")).toBe("My documents");
    expect(collectionLabel("My documents 2", true, "Mes documents")).toBe("Mes documents 2");
  });
  it("never renames a collection the person named", () => {
    expect(collectionLabel("My documents", false, "Mes documents")).toBe("My documents");
    expect(collectionLabel("Baux", true, "Mes documents")).toBe("Baux");
  });
});

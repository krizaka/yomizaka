import { describe, expect, it } from "vitest";

import { sizeOf } from "./size";

describe("a file's size", () => {
  it("is said in kilobytes, then megabytes, in the person's language", () => {
    expect(sizeOf(500, "en")).toBe("1 kB");
    expect(sizeOf(12 * 1024, "en")).toBe("12 kB");
    expect(sizeOf(2.4 * 1024 * 1024, "en")).toBe("2.4 MB");
    expect(sizeOf(2.4 * 1024 * 1024, "fr")).toMatch(/^2,4\s?Mo$/);
  });
});

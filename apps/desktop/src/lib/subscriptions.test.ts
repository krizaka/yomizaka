import { describe, expect, it, vi } from "vitest";

import { stopAll } from "./subscriptions";

describe("stopAll", () => {
  it("stops every subscription once they have all answered, however late", async () => {
    const stopA = vi.fn();
    const stopB = vi.fn();
    const late = new Promise<() => void>((resolve) => setTimeout(() => resolve(stopB), 5));
    stopAll([Promise.resolve(stopA), late])();
    await late;
    await Promise.resolve();
    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).toHaveBeenCalledTimes(1);
  });
});

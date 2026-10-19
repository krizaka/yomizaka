import { beforeEach, describe, expect, it } from "vitest";

import { hit, MAX_KEYS, resetRateLimits } from "./rate-limit";

/** krizaka/yomizaka#46: filling the store with distinct keys must not give a blocked caller a fresh count. */
describe("the in-process rate limiter", () => {
  beforeEach(() => resetRateLimits());
  const T0 = 1_000_000;

  it("counts a window and refuses past the limit, with the time left", () => {
    expect(hit("a", 2, 60, T0).allowed).toBe(true);
    expect(hit("a", 2, 60, T0).allowed).toBe(true);
    const third = hit("a", 2, 60, T0 + 10_000);
    expect(third).toEqual({ allowed: false, retryAfter: 50 });
    expect(hit("a", 2, 60, T0 + 61_000).allowed).toBe(true);
  });

  it("keeps a blocked caller blocked when the store is flooded with distinct keys", () => {
    for (let i = 0; i < 3; i += 1) hit("attacker", 2, 3600, T0);
    expect(hit("attacker", 2, 3600, T0).allowed).toBe(false);
    for (let i = 0; i < MAX_KEYS + 50; i += 1) hit(`noise-${i}`, 5, 3600, T0 + 1);
    expect(hit("attacker", 2, 3600, T0 + 2).allowed).toBe(false);
  });

  it("limits the flood itself: new keys past the bound share one window instead of each getting a fresh one", () => {
    for (let i = 0; i < MAX_KEYS; i += 1) hit(`fill-${i}`, 5, 3600, T0);
    const results = Array.from({ length: 20 }, (_, i) => hit(`late-${i}`, 5, 3600, T0 + 1).allowed);
    expect(results.filter(Boolean)).toHaveLength(5);
  });

  it("frees the room of windows that have ended", () => {
    for (let i = 0; i < MAX_KEYS; i += 1) hit(`old-${i}`, 5, 60, T0);
    expect(hit("fresh", 1, 60, T0 + 120_000).allowed).toBe(true);
    expect(hit("fresh", 1, 60, T0 + 120_001).allowed).toBe(false);
  });
});

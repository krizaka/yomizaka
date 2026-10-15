import { describe, expect, it } from "vitest";

import { budgetLimit, usageShare } from "./operations-shared";

describe("the database budget", () => {
  it("is the role's own limit when it has one, else the server's", () => {
    expect(budgetLimit(22, 100)).toBe(22);
    expect(budgetLimit(-1, 100)).toBe(100);
    expect(budgetLimit(150, 100)).toBe(100);
  });
  it("shares what is used, capped at 1, 0 without a budget", () => {
    expect(usageShare(5, 20)).toBe(0.25);
    expect(usageShare(30, 20)).toBe(1);
    expect(usageShare(3, 0)).toBe(0);
  });
});
